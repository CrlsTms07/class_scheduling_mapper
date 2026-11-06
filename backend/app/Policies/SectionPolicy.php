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
     * Only a GLC or Master Teacher plots. The Admin approves but does not plot.
     */
    public function plot(User $user, Section $section): bool
    {
        return $user->hasAnyRole(['glc', 'master_teacher']) && $this->view($user, $section);
    }

    /**
     * Only the Admin encodes sections, once per school year.
     */
    public function manage(User $user): bool
    {
        return $user->hasRole(User::ROLE_ADMIN);
    }

    /**
     * Only the Admin approves, rejects or reopens schedules.
     */
    public function review(User $user): bool
    {
        return $user->hasRole(User::ROLE_ADMIN);
    }
}
