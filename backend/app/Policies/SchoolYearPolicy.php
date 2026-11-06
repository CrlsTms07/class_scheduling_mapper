<?php

namespace App\Policies;

use App\Models\User;

class SchoolYearPolicy
{
    /**
     * Only the Admin manages school years and terms. Everyone else only reads terms
     * through the term selector.
     */
    public function manage(User $user): bool
    {
        return $user->hasRole(User::ROLE_ADMIN);
    }
}
