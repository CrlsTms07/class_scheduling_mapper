<?php

namespace App\Http\Resources;

use App\Services\SectionService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A section on the Admin's Sections page.
 */
class ManagedSectionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'label' => $this->label(),
            'grade_level_id' => $this->grade_level_id,
            'grade' => $this->gradeLevel->grade,
            'level' => $this->gradeLevel->level,
            'shift' => $this->shift,
            'track_id' => $this->track_id,
            'track' => $this->track?->name,
            'adviser_id' => $this->adviser_id,
            'adviser' => $this->adviser?->printedName(),
            'co_adviser_id' => $this->co_adviser_id,
            'co_adviser' => $this->coAdviser?->printedName(),
            'home_room_id' => $this->home_room_id,
            'home_room' => $this->homeRoom?->label(),
            'class_size' => $this->class_size,
            'locked_reason' => app(SectionService::class)->whyLocked($this->resource),
        ];
    }
}
