<?php

namespace App\Policies;

use App\Models\Subject;
use App\Models\User;

class SubjectPolicy
{
    /**
     * The Admin sees every subject. A scheduler sees those of their own grade levels.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole([User::ROLE_ADMIN, 'glc', 'master_teacher']);
    }

    /**
     * The Admin manages every subject; a Chairperson or Master Teacher those of their own
     * grade levels only.
     */
    public function manageGrade(User $user, Subject|int $subjectOrGradeLevelId): bool
    {
        // A subject of the other level is the Admin's to change (Nov 21, 2026).
        $own = $user->departmentsInScope();
        if ($subjectOrGradeLevelId instanceof Subject && $own !== null && $subjectOrGradeLevelId->level !== null && ! in_array($subjectOrGradeLevelId->level, $own, true)) {
            return false;
        }

        $gradeLevelId = $subjectOrGradeLevelId instanceof Subject
            ? $subjectOrGradeLevelId->grade_level_id
            : $subjectOrGradeLevelId;

        // A subject with no grade is for every grade (Nov 21, 2026), so every scheduler shares it.
        return $user->hasAnyRole([User::ROLE_ADMIN, 'glc', 'master_teacher'])
            && ($gradeLevelId === null || in_array($gradeLevelId, $user->gradeLevelIdsInScope()));
    }
}
