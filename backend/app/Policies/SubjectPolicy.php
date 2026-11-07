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
     * A Chairperson or Master Teacher manages the subjects of their own grade levels only.
     */
    public function manageGrade(User $user, Subject|int $subjectOrGradeLevelId): bool
    {
        $gradeLevelId = $subjectOrGradeLevelId instanceof Subject
            ? $subjectOrGradeLevelId->grade_level_id
            : $subjectOrGradeLevelId;

        return $user->hasAnyRole(['glc', 'master_teacher'])
            && in_array($gradeLevelId, $user->gradeLevelIdsInScope());
    }
}
