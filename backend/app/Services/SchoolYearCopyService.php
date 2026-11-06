<?php

namespace App\Services;

use App\Models\SchoolYear;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Copies the setup of one school year into a new one, for the wizard.
 * Only the options the Admin ticked are copied. Schedules are never copied here.
 */
class SchoolYearCopyService
{
    /**
     * @param  array<string, bool>  $options
     * @return array<string, int>
     */
    public function copy(SchoolYear $from, SchoolYear $to, array $options): array
    {
        $result = [];

        if ($options['subjects'] ?? false) {
            $result += $this->copySubjects($from, $to);
        }
        if ($options['time_slots'] ?? false) {
            $result += $this->copyTimeSlots($from, $to);
        }
        if ($options['signatories'] ?? false) {
            $result += $this->copySignatories($from, $to);
        }
        if ($options['section_names'] ?? false) {
            $result += $this->copySectionNames($from, $to);
        }

        return $result;
    }

    /**
     * A subject of a term the new year does not have (e.g. Third Term into 2 Semesters)
     * is left out and counted, so the Admin knows to encode it again.
     *
     * @return array<string, int>
     */
    private function copySubjects(SchoolYear $from, SchoolYear $to): array
    {
        $subjects = DB::table('subjects')
            ->where('school_year_id', $from->id)
            ->where('is_active', true)
            ->get();

        [$fitting, $skipped] = $subjects->partition(
            fn ($subject) => $subject->term_no === null || $subject->term_no <= $to->term_count,
        );

        DB::table('subjects')->insert($this->rowsFor($fitting, ['school_year_id' => $to->id]));

        return ['subjects' => $fitting->count(), 'subjects_skipped' => $skipped->count()];
    }

    /**
     * @return array<string, int>
     */
    private function copyTimeSlots(SchoolYear $from, SchoolYear $to): array
    {
        $patterns = DB::table('day_patterns')->where('school_year_id', $from->id)->get();
        $slotCount = 0;

        foreach ($patterns as $pattern) {
            $patternId = DB::table('day_patterns')->insertGetId([
                'school_year_id' => $to->id,
                'level' => $pattern->level,
                'shift' => $pattern->shift,
                'name' => $pattern->name,
                'days' => $pattern->days,
            ]);

            $slots = DB::table('time_slots')->where('day_pattern_id', $pattern->id)->get();
            DB::table('time_slots')->insert($this->rowsFor($slots, ['day_pattern_id' => $patternId]));
            $slotCount += $slots->count();
        }

        return ['day_patterns' => $patterns->count(), 'time_slots' => $slotCount];
    }

    /**
     * Signatories are per term. Each new term takes those of the same term number, or
     * of the last term when the new year has more terms than the old one.
     *
     * @return array<string, int>
     */
    private function copySignatories(SchoolYear $from, SchoolYear $to): array
    {
        $sourceTerms = $from->terms()->get()->keyBy('term_no');
        $count = 0;

        foreach ($to->terms()->get() as $term) {
            $source = $sourceTerms->get($term->term_no) ?? $sourceTerms->last();
            $signatories = DB::table('report_signatories')->where('term_id', $source->id)->get();

            DB::table('report_signatories')->insert($this->rowsFor($signatories, ['term_id' => $term->id]));
            $count += $signatories->count();
        }

        return ['signatories' => $count];
    }

    /**
     * "Grade 7 Honesty" becomes "Grade 8 Honesty". The adviser, room and class size stay
     * empty because they change yearly. Grade 12 graduates, so it has no next grade.
     *
     * @return array<string, int>
     */
    private function copySectionNames(SchoolYear $from, SchoolYear $to): array
    {
        $grades = DB::table('grade_levels')->get()->keyBy('grade');

        $sections = DB::table('sections')
            ->join('grade_levels', 'grade_levels.id', '=', 'sections.grade_level_id')
            ->where('sections.school_year_id', $from->id)
            ->select('sections.*', 'grade_levels.grade')
            ->get();

        $rows = $sections
            ->filter(fn ($section) => $grades->has($section->grade + 1))
            ->map(function ($section) use ($grades, $to) {
                $nextGrade = $grades->get($section->grade + 1);

                return [
                    'school_year_id' => $to->id,
                    'grade_level_id' => $nextGrade->id,
                    'track_id' => $nextGrade->level === 'SHS' ? $section->track_id : null,
                    'name' => $section->name,
                    'shift' => $section->shift,
                ];
            });

        DB::table('sections')->insert($rows->values()->all());

        return ['sections' => $rows->count()];
    }

    /**
     * Copies of database rows: no id, so each gets a new one, and with some columns changed.
     *
     * @param  array<string, mixed>  $changes
     * @return array<int, array<string, mixed>>
     */
    private function rowsFor(Collection $rows, array $changes): array
    {
        return $rows
            ->map(fn ($row) => [...collect($row)->except('id')->all(), ...$changes])
            ->values()
            ->all();
    }
}
