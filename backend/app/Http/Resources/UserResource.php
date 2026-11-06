<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'last_name' => $this->last_name,
            'suffix' => $this->suffix,
            'status' => $this->status,
            'role' => $this->getRoleNames()->first(),
            'personnel' => $this->teacher
                ? ['id' => $this->teacher->id, 'name' => $this->teacher->printedName()]
                : null,
            'grade_levels' => $this->gradeLevels->map(fn ($gradeLevel) => [
                'id' => $gradeLevel->id,
                'grade' => $gradeLevel->grade,
                'level' => $gradeLevel->level,
            ])->values(),
        ];
    }
}
