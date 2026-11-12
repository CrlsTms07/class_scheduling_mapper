<?php

namespace App\Http\Resources;

use App\Services\TimeSlotService;
use App\Support\ScheduleFormat;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DayPatternResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $service = app(TimeSlotService::class);

        return [
            'id' => $this->id,
            'level' => $this->level,
            'shift' => $this->shift,
            'name' => $this->name,
            'days' => $this->day_numbers,
            'locked_reason' => $service->whyLocked($this->resource),
            'slots' => $this->timeSlots->map(fn ($slot) => [
                'id' => $slot->id,
                'period_no' => $slot->period_no,
                'label' => $slot->label,
                'start_time' => ScheduleFormat::shortTime($slot->start_time),
                'end_time' => ScheduleFormat::shortTime($slot->end_time),
                'minutes' => ScheduleFormat::minutesBetween($slot->start_time, $slot->end_time),
                'is_break' => $slot->is_break,
                'locked_reason' => $service->whySlotLocked($slot),
            ])->values(),
        ];
    }
}
