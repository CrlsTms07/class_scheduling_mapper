<?php

namespace App\Http\Resources;

use App\Services\AccountService;
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
            // Null until the person accepts the Terms and Conditions; the app asks before anything else.
            'terms_accepted_at' => $this->terms_accepted_at,
            // Set after the Admin gave a temporary password: a new one comes before anything else.
            'must_change_password' => (bool) $this->must_change_password,
            'role' => $this->getRoleNames()->first(),
            'preferences' => [
                // Subjects in color on the schedule. On unless the user turned it off.
                'color_coding' => (bool) ($this->preferences['color_coding'] ?? true),
            ],
            // A waiting sign-up whose name is on the Teachers page: activating links them.
            'matching_personnel' => $this->when($this->status === 'pending', function () {
                $teacher = app(AccountService::class)->matchingTeacher($this->resource);

                return $teacher ? ['id' => $teacher->id, 'name' => trim("{$teacher->first_name} {$teacher->last_name}")] : null;
            }),
            'personnel' => $this->teacher
                ? ['id' => $this->teacher->id, 'name' => $this->teacher->printedName()]
                : null,
            // Only the Users page needs this, so signing in stays light.
            'cannot_delete_reason' => $this->when(
                $request->is('api/users*'),
                fn () => app(AccountService::class)->whyCannotDelete($this->resource),
            ),
            'grade_levels' => $this->gradeLevels->map(fn ($gradeLevel) => [
                'id' => $gradeLevel->id,
                'grade' => $gradeLevel->grade,
                'level' => $gradeLevel->level,
            ])->values(),
        ];
    }
}
