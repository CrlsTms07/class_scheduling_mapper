<?php

namespace App\Services;

use App\Models\DayPattern;
use App\Models\Room;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Starts a term's schedules from another term of the same school year.
 *
 * Periods are copied as draft open slots, with the same day, time and room. A section that
 * already has a schedule in the target term is never touched. If asked, teachers of subjects
 * that continue are copied too, and their slots are filled in.
 */
class TermCopyService
{
    private const EXCLUSION_VIOLATION = '23P01';

    public function __construct(
        private ConflictService $conflicts,
        private TeacherLoadingService $loading,
        private AuditLogger $audit,
    ) {}

    /**
     * A preview runs the real copy and undoes it, so its numbers are always the real ones.
     *
     * @return array<string, mixed>
     */
    public function copy(SchoolTerm $target, SchoolTerm $source, ?int $sectionId, ?int $grade, bool $fillSubjects, bool $isPreview, User $user): array
    {
        DB::beginTransaction();

        try {
            $result = $this->run($target, $source, $sectionId, $grade, $fillSubjects, $user);
        } catch (QueryException $exception) {
            DB::rollBack();

            if ($exception->getCode() !== self::EXCLUSION_VIOLATION) {
                throw $exception;
            }

            // Someone else plotted a teacher or room after the check.
            throw ValidationException::withMessages([
                'from_term_id' => 'Someone just changed a schedule in this term. Please try again.',
            ]);
        } catch (\Throwable $exception) {
            DB::rollBack();

            throw $exception;
        }

        $isPreview ? DB::rollBack() : DB::commit();

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    private function run(SchoolTerm $target, SchoolTerm $source, ?int $sectionId, ?int $grade, bool $fillSubjects, User $user): array
    {
        $sections = Section::visibleTo($user)
            ->with('gradeLevel')
            ->where('school_year_id', $target->school_year_id)
            ->when($sectionId, fn ($query) => $query->whereKey($sectionId))
            ->when($grade, fn ($query) => $query->whereHas('gradeLevel', fn ($level) => $level->where('grade', $grade)))
            ->get()
            ->sortBy(fn (Section $section) => [$section->gradeLevel->grade, $section->name])
            ->keyBy('id');

        $statuses = DB::table('section_term_status')->where('term_id', $target->id)->pluck('status', 'section_id');
        [$free, $skipped] = $sections->partition(fn (Section $section) => ($statuses[$section->id] ?? 'not_started') === 'not_started');

        $entries = ScheduleEntry::with('sectionSubject')
            ->where('term_id', $source->id)
            ->whereIn('section_id', $free->keys())
            ->where('status', '<>', 'rejected')
            ->orderBy('section_id')
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get();

        $copying = $free->filter(fn (Section $section) => $entries->contains('section_id', $section->id));

        $loadingCopied = $fillSubjects && $copying->isNotEmpty()
            ? $this->loading->copyFromTerm($target, $source, $copying->keys()->all(), $user)['copied']
            : 0;

        $counts = $this->copyEntries($target, $copying, $entries, $fillSubjects, $user);

        $result = [
            'sections_copied' => $copying->count(),
            'sections_with_schedule' => $skipped->map(fn (Section $section) => $section->label())->values()->all(),
            'sections_with_nothing' => $free->count() - $copying->count(),
            ...$counts,
            'loading_copied' => $loadingCopied,
        ];

        $this->audit->log($user, 'copy', 'schedule_entries', $target->id, null, [
            'from_term_id' => $source->id,
            'section_id' => $sectionId,
            'grade' => $grade,
            'fill_subjects' => $fillSubjects,
            ...$result,
        ]);

        return $result;
    }

    /**
     * @param  Collection<int, Section>  $sections
     * @param  Collection<int, ScheduleEntry>  $entries
     * @return array{entries: int, filled: int, open_slots: int, left_open: int, not_fitting: int}
     */
    private function copyEntries(SchoolTerm $target, Collection $sections, Collection $entries, bool $fillSubjects, User $user): array
    {
        $counts = ['entries' => 0, 'filled' => 0, 'open_slots' => 0, 'left_open' => 0, 'not_fitting' => 0];

        $loadings = SectionSubject::where('term_id', $target->id)
            ->whereIn('section_id', $sections->keys())
            ->get()
            ->keyBy(fn (SectionSubject $row) => "{$row->section_id}|{$row->subject_id}");

        $activeRooms = Room::where('is_active', true)->pluck('id')->flip();
        $periods = $sections->map(fn (Section $section) => $this->periodsOf($section));

        foreach ($entries as $entry) {
            $section = $sections[$entry->section_id];

            // Bell schedules are per year, so they may have been edited since the source was made.
            if (! isset($periods[$section->id]["{$entry->day_of_week}|{$entry->start_time}|{$entry->end_time}"])) {
                $counts['not_fitting']++;

                continue;
            }

            $subjectId = $entry->sectionSubject?->subject_id;
            $loading = $fillSubjects && $subjectId ? $loadings->get("{$section->id}|{$subjectId}") : null;
            $roomId = $entry->room_id !== null && $activeRooms->has($entry->room_id) ? $entry->room_id : null;

            $clashes = collect($this->conflicts->findConflicts(
                $target->id, $section, (int) $loading?->teacher_id, (int) $roomId,
                [$entry->day_of_week], $entry->start_time, $entry->end_time,
            ))->pluck('type');

            if ($clashes->contains('room')) {
                $roomId = null;
            }

            // A filled class needs both its teacher and a room. Otherwise the user decides.
            $isFilled = $loading !== null && $roomId !== null && ! $clashes->contains('teacher');

            if ($loading !== null && ! $isFilled) {
                $counts['left_open']++;
            }

            ScheduleEntry::create([
                'term_id' => $target->id,
                'section_id' => $section->id,
                'section_subject_id' => $isFilled ? $loading->id : null,
                'teacher_id' => $isFilled ? $loading->teacher_id : null,
                'room_id' => $roomId,
                'day_of_week' => $entry->day_of_week,
                'start_time' => $entry->start_time,
                'end_time' => $entry->end_time,
                'created_by' => $user->id,
                'copied_from_id' => $entry->id,
            ]);

            $counts['entries']++;
            $counts[$isFilled ? 'filled' : 'open_slots']++;
        }

        return $counts;
    }

    /**
     * The class periods this section has now, as "day|start|end".
     *
     * @return array<string, true>
     */
    private function periodsOf(Section $section): array
    {
        $periods = [];

        foreach (DayPattern::forSection($section)->with('timeSlots')->get() as $pattern) {
            foreach ($pattern->day_numbers as $day) {
                foreach ($pattern->timeSlots->where('is_break', false) as $slot) {
                    $periods["{$day}|{$slot->start_time}|{$slot->end_time}"] = true;
                }
            }
        }

        return $periods;
    }
}
