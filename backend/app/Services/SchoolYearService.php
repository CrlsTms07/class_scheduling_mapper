<?php

namespace App\Services;

use App\Models\SchoolTerm;
use App\Models\SchoolYear;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SchoolYearService
{
    public function __construct(
        private AuditLogger $audit,
        private SchoolYearCopyService $copier,
    ) {}

    /**
     * The wizard: creates the year, its terms and the chosen copies in one transaction,
     * so a failure leaves nothing half-made. The active term does not change here, because
     * users should keep seeing the current term until the Admin switches it.
     *
     * @param  array<string, mixed>  $data
     * @return array{year: SchoolYear, copied: array<string, int>}
     */
    public function start(array $data, User $admin): array
    {
        return DB::transaction(function () use ($data, $admin) {
            $year = SchoolYear::create($this->yearValues($data));

            foreach (array_values($data['terms']) as $index => $term) {
                $year->terms()->create([...$term, 'term_no' => $index + 1]);
            }

            $source = isset($data['copy_from_id']) ? SchoolYear::find($data['copy_from_id']) : null;
            $copied = $source ? $this->copier->copy($source, $year, $data['copy'] ?? []) : [];

            $this->audit->log($admin, 'create', 'school_years', $year->id, null, [
                'name' => $year->name,
                'term_count' => $year->term_count,
                'copied_from' => $source?->name,
                'copied' => $copied,
            ]);

            return ['year' => $year, 'copied' => $copied];
        });
    }

    /**
     * Calendar settings. Terms keep their number, so subjects and schedules stay attached
     * to the right term: terms are renamed or re-dated, added at the end, or removed from
     * the end.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateCalendar(SchoolYear $year, array $data, User $admin): SchoolYear
    {
        return DB::transaction(function () use ($year, $data, $admin) {
            $newTerms = array_values($data['terms']);
            $before = $year->only(['name', 'term_count', 'term_label', 'start_date', 'end_date']);

            $removed = $year->terms()->where('term_no', '>', count($newTerms))->get();

            foreach ($removed as $term) {
                $reason = $this->whyTermCannotBeRemoved($term);
                if ($reason !== null) {
                    throw ValidationException::withMessages(['terms' => $reason]);
                }
            }

            SchoolTerm::whereKey($removed->modelKeys())->delete();

            foreach ($newTerms as $index => $term) {
                $year->terms()->updateOrCreate(['term_no' => $index + 1], $term);
            }

            $year->update($this->yearValues($data));

            $this->audit->log($admin, 'update', 'school_years', $year->id, $before, [
                ...$year->only(['name', 'term_count', 'term_label', 'start_date', 'end_date']),
                'removed_terms' => $removed->pluck('name')->all(),
            ]);

            return $year;
        });
    }

    /**
     * Only one term is active at a time. The old one is switched off first because the
     * database refuses two active terms, even for a moment.
     */
    public function activateTerm(SchoolTerm $term, User $admin): void
    {
        if ($term->is_active) {
            return;
        }

        DB::transaction(function () use ($term, $admin) {
            $previous = SchoolTerm::where('is_active', true)->first();

            SchoolTerm::where('is_active', true)->update(['is_active' => false]);
            $term->update(['is_active' => true]);

            $this->audit->log($admin, 'activate', 'school_terms', $term->id,
                ['active_term_id' => $previous?->id],
                ['active_term_id' => $term->id],
            );
        });
    }

    /**
     * The reason a term must stay, in words for the Admin, or null if it can be removed.
     */
    public function whyTermCannotBeRemoved(SchoolTerm $term): ?string
    {
        if ($term->is_active) {
            return "{$term->name} is the active term. Set another term as active first.";
        }

        $scheduled = DB::table('schedule_entries')
            ->join('sections', 'sections.id', '=', 'schedule_entries.section_id')
            ->join('grade_levels', 'grade_levels.id', '=', 'sections.grade_level_id')
            ->where('schedule_entries.term_id', $term->id)
            ->selectRaw("DISTINCT 'Grade ' || grade_levels.grade || ' ' || sections.name AS label, grade_levels.grade, sections.name")
            ->orderBy('grade_levels.grade')
            ->orderBy('sections.name')
            ->pluck('label');

        if ($scheduled->isNotEmpty()) {
            return "{$term->name} already has schedules: {$scheduled->join(', ')}.";
        }

        if (DB::table('section_subjects')->where('term_id', $term->id)->exists()) {
            return "{$term->name} already has teacher loading.";
        }

        if (DB::table('schedule_reviews')->where('term_id', $term->id)->exists()) {
            return "{$term->name} already has approval records.";
        }

        if (DB::table('teacher_tasks')->where('term_id', $term->id)->exists()) {
            return "{$term->name} already has teacher tasks.";
        }

        $subjects = DB::table('subjects')
            ->where('school_year_id', $term->school_year_id)
            ->where('term_no', $term->term_no)
            ->count();

        if ($subjects > 0) {
            return "{$term->name} still has {$subjects} ".($subjects === 1 ? 'subject' : 'subjects').'.';
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function yearValues(array $data): array
    {
        return [
            'name' => $data['name'],
            'term_label' => $data['term_label'],
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'term_count' => count($data['terms']),
        ];
    }
}
