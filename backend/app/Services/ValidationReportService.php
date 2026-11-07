<?php

namespace App\Services;

use App\Exports\ReportSheet;
use App\Models\ScheduleEntry;
use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\User;
use App\Support\ScheduleFormat;
use Illuminate\Support\Facades\DB;

/**
 * Everything that needs checking in a term, for the grade levels of the user.
 *
 * The database never lets two saved entries clash. The one way a hard conflict can appear is a
 * rejected entry, which holds no teacher or room, so someone else may have taken them since.
 */
class ValidationReportService
{
    private const STATUS_LABELS = [
        'not_started' => 'Not started',
        'draft' => 'Draft',
        'pending' => 'Pending approval',
        'approved' => 'Approved',
        'rejected' => 'Rejected',
    ];

    public function __construct(
        private ApprovalService $approvals,
        private ConflictService $conflicts,
        private ReportService $reports,
        private ReportSettingsService $settings,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function forUser(SchoolTerm $term, User $user): array
    {
        $term->loadMissing('schoolYear');

        $overview = collect($this->approvals->overview($term, $user->gradeLevelIdsInScope()));

        $sections = $overview
            ->map(fn (array $section) => [
                'id' => $section['id'],
                'label' => $section['label'],
                'status' => $section['status'],
                'status_label' => self::STATUS_LABELS[$section['status']],
                'issues' => [
                    ...$this->rejectedConflicts($term, $section),
                    ...array_map(fn (array $flag) => [
                        'message' => $flag['message'],
                        'severity' => $flag['severity'],
                        'level' => $this->levelOf($flag),
                        'acknowledged' => $flag['acknowledged'],
                    ], $section['flags']),
                ],
            ])
            ->filter(fn (array $section) => $section['issues'] !== [])
            ->values();

        $issues = $sections->flatMap(fn (array $section) => $section['issues']);

        return [
            'summary' => [
                'sections' => $overview->count(),
                'sections_with_issues' => $sections->count(),
                'issues' => $issues->count(),
                'urgent' => $issues->where('severity', 'red')->count(),
                'not_acknowledged' => $issues->where('acknowledged', false)->count(),
            ],
            'sections' => $sections->all(),
            'term_label' => "{$term->name}, School Year {$term->schoolYear->name}",
        ];
    }

    /**
     * @param  array<string, mixed>  $section
     * @return array<int, array<string, mixed>>
     */
    private function rejectedConflicts(SchoolTerm $term, array $section): array
    {
        if ($section['status'] !== 'rejected') {
            return [];
        }

        $model = Section::find($section['id']);

        return ScheduleEntry::with('sectionSubject.subject')
            ->where('term_id', $term->id)
            ->where('section_id', $section['id'])
            ->where('status', 'rejected')
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get()
            ->flatMap(function (ScheduleEntry $entry) use ($term, $model) {
                $clashes = $this->conflicts->findConflicts(
                    $term->id, $model, (int) $entry->teacher_id, (int) $entry->room_id,
                    [$entry->day_of_week], $entry->start_time, $entry->end_time,
                );
                $subject = $entry->sectionSubject?->subject->name ?? 'Open slot';
                $when = ScheduleFormat::dayName($entry->day_of_week).' at '.ScheduleFormat::time($entry->start_time);

                return array_map(fn (array $clash) => [
                    'message' => "{$subject} on {$when} can no longer return: {$clash['message']}",
                    'severity' => 'red',
                    'level' => 'Conflict',
                    'acknowledged' => false,
                ], $clashes);
            })
            ->all();
    }

    /**
     * @param  array<string, mixed>  $flag
     */
    private function levelOf(array $flag): string
    {
        return match (true) {
            $flag['blocking'] => 'Must fix',
            $flag['severity'] === 'red' => 'Urgent',
            default => 'To check',
        };
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function pdf(array $data): string
    {
        return $this->reports->renderPdf('reports.validation', [
            ...$data,
            'school' => DB::table('school_profile')->first(),
            'logos' => $this->settings->logoDataUris(),
            'title' => 'CONFLICT AND VALIDATION REPORT',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function sheet(array $data): ReportSheet
    {
        $rows = [
            [DB::table('school_profile')->value('school_name')],
            ['CONFLICT AND VALIDATION REPORT'],
            [$data['term_label']],
            [],
            ['Section', 'Status', 'Level', 'Issue', 'Acknowledged'],
        ];

        foreach ($data['sections'] as $section) {
            foreach ($section['issues'] as $issue) {
                $rows[] = [$section['label'], $section['status_label'], $issue['level'], $issue['message'], $issue['acknowledged'] ? 'Yes' : 'No'];
            }
        }

        $last = count($rows);

        return new ReportSheet(
            title: 'Validation',
            rows: $rows,
            merged: ['A1:E1', 'A2:E2', 'A3:E3'],
            centered: ['A1:E3'],
            bordered: ["A5:E{$last}"],
            headers: ['A5:E5'],
            columnWidths: [26, 16, 12, 70, 14],
        );
    }
}
