<?php

namespace App\Services;

use App\Exceptions\ScheduleConflictException;
use App\Models\ScheduleEntry;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\TimeSlot;
use App\Models\User;
use App\Support\ScheduleFormat;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ScheduleService
{
    private const EXCLUSION_VIOLATION = '23P01';

    public function __construct(
        private ConflictService $conflicts,
        private FlagService $flags,
        private AuditLogger $audit,
    ) {}

    /**
     * Places a subject in a time slot: one entry per selected day. What the section
     * already has at that time is replaced. Either every day is saved, or none.
     *
     * @param  array<int, int>  $days
     */
    public function assign(int $termId, Section $section, TimeSlot $slot, SectionSubject $loading, int $roomId, array $days, User $user): void
    {
        $this->rejectUnlessEditable($termId, $section);
        $this->stopOnConflict($termId, $section, $slot, $loading->teacher_id, $roomId, $days);

        try {
            DB::transaction(function () use ($termId, $section, $slot, $loading, $roomId, $days, $user) {
                $this->ownEntries($termId, $section, $slot, $days)->delete();

                foreach ($days as $day) {
                    ScheduleEntry::create([
                        'term_id' => $termId,
                        'section_id' => $section->id,
                        'section_subject_id' => $loading->id,
                        'teacher_id' => $loading->teacher_id,
                        'room_id' => $roomId,
                        'day_of_week' => $day,
                        'start_time' => $slot->start_time,
                        'end_time' => $slot->end_time,
                        'created_by' => $user->id,
                    ]);
                }
            });
        } catch (QueryException $exception) {
            if ($exception->getCode() !== self::EXCLUSION_VIOLATION) {
                throw $exception;
            }

            // Another user saved the same teacher or room after our check above.
            $this->stopOnConflict($termId, $section, $slot, $loading->teacher_id, $roomId, $days);

            throw $exception;
        }
    }

    /**
     * Empties a time slot on the selected days.
     *
     * @param  array<int, int>  $days
     */
    public function clear(int $termId, Section $section, TimeSlot $slot, array $days): void
    {
        $this->rejectUnlessEditable($termId, $section);

        $this->ownEntries($termId, $section, $slot, $days)->delete();
    }

    /**
     * Sends the section's draft entries to the Admin. Every flag must be fixed or
     * acknowledged first, and open slots must be filled.
     *
     * @param  array<int, string>  $acknowledgedKeys
     * @return int The number of entries submitted.
     */
    public function submit(int $termId, Section $section, array $acknowledgedKeys, ?string $note, User $user): int
    {
        if ($this->statusOf($termId, $section) !== 'draft') {
            throw ValidationException::withMessages(['section' => 'Only a draft schedule can be submitted.']);
        }

        $flags = collect($this->flags->forSection($section, $termId));
        $blocking = $flags->where('blocking', true);

        if ($blocking->isNotEmpty()) {
            throw ValidationException::withMessages(['section' => $blocking->first()['message'].' Fill them before submitting.']);
        }

        $needed = $flags->where('acknowledged', false);
        $missing = $needed->whereNotIn('key', $acknowledgedKeys);

        if ($missing->isNotEmpty()) {
            throw new HttpResponseException(response()->json([
                'message' => 'Fix or acknowledge every flag before submitting.',
                'code' => 'flags_not_acknowledged',
                'flags' => $missing->values(),
            ], 422));
        }

        return DB::transaction(function () use ($termId, $section, $needed, $note, $user) {
            foreach ($needed as $flag) {
                DB::table('schedule_flag_acknowledgements')->insert([
                    'term_id' => $termId,
                    'section_id' => $section->id,
                    'flag_key' => $flag['key'],
                    'note' => $note,
                    'acknowledged_by' => $user->id,
                ]);
            }

            $count = ScheduleEntry::where('term_id', $termId)
                ->where('section_id', $section->id)
                ->where('status', 'draft')
                ->update(['status' => 'pending']);

            $this->audit->log($user, 'submit', 'schedule_entries', $section->id, null, [
                'term_id' => $termId,
                'entries' => $count,
                'acknowledged_flags' => $needed->pluck('key')->values(),
            ]);

            return $count;
        });
    }

    /**
     * Brings a rejected schedule back to draft so it can be fixed. A rejected entry
     * does not hold its teacher or room, so someone else may have taken them. Those
     * entries are removed and reported instead of blocking the whole section.
     *
     * @return array<int, string> Messages for the entries that could not come back.
     */
    public function revise(int $termId, Section $section, User $user): array
    {
        if ($this->statusOf($termId, $section) !== 'rejected') {
            throw ValidationException::withMessages(['section' => 'Only a rejected schedule can be revised.']);
        }

        return DB::transaction(function () use ($termId, $section, $user) {
            $removed = [];

            $entries = ScheduleEntry::with('sectionSubject.subject')
                ->where('term_id', $termId)
                ->where('section_id', $section->id)
                ->where('status', 'rejected')
                ->orderBy('day_of_week')
                ->orderBy('start_time')
                ->get();

            foreach ($entries as $entry) {
                $conflicts = $this->conflicts->findConflicts(
                    $termId, $section, (int) $entry->teacher_id, (int) $entry->room_id,
                    [$entry->day_of_week], $entry->start_time, $entry->end_time,
                );

                if ($conflicts === []) {
                    $entry->update(['status' => 'draft']);

                    continue;
                }

                $subject = $entry->sectionSubject?->subject->name ?? 'Open slot';
                $removed[] = "{$subject} was removed: {$conflicts[0]['message']}";
                $entry->delete();
            }

            $this->audit->log($user, 'revise', 'schedule_entries', $section->id, null, [
                'term_id' => $termId,
                'restored' => $entries->count() - count($removed),
                'removed' => $removed,
            ]);

            return $removed;
        });
    }

    /**
     * @param  array<int, int>  $days
     */
    private function stopOnConflict(int $termId, Section $section, TimeSlot $slot, int $teacherId, int $roomId, array $days): void
    {
        $conflicts = $this->conflicts->findConflicts($termId, $section, $teacherId, $roomId, $days, $slot->start_time, $slot->end_time);

        if ($conflicts !== []) {
            throw new ScheduleConflictException(
                $conflicts,
                $this->conflicts->suggest($termId, $section, $slot, $teacherId, $roomId, $days),
            );
        }
    }

    /**
     * Only a schedule still being worked on can change. Submitted and approved schedules
     * wait for the Admin, and a rejected one must be revised first.
     */
    private function rejectUnlessEditable(int $termId, Section $section): void
    {
        $status = $this->statusOf($termId, $section);

        if (! in_array($status, ['not_started', 'draft'])) {
            throw ValidationException::withMessages([
                'days' => "This schedule is {$status} and cannot be changed.",
            ]);
        }
    }

    private function statusOf(int $termId, Section $section): ?string
    {
        return DB::table('section_term_status')
            ->where('term_id', $termId)
            ->where('section_id', $section->id)
            ->value('status');
    }

    /**
     * @param  array<int, int>  $days
     */
    private function ownEntries(int $termId, Section $section, TimeSlot $slot, array $days): Builder
    {
        return ScheduleEntry::query()
            ->where('term_id', $termId)
            ->where('section_id', $section->id)
            ->whereIn('day_of_week', $days)
            ->where('start_time', '<', $slot->end_time)
            ->where('end_time', '>', $slot->start_time);
    }
}
