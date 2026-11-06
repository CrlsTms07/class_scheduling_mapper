<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Only the Admin activates accounts. An Admin cannot change their own access,
     * so the system can never be left without an Admin by accident.
     */
    public function activate(User $actor, User $target): bool
    {
        return $actor->hasRole(User::ROLE_ADMIN) && $actor->isNot($target);
    }
}
