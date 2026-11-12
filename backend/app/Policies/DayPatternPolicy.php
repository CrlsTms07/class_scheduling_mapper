<?php

namespace App\Policies;

use App\Models\User;

/**
 * Bell schedules (day patterns and their time slots). The Admin manages all of them. A Grade
 * Level Chairperson or Master Teacher makes the schedules, so they manage the bell schedules of
 * their own department: Junior High for a Chairperson, Senior High for a Master Teacher.
 */
class DayPatternPolicy
{
    /** With a level, whether that department's bell schedules may change; without, whether the page opens. */
    public function manage(User $user, ?string $level = null): bool
    {
        if ($user->hasRole(User::ROLE_ADMIN)) {
            return true;
        }

        $departments = $user->departmentsInScope();

        return $departments !== null && ($level === null || in_array($level, $departments, true));
    }
}
