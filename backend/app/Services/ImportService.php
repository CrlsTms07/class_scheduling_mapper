<?php

namespace App\Services;

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * "Import previous data" for a Chairperson or Master Teacher: the teacher loading of their
 * grade levels, from any earlier term, even of last school year.
 *
 * Subjects, sections and bell schedules already belong to the school year (the Admin's
 * Start New School Year wizard copies them), so only who-teaches-what needs copying.
 * Plotted schedules are never copied: plotting starts as a new draft.
 */
class ImportService
{
    public function __construct(private AuditLogger $audit) {}

    /**
     * Within one school year a section and subject are the same records. Across years, a
     * section is matched by grade and name, and a subject by grade, track and name.
     *
     * @return array<string, mixed>
     */
    public function importLoading(SchoolTerm $term, SchoolTerm $from, User $user, bool $isPreview): array
    {
        $result = [
            'copied' => 0, 'already_set' => 0, 'no_section' => 0, 'no_subject' => 0,
            'not_offered' => 0, 'teacher_unavailable' => 0, 'sections' => 0, 'missing' => [],
        ];

        DB::beginTransaction();

        try {
            $targets = Section::visibleTo($user)
                ->where('school_year_id', $term->school_year_id)
                ->get()
                ->keyBy(fn (Section $section) => "{$section->grade_level_id}|{$section->name}");

            $sources = SectionSubject::with(['section', 'subject.track', 'teacher'])
                ->where('term_id', $from->id)
                ->whereHas('section', fn ($query) => $query->visibleTo($user))
                ->get();

            $subjects = $this->subjectsOf($term);
            $existing = SectionSubject::where('term_id', $term->id)
                ->get()
                ->map(fn (SectionSubject $row) => "{$row->section_id}|{$row->subject_id}")
                ->flip();
            $sectionsCopied = [];

            foreach ($sources as $source) {
                $section = $targets->get("{$source->section->grade_level_id}|{$source->section->name}");
                $subject = $section ? $this->matchSubject($subjects, $source->subject, $section) : null;

                $outcome = match (true) {
                    $section === null => 'no_section',
                    $subject === null => 'no_subject',
                    $existing->has("{$section->id}|{$subject->id}") => 'already_set',
                    ! $this->isOffered($subject, $term, $section) => 'not_offered',
                    $source->teacher->personnel_type !== 'teaching' || ! $source->teacher->is_active => 'teacher_unavailable',
                    default => 'copied',
                };

                $result[$outcome]++;

                if ($outcome === 'no_section' || $outcome === 'no_subject') {
                    $result['missing'][] = $outcome === 'no_section'
                        ? "Section {$source->section->name} is not in this school year."
                        : "{$source->subject->name} is not a subject of this school year.";
                }

                if ($outcome === 'copied') {
                    SectionSubject::create([
                        'term_id' => $term->id,
                        'section_id' => $section->id,
                        'subject_id' => $subject->id,
                        'teacher_id' => $source->teacher_id,
                    ]);
                    $existing->put("{$section->id}|{$subject->id}", true);
                    $sectionsCopied[$section->id] = true;
                }
            }

            $result['sections'] = count($sectionsCopied);
            $result['missing'] = array_values(array_unique($result['missing']));

            if (! $isPreview) {
                $this->audit->log($user, 'import', 'section_subjects', $term->id, null, [
                    'from_term_id' => $from->id,
                    ...collect($result)->except('missing')->all(),
                ]);
            }

            $isPreview ? DB::rollBack() : DB::commit();
        } catch (\Throwable $exception) {
            DB::rollBack();

            throw $exception;
        }

        return $result;
    }

    /**
     * @return Collection<int, Subject>
     */
    private function subjectsOf(SchoolTerm $term): Collection
    {
        return Subject::with('track')->where('school_year_id', $term->school_year_id)->get();
    }

    private function matchSubject(Collection $subjects, Subject $source, Section $section): ?Subject
    {
        if ($source->school_year_id === $section->school_year_id) {
            return $subjects->firstWhere('id', $source->id);
        }

        return $subjects->first(fn (Subject $subject) => $subject->grade_level_id === $section->grade_level_id
            && $subject->name === $source->name
            && $subject->track?->name === $source->track?->name);
    }

    private function isOffered(Subject $subject, SchoolTerm $term, Section $section): bool
    {
        return $subject->is_active
            && ($subject->term_no === null || $subject->term_no === $term->term_no)
            && ($subject->track_id === null || $subject->track_id === $section->track_id);
    }
}
