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
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ScheduleService
{
    private const EXCLUSION_VIOLATION = '23P01';

    public function __construct(private ConflictService $conflicts) {}

    /**
     * Places a subject in a time slot: one entry per selected day. What the section
     * already has at that time is replaced. Either every day is saved, or none.
     *
     * @param  array<int, int>  $days
     */
    public function assign(int $termId, Section $section, TimeSlot $slot, SectionSubject $loading, int $roomId, array $days, User $user): void
    {
        $this->rejectIfLocked($termId, $section, $slot, $days);
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
        $this->rejectIfLocked($termId, $section, $slot, $days);

        $this->ownEntries($termId, $section, $slot, $days)->delete();
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
     * Submitted and approved entries cannot change until the Admin rejects or reopens them.
     *
     * @param  array<int, int>  $days
     */
    private function rejectIfLocked(int $termId, Section $section, TimeSlot $slot, array $days): void
    {
        $locked = $this->ownEntries($termId, $section, $slot, $days)
            ->whereIn('status', ['pending', 'approved'])
            ->orderBy('day_of_week')
            ->first();

        if ($locked) {
            $day = ScheduleFormat::dayName($locked->day_of_week);

            throw ValidationException::withMessages([
                'days' => "The {$day} entry is {$locked->status} and cannot be changed.",
            ]);
        }
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
