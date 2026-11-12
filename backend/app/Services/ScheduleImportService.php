<?php

namespace App\Services;

use App\Exports\ReportSheet;
use App\Models\Activity;
use App\Models\Building;
use App\Models\DayPattern;
use App\Models\GradeLevel;
use App\Models\Room;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\TimeSlot;
use App\Models\User;
use App\Support\ScheduleFormat;
use App\Support\TemplateReadFilter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Import a schedule from a file: the system's template (CSV or XLSX), filled in from the
 * school's previous Excel schedules. Every row is checked first, with the same rules as
 * placing a class by hand; good rows are saved as drafts, and each bad row says why.
 */
class ScheduleImportService
{
    public const COLUMNS = ['Grade', 'Section', 'Day', 'Start', 'End', 'Subject', 'Teacher', 'Room'];

    private const DAYS = ['monday' => 1, 'tuesday' => 2, 'wednesday' => 3, 'thursday' => 4, 'friday' => 5];

    private const MAX_ROWS = 2000;

    /** @var array<string, array<int, array<int, array{0: int, 1: int}>>> */
    private array $busy = [];

    /** Where the rows came from: the template, or the school's class program workbook. */
    private string $source = 'template';

    /** @var array<int, string> sections found in a class program workbook */
    private array $sectionsFound = [];

    public function __construct(private ConflictService $conflicts, private AuditLogger $audit, private ClassProgramReader $classPrograms) {}

    /**
     * The template, with a sample row from the user's own sections so the format is clear.
     */
    public function template(SchoolTerm $term, User $user): ReportSheet
    {
        $rows = [self::COLUMNS];

        $entry = ScheduleEntry::with(['section.gradeLevel', 'sectionSubject.subject', 'teacher', 'room'])
            ->where('term_id', $term->id)
            ->whereNotNull('section_subject_id')
            ->whereIn('section_id', Section::visibleTo($user)->select('id'))
            ->orderBy('section_id')
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->first();

        $rows[] = $entry
            ? [$entry->section->gradeLevel->grade, $entry->section->name, ScheduleFormat::dayName($entry->day_of_week),
                ScheduleFormat::time($entry->start_time), ScheduleFormat::time($entry->end_time),
                $entry->subjectName(), $entry->teacher?->printedName(), $entry->room?->room_number]
            : [7, 'Honesty', 'Monday', '7:15 AM', '8:00 AM', 'Mathematics', 'Juan Dela Cruz', '101'];

        return new ReportSheet('Schedule import', $rows, headers: ['A1:H1'], columnWidths: [8, 18, 12, 11, 11, 26, 26, 12]);
    }

    /**
     * Checks every row. With $isPreview, nothing is saved.
     *
     * @return array<string, mixed>
     */
    /**
     * With $setUp, what the file names but the system does not have yet (sections, subjects,
     * teachers, rooms, a bell schedule) is created first, in the same transaction as the classes.
     * Without it, the same set-up is tried and undone, only to say what is missing.
     */
    public function import(SchoolTerm $term, UploadedFile $file, User $user, bool $isPreview, bool $setUp = false): array
    {
        $rows = $this->readRows($file);

        DB::beginTransaction();
        try {
            $missing = $this->setUpMissing($rows, $term, $user);

            if (! $setUp) {
                DB::rollBack();
                $summary = $this->run($rows, $term, $user, $isPreview);
            } else {
                $summary = $this->run($rows, $term, $user, $isPreview);
                if ($isPreview || $summary['ok'] === 0) {
                    DB::rollBack();
                } else {
                    $this->audit->log($user, 'import_set_up', 'schedule_entries', $term->id, null, array_map('count', $missing));
                    DB::commit();
                }
            }
        } catch (\Throwable $problem) {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            throw $problem;
        }

        return $summary + [
            'set_up' => $setUp,
            'missing' => array_map(fn (array $names) => ['count' => count($names), 'names' => array_slice($names, 0, 6)], $missing),
        ];
    }

    /** Checks every row, and saves the good ones unless this is a preview. */
    private function run(array $rows, SchoolTerm $term, User $user, bool $isPreview): array
    {
        $context = $this->context($term, $user);
        $this->loadBusy($term);

        $checked = [];
        $plannedLoadings = [];

        foreach ($rows as $index => $values) {
            $checked[] = $this->checkRow($index + 2, $values, $term, $context, $plannedLoadings);
        }

        $good = array_values(array_filter($checked, fn (array $row) => $row['status'] === 'ok'));
        $summary = [
            'source' => $this->source,
            'sections_found' => $this->sectionsFound,
            'total' => count($checked),
            'ok' => count($good),
            'errors' => count($checked) - count($good),
            'new_loadings' => count(array_unique(array_filter(array_map(fn (array $row) => $row['new_loading'] ?? null, $good)))),
            'rows' => array_map(fn (array $row) => collect($row)->except(['plan', 'new_loading'])->all(), $checked),
        ];

        if ($isPreview || $good === []) {
            return $summary;
        }

        DB::transaction(function () use ($good, $term, $context, $user, $summary) {
            $loadings = [];

            foreach ($good as $row) {
                $plan = $row['plan'];
                $section = $context['sections'][$plan['section_id']];
                $loadingId = null;
                $teacherId = null;

                if ($plan['subject_id'] !== null) {
                    $key = "{$plan['section_id']}|{$plan['subject_id']}";
                    $loadings[$key] ??= SectionSubject::firstOrCreate(
                        ['term_id' => $term->id, 'section_id' => $plan['section_id'], 'subject_id' => $plan['subject_id']],
                        ['teacher_id' => $plan['teacher_id']],
                    );
                    $loadingId = $loadings[$key]->id;
                    $teacherId = $loadings[$key]->teacher_id;

                    // The same check as a placement by hand.
                    $clashes = $this->conflicts->findConflicts($term->id, $section, $teacherId, (int) $plan['room_id'], [$plan['day']], $plan['start'], $plan['end']);
                    if ($clashes !== []) {
                        throw new ConflictHttpException("Row {$row['row']}: {$clashes[0]['message']} Please review the file again.");
                    }
                }

                ScheduleEntry::create([
                    'term_id' => $term->id,
                    'section_id' => $plan['section_id'],
                    'section_subject_id' => $loadingId,
                    'teacher_id' => $teacherId,
                    'activity_id' => $plan['activity_id'],
                    'room_id' => $plan['activity_id'] ? null : $plan['room_id'],
                    'day_of_week' => $plan['day'],
                    'start_time' => $plan['start'],
                    'end_time' => $plan['end'],
                    'created_by' => $user->id,
                ]);
            }

            $this->audit->log($user, 'import', 'schedule_entries', $term->id, null, collect($summary)->except('rows')->all());
        });

        return $summary;
    }

    /**
     * @return array<int, array<int, mixed>> the data rows, without the header
     */
    private function readRows(UploadedFile $file): array
    {
        $extension = strtolower($file->getClientOriginalExtension());

        if ($extension === 'pdf') {
            throw ValidationException::withMessages(['file' => 'A PDF cannot be read as a table yet. Open the schedule in Excel and save it as an Excel workbook (.xlsx), then upload that.']);
        }

        try {
            $reader = IOFactory::createReader(match ($extension) {
                'csv', 'txt' => 'Csv',
                'xls' => 'Xls',
                default => 'Xlsx',
            });

            // The template is the first sheet: only its values, columns and rows.
            if (! in_array($extension, ['csv', 'txt'], true)) {
                $reader->setReadDataOnly(true);
                $reader->setLoadSheetsOnly([$reader->listWorksheetNames($file->getRealPath())[0]]);
            }
            $reader->setReadFilter(new TemplateReadFilter(self::MAX_ROWS + 1));

            $rows = $reader->load($file->getRealPath())->getActiveSheet()->toArray(null, false, false, false);
        } catch (\Throwable) {
            throw ValidationException::withMessages(['file' => 'This file could not be read. Make sure it is an Excel workbook (.xlsx or .xls) that opens in Excel.']);
        }

        $header = array_map(fn ($cell) => strtolower(trim((string) $cell)), $rows[0] ?? []);
        $isTemplate = array_slice($header, 0, count(self::COLUMNS)) === array_map('strtolower', self::COLUMNS);

        // Not the template: the school's own schedules (class programs, Teachers Program), any file name.
        if (! $isTemplate && in_array($extension, ['xlsx', 'xls'], true)) {
            try {
                $program = $this->classPrograms->read($file->getRealPath(), $file->getClientOriginalName());
            } catch (\Throwable) {
                $program = null;
            }

            if ($program !== null && $program['rows'] !== []) {
                $this->source = 'class_program';
                $this->sectionsFound = $program['sections'];

                return array_slice($program['rows'], 0, self::MAX_ROWS);
            }
        }

        if (! $isTemplate) {
            throw ValidationException::withMessages(['file' => 'No schedule was found in this file. Each schedule needs a TIME column with the days next to it (Monday to Friday, or Monday – Thursday and Friday), like the school\'s class program or Teachers Program, with the section or teacher named above it.']);
        }

        $data = array_values(array_filter(array_slice($rows, 1), fn (array $row) => implode('', array_map(fn ($cell) => trim((string) $cell), $row)) !== ''));

        if (count($data) > self::MAX_ROWS) {
            throw ValidationException::withMessages(['file' => 'A file can have up to '.self::MAX_ROWS.' rows. Split it into smaller files.']);
        }
        if ($data === []) {
            throw ValidationException::withMessages(['file' => 'The file has no rows under the headings.']);
        }

        return $data;
    }

    /**
     * What rows are matched against: the user's sections, their periods, subjects, teachers and rooms.
     *
     * @return array<string, mixed>
     */
    private function context(SchoolTerm $term, User $user): array
    {
        $sections = Section::visibleTo($user)->with('gradeLevel')->where('school_year_id', $term->school_year_id)->get()->keyBy('id');
        $status = DB::table('section_term_status')->where('term_id', $term->id)->pluck('status', 'section_id');

        $teachers = $this->teacherKeys();
        $rooms = $this->roomKeys();

        return [
            'grades' => GradeLevel::whereIn('id', $user->gradeLevelIdsInScope())->pluck('grade')->map(fn ($grade) => (int) $grade)->all(),
            'sections' => $sections,
            'by_name' => $sections->keyBy(fn (Section $section) => $section->gradeLevel->grade.'|'.$this->normal($section->name)),
            'status' => $status,
            'periods' => $sections->map(fn (Section $section) => $this->periodsOf($section)),
            'subjects' => Subject::where('school_year_id', $term->school_year_id)->where('is_active', true)->get(),
            'activities' => Activity::where('school_year_id', $term->school_year_id)->get()->keyBy(fn (Activity $activity) => $this->normal($activity->name)),
            'loadings' => SectionSubject::where('term_id', $term->id)->get()->keyBy(fn (SectionSubject $row) => "{$row->section_id}|{$row->subject_id}"),
            'teachers' => $teachers,
            'rooms' => $rooms,
        ];
    }

    /**
     * @param  array<int, mixed>  $values
     * @param  array<string, int>  $plannedLoadings  teacher chosen in this file for each section and subject
     * @return array<string, mixed>
     */
    private function checkRow(int $rowNumber, array $values, SchoolTerm $term, array $context, array &$plannedLoadings): array
    {
        [$grade, $sectionName, $dayText, $startText, $endText, $subjectName, $teacherName, $roomText] = array_pad(array_map(fn ($cell) => is_string($cell) ? trim($cell) : $cell, $values), 8, null);

        $row = [
            'row' => $rowNumber,
            'section' => trim("Grade {$grade} – {$sectionName}"),
            'day' => (string) $dayText,
            'time' => trim($this->display($startText).' – '.$this->display($endText)),
            'subject' => (string) $subjectName,
            'teacher' => (string) $teacherName,
            'room' => (string) $roomText,
            'status' => 'error',
            'message' => null,
        ];
        $fail = function (string $message) use (&$row) {
            $row['message'] = $message;

            return $row;
        };

        $section = $context['by_name']->get(((int) $grade).'|'.$this->normal((string) $sectionName));
        if (! $section) {
            return $fail(in_array((int) $grade, $context['grades'], true)
                ? "There is no section with this name in Grade {$grade} this school year yet."
                : 'This grade level is not one of yours.');
        }
        if (! in_array($context['status'][$section->id] ?? 'not_started', ['not_started', 'draft'], true)) {
            return $fail('This schedule is '.$context['status'][$section->id].', so it cannot change now.');
        }

        $day = $this->day((string) $dayText);
        $start = $this->time($startText);
        $end = $this->time($endText);
        if (! $day) {
            return $fail('Write the day as Monday to Friday.');
        }
        if (! $start || ! $end || $end <= $start) {
            return $fail('Write the start and end like 7:15 AM, with the end after the start.');
        }

        $period = collect($context['periods'][$section->id])->first(fn (array $item) => $item['day'] === $day && $item['start'] === $start && $item['end'] === $end);
        if (! $period) {
            return $fail('No period of this section\'s bell schedule starts and ends at this time on that day.');
        }

        $activity = $context['activities']->first(fn (Activity $item) => $this->loose($item->name) === $this->loose((string) $subjectName));
        $subject = $activity ? null : $this->subjectFor($context['subjects'], (string) $subjectName, $section, $term);
        if (! $activity && ! $subject) {
            return $fail('This subject or activity is not offered to this section now.');
        }

        $teacherId = null;
        $roomId = null;
        $newLoading = null;

        if ($subject) {
            $loading = $context['loadings']->get("{$section->id}|{$subject->id}");
            $named = filled($teacherName) ? ($context['teachers'][$this->loose((string) $teacherName)] ?? null) : null;

            if (filled($teacherName) && ! $named) {
                return $fail('No active teacher has this name. Check the spelling, or add the teacher first.');
            }

            $teacherId = $loading?->teacher_id ?? $named ?? null;
            if (! $teacherId) {
                return $fail('Write the teacher, since this subject has no teacher loading yet.');
            }
            if ($loading && $named && $named !== $loading->teacher_id) {
                return $fail('The teacher loading gives this subject to someone else. Change it in Teacher Loading first.');
            }

            $key = "{$section->id}|{$subject->id}";
            if (! $loading) {
                if (isset($plannedLoadings[$key]) && $plannedLoadings[$key] !== $teacherId) {
                    return $fail('An earlier row gives this subject in this section to another teacher.');
                }
                $plannedLoadings[$key] = $teacherId;
                $newLoading = $key;
            }

            // No room in the file and no home room yet: the class is kept without one, flagged until the
            // section gets its home room (that fills the room of these classes).
            $roomId = filled($roomText) ? $this->roomFor($context['rooms'], (string) $roomText) : $section->home_room_id;
            if (! $roomId && filled($roomText)) {
                return $fail('No active room has this name.');
            }
        }

        $range = [$this->minutes($start), $this->minutes($end)];
        if (! $this->isFree("section:{$section->id}", $day, $range)) {
            return $fail('The section already has a class at this time.');
        }
        if ($teacherId && ! $this->isFree("teacher:{$teacherId}", $day, $range)) {
            return $fail('The teacher is already teaching another section at this time.');
        }
        if ($roomId && ! $this->isFree("room:{$roomId}", $day, $range)) {
            return $fail('The room is already used by another section at this time.');
        }

        foreach (array_filter(["section:{$section->id}", $teacherId ? "teacher:{$teacherId}" : null, $roomId ? "room:{$roomId}" : null]) as $key) {
            $this->busy[$key][$day][] = $range;
        }

        $row['status'] = 'ok';
        $row['message'] = $activity ? 'Activity' : ($newLoading ? 'Adds teacher loading' : null);
        if (! $activity && ! $roomId) {
            $row['message'] = trim(($row['message'] ? $row['message'].' · ' : '').'No room yet');
        }
        $row['new_loading'] = $newLoading;
        $row['plan'] = [
            'section_id' => $section->id,
            'subject_id' => $subject?->id,
            'activity_id' => $activity?->id,
            'teacher_id' => $teacherId,
            'room_id' => $roomId,
            'day' => $day,
            'start' => $start,
            'end' => $end,
        ];

        return $row;
    }

    private function subjectFor(Collection $subjects, string $name, Section $section, SchoolTerm $term): ?Subject
    {
        return $subjects->first(fn (Subject $subject) => $subject->grade_level_id === $section->grade_level_id
            && $this->subjectKey($subject->name) === $this->subjectKey($name)
            && ($subject->term_no === null || $subject->term_no === $term->term_no)
            && ($subject->track_id === null || $subject->track_id === $section->track_id));
    }

    /** @param  array<string, array{0: string, 1: string}>  $times */
    private function hasOverlap(array $times): bool
    {
        ksort($times);
        $lastEnd = '00:00:00';
        foreach ($times as [$start, $end]) {
            if ($start < $lastEnd) {
                return true;
            }
            $lastEnd = $end;
        }

        return false;
    }

    /** [1, 2, 3, 4] is "Monday – Thursday", [5] "Friday", [1, 3] "Monday, Wednesday". */
    private function daysName(array $days): string
    {
        $names = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday', 7 => 'Sunday'];
        sort($days);
        $isRun = count($days) > 2 && end($days) - $days[0] === count($days) - 1;

        return $isRun
            ? $names[$days[0]].' – '.$names[end($days)]
            : implode(', ', array_map(fn (int $day) => $names[$day], $days));
    }

    /** @return array<int, array{day: int, start: string, end: string}> */
    private function periodsOf(Section $section): array
    {
        $periods = [];
        foreach (DayPattern::forSection($section)->with('timeSlots')->get() as $pattern) {
            foreach ($pattern->day_numbers as $day) {
                foreach ($pattern->timeSlots->where('is_break', false) as $slot) {
                    $periods[] = ['day' => (int) $day, 'start' => substr($slot->start_time, 0, 5).':00', 'end' => substr($slot->end_time, 0, 5).':00'];
                }
            }
        }

        return $periods;
    }

    private function loadBusy(SchoolTerm $term): void
    {
        $this->busy = [];
        foreach (ScheduleEntry::where('term_id', $term->id)->where('status', '<>', 'rejected')->get() as $entry) {
            $range = [$this->minutes($entry->start_time), $this->minutes($entry->end_time)];
            $this->busy["section:{$entry->section_id}"][$entry->day_of_week][] = $range;
            if ($entry->teacher_id) {
                $this->busy["teacher:{$entry->teacher_id}"][$entry->day_of_week][] = $range;
            }
            if ($entry->room_id) {
                $this->busy["room:{$entry->room_id}"][$entry->day_of_week][] = $range;
            }
        }
    }

    private function isFree(string $key, int $day, array $range): bool
    {
        foreach ($this->busy[$key][$day] ?? [] as [$start, $end]) {
            if ($start < $range[1] && $end > $range[0]) {
                return false;
            }
        }

        return true;
    }

    private function day(string $text): ?int
    {
        $text = strtolower(trim($text));
        if (ctype_digit($text) && (int) $text >= 1 && (int) $text <= 5) {
            return (int) $text;
        }
        foreach (self::DAYS as $name => $number) {
            if ($text !== '' && str_starts_with($name, $text) && strlen($text) >= 3) {
                return $number;
            }
        }

        return null;
    }

    /** "7:15 AM", "07:15", "13:00" or an Excel time, as "07:15:00". */
    private function time(mixed $value): ?string
    {
        if (is_numeric($value) && (float) $value < 1) {
            return ExcelDate::excelToDateTimeObject((float) $value)->format('H:i:00');
        }
        if (! preg_match('/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?\.?$/i', trim((string) $value), $match)) {
            return null;
        }

        $hour = (int) $match[1];
        $minute = (int) $match[2];
        $meridiem = strtolower($match[3] ?? '');
        if ($meridiem === 'p' && $hour < 12) {
            $hour += 12;
        }
        if ($meridiem === 'a' && $hour === 12) {
            $hour = 0;
        }

        return $hour < 24 && $minute < 60 ? sprintf('%02d:%02d:00', $hour, $minute) : null;
    }

    private function display(mixed $value): string
    {
        $time = $this->time($value);

        return $time ? ScheduleFormat::time($time) : (string) $value;
    }

    private function minutes(string $time): int
    {
        return (int) substr($time, 0, 2) * 60 + (int) substr($time, 3, 2);
    }

    /**
     * A room written as its label, its number, or its number with a building letter and
     * other words ("C 203 SPEECH LAB").
     *
     * @param  array<string, int>  $rooms
     */
    /** @return array<string, int> each way a teacher's name may be written, to the teacher */
    private function teacherKeys(): array
    {
        $teachers = [];
        foreach (Teacher::where('personnel_type', 'teaching')->where('is_active', true)->orderBy('id')->get() as $teacher) {
            $initial = mb_substr($teacher->first_name, 0, 1);
            foreach ([$teacher->printedName(), "{$teacher->first_name} {$teacher->last_name}", "{$initial}. {$teacher->last_name}", "{$initial} {$teacher->last_name}"] as $name) {
                $teachers[$this->loose($name)] ??= $teacher->id;
            }
        }

        return $teachers;
    }

    /** @return array<string, int> each way a room may be written, to the room. "Building C" rooms also match "C 401". */
    private function roomKeys(): array
    {
        $rooms = [];
        foreach (Room::with('building')->where('is_active', true)->orderBy('id')->get() as $room) {
            $rooms[$this->loose($room->label())] ??= $room->id;
            if (preg_match('/^Building ([A-Z]{1,2})$/i', $room->building->name, $match)) {
                $rooms[$this->loose($match[1].' '.$room->room_number)] ??= $room->id;
            }
            $rooms[$this->loose($room->building->name.' '.$room->room_number)] ??= $room->id;
        }
        foreach (Room::where('is_active', true)->orderBy('id')->get() as $room) {
            $rooms[$this->loose($room->room_number)] ??= $room->id;
        }

        return $rooms;
    }

    /**
     * Creates what the rows name but the system does not have: sections of the user's grade
     * levels, a bell schedule from the file's periods (only where the department has none),
     * subjects (minutes a week as in the file), teachers (name only, to be completed later)
     * and rooms ("C 401" goes to "Building C").
     *
     * @return array{sections: string[], bell_schedules: string[], subjects: string[], teachers: string[], rooms: string[]}
     */
    private function setUpMissing(array $rows, SchoolTerm $term, User $user): array
    {
        $created = ['sections' => [], 'bell_schedules' => [], 'subjects' => [], 'teachers' => [], 'rooms' => []];
        $yearId = $term->school_year_id;
        $levels = GradeLevel::whereIn('id', $user->gradeLevelIdsInScope())->get()->keyBy(fn (GradeLevel $level) => (int) $level->grade);
        $sections = Section::where('school_year_id', $yearId)->get()->keyBy(fn (Section $section) => $section->grade_level_id.'|'.$this->normal($section->name));
        $periods = [];
        $minutes = [];
        $subjectNames = [];
        $teacherNames = [];
        $roomTexts = [];

        foreach ($rows as $values) {
            [$grade, $sectionName, $dayText, $startText, $endText, $subjectName, $teacherName, $roomText] = array_pad(array_map(fn ($cell) => is_string($cell) ? trim($cell) : $cell, $values), 8, null);
            $level = $levels->get((int) $grade);
            $start = $this->time($startText);
            $end = $this->time($endText);
            if (! $level || blank($sectionName) || ! $this->day((string) $dayText) || ! $start || ! $end || $end <= $start) {
                continue;
            }

            $sectionKey = $level->id.'|'.$this->normal((string) $sectionName);
            if (! $sections->has($sectionKey)) {
                $sections[$sectionKey] = Section::create(['school_year_id' => $yearId, 'grade_level_id' => $level->id, 'name' => mb_substr((string) $sectionName, 0, 60), 'shift' => 'WHOLE_DAY']);
                $created['sections'][] = "Grade {$level->grade} – {$sectionName}";
            }
            $periods[$level->level][$this->day((string) $dayText)]["{$start}|{$end}"] = [$start, $end];

            if (filled($subjectName)) {
                $subjectKey = $level->id.'|'.$this->subjectKey((string) $subjectName);
                $minutes[$subjectKey][$sectionKey] = ($minutes[$subjectKey][$sectionKey] ?? 0) + $this->minutes($end) - $this->minutes($start);
                $subjectNames[$subjectKey] ??= [$level, $this->fullSubjectName((string) $subjectName)];
            }
            if (filled($teacherName) && ! in_array($this->loose((string) $teacherName), ['', 'tba', 'na', 'none', 'vacant'], true)) {
                $teacherNames[$this->loose((string) $teacherName)] ??= (string) $teacherName;
            }
            if (filled($roomText)) {
                $roomTexts[$this->loose((string) $roomText)] ??= (string) $roomText;
            }
        }

        // Bell schedules from the file's periods, only for a department that has none yet. Days with the
        // same periods share one, so "Monday – Thursday" (45 minutes) and "Friday" (40 minutes) stay apart.
        foreach ($periods as $level => $days) {
            if (DayPattern::where('school_year_id', $yearId)->where('level', $level)->where('shift', 'WHOLE_DAY')->exists()) {
                continue;
            }

            // A day joins a group when its periods fit with the group's without overlapping, so a day
            // with fewer classes in the file still shares the bell schedule of the others.
            $groups = [];
            ksort($days);
            foreach ($days as $day => $times) {
                // Inside one day, a period that overlaps an earlier one is left out first.
                ksort($times);
                $lastEnd = '00:00:00';
                foreach ($times as $key => [$start, $end]) {
                    if ($start < $lastEnd) {
                        unset($times[$key]);

                        continue;
                    }
                    $lastEnd = $end;
                }
                $placed = false;
                foreach ($groups as &$group) {
                    $merged = $group['times'] + $times;
                    if (! $this->hasOverlap($merged)) {
                        $group['times'] = $merged;
                        $group['days'][] = $day;
                        $placed = true;
                        break;
                    }
                }
                unset($group);
                if (! $placed) {
                    $groups[] = ['days' => [$day], 'times' => $times];
                }
            }
            // Weekdays with no class in the file follow the biggest group.
            if ($groups !== []) {
                usort($groups, fn ($a, $b) => count($b['days']) <=> count($a['days']));
                $listed = array_merge(...array_column($groups, 'days'));
                $groups[0]['days'] = array_values(array_unique([...$groups[0]['days'], ...array_diff([1, 2, 3, 4, 5], $listed)]));
                sort($groups[0]['days']);
                usort($groups, fn ($a, $b) => min($a['days']) <=> min($b['days']));
            }

            foreach ($groups as ['days' => $groupDays, 'times' => $times]) {
                ksort($times);
                $kept = [];
                $lastEnd = '00:00:00';
                foreach ($times as [$start, $end]) {
                    if ($start < $lastEnd) {
                        continue; // overlaps the period before it
                    }
                    $kept[] = [$start, $end];
                    $lastEnd = $end;
                }
                $times = $kept;
                $name = $this->daysName($groupDays);
                $pattern = DayPattern::create(['school_year_id' => $yearId, 'level' => $level, 'shift' => 'WHOLE_DAY', 'name' => $name, 'days' => '{'.implode(',', $groupDays).'}']);
                foreach ($times as $index => [$start, $end]) {
                    TimeSlot::create(['day_pattern_id' => $pattern->id, 'period_no' => $index + 1, 'start_time' => $start, 'end_time' => $end, 'is_break' => false]);
                }
                $created['bell_schedules'][] = ($level === 'SHS' ? 'Senior High' : 'Junior High').", {$name}, ".count($times).' periods';
            }
        }

        $activities = Activity::where('school_year_id', $yearId)->get()->map(fn (Activity $activity) => $this->loose($activity->name))->all();
        $subjects = Subject::where('school_year_id', $yearId)->get();
        foreach ($subjectNames as $subjectKey => [$level, $name]) {
            $termNo = $level->level === 'SHS' ? $term->term_no : null;
            $exists = $subjects->contains(fn (Subject $subject) => $subject->grade_level_id === $level->id
                && $this->subjectKey($subject->name) === $this->subjectKey($name)
                && ($subject->term_no === null || $subject->term_no === $term->term_no));
            if ($exists || in_array($this->loose($name), $activities, true)) {
                continue;
            }
            Subject::create(['school_year_id' => $yearId, 'grade_level_id' => $level->id, 'term_no' => $termNo, 'name' => mb_substr($name, 0, 100), 'minutes_per_week' => min(3000, max($minutes[$subjectKey]))]);
            $created['subjects'][] = "{$name} (Grade {$level->grade})";
        }

        $known = $this->teacherKeys();
        foreach ($teacherNames as $key => $name) {
            if (isset($known[$key])) {
                continue;
            }
            $parts = preg_split('/\s+/', mb_convert_case($name, MB_CASE_TITLE));
            $teacher = count($parts) === 1
                ? ['first_name' => $parts[0], 'last_name' => $parts[0], 'display_name' => $parts[0]]
                : ['first_name' => array_shift($parts), 'last_name' => implode(' ', $parts)];
            $record = Teacher::create(array_map(fn ($part) => mb_substr($part, 0, 60), $teacher) + ['personnel_type' => 'teaching', 'max_subjects' => (int) config('school.max_subjects')]);
            foreach (array_keys($this->teacherKeysOf($record)) as $alias) {
                $known[$alias] ??= $record->id;
            }
            $created['teachers'][] = $name;
        }

        $rooms = $this->roomKeys();
        foreach ($roomTexts as $text) {
            if ($this->roomFor($rooms, $text)) {
                continue;
            }
            if (preg_match('/^([A-Z]{1,2})\s*-?\s*(\d{2,4})\s*(.*)$/i', $text, $match)) {
                $building = Building::firstOrCreate(['name' => 'Building '.strtoupper($match[1])]);
                $room = Room::firstOrCreate(['building_id' => $building->id, 'room_number' => $match[2]], ['room_name' => $match[3] !== '' ? mb_substr(mb_convert_case($match[3], MB_CASE_TITLE), 0, 80) : null]);
                $rooms[$this->loose($match[1].' '.$match[2])] = $room->id;
            } else {
                $building = Building::firstOrCreate(['name' => 'Other rooms']);
                $room = Room::firstOrCreate(['building_id' => $building->id, 'room_number' => mb_substr($text, 0, 20)]);
            }
            $rooms[$this->loose($text)] = $room->id;
            $created['rooms'][] = $text;
        }

        return $created;
    }

    /** @return array<string, true> */
    private function teacherKeysOf(Teacher $teacher): array
    {
        $initial = mb_substr($teacher->first_name, 0, 1);

        return array_fill_keys(array_map(fn ($name) => $this->loose($name), [$teacher->printedName(), "{$teacher->first_name} {$teacher->last_name}", "{$initial}. {$teacher->last_name}"]), true);
    }

    private function roomFor(array $rooms, string $text): ?int
    {
        $candidates = [$text];
        if (preg_match('/([A-Z]{0,2})\s?-?\s?(\d{2,4})/i', $text, $match)) {
            $candidates[] = $match[1].' '.$match[2];
            $candidates[] = $match[2];
        }

        foreach ($candidates as $candidate) {
            if (isset($rooms[$this->loose($candidate)])) {
                return $rooms[$this->loose($candidate)];
            }
        }

        return null;
    }

    /** Short names the school's sheets use, and the subject each one means. */
    private const SUBJECT_ALIASES = [
        'ap' => 'Araling Panlipunan',
        've' => 'Values Education',
        'esp' => 'Edukasyon sa Pagpapakatao',
        'hgp' => 'Homeroom Guidance',
        'hg' => 'Homeroom Guidance',
        'tle' => 'Technology and Livelihood Education',
        'pe' => 'Physical Education',
    ];

    private function fullSubjectName(string $name): string
    {
        return self::SUBJECT_ALIASES[$this->loose($name)] ?? trim($name);
    }

    /** "AP" and "Araling Panlipunan" give the same key, as do "MAPEH" and "Mapeh". */
    private function subjectKey(string $name): string
    {
        return $this->loose($this->fullSubjectName($name));
    }

    /** Only letters and digits count: "Gen. Chem 1", "GEN CHEM 1" and "gen-chem-1" match. */
    private function loose(string $text): string
    {
        return preg_replace('/[^a-z0-9]/', '', strtolower($text));
    }

    /** Case, extra spaces and dashes do not matter when matching names. */
    private function normal(string $text): string
    {
        return preg_replace('/\s+/', ' ', strtolower(trim(str_replace(['–', '—'], '-', $text))));
    }
}
