<?php

namespace App\Policies;

use App\Models\Section;
use App\Models\User;

class SectionPolicy
{
    /**
     * The Admin and schedulers can view sections inside their grade-level scope.
     */
    public function view(User $user, Section $section): bool
    {
        return in_array($section->grade_level_id, $user->gradeLevelIdsInScope());
    }

    /**
     * The Admin plots any section (team decision, Nov 10, 2026). A Chairperson or Master
     * Teacher plots the sections of their own grade levels.
     */
    public function plot(User $user, Section $section): bool
    {
        return $user->hasAnyRole([User::ROLE_ADMIN, 'glc', 'master_teacher']) && $this->view($user, $section);
    }

    /**
     * Sections are encoded once per school year: by the Admin for every grade, and by a
     * Chairperson or Master Teacher for their own grade levels (team decision, Nov 10, 2026).
     * Without a grade level, this asks whether the user may manage sections at all.
     */
    public function manage(User $user, ?int $gradeLevelId = null): bool
    {
        if ($user->hasRole(User::ROLE_ADMIN)) {
            return true;
        }

        return $user->hasAnyRole(['glc', 'master_teacher'])
            && ($gradeLevelId === null || in_array($gradeLevelId, $user->gradeLevelIdsInScope()));
    }

    /**
     * Only the Admin approves, rejects or reopens schedules.
     */
    public function review(User $user): bool
    {
        return $user->hasRole(User::ROLE_ADMIN);
    }
}
