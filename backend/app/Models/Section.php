<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Section extends Model
{
    public $timestamps = false;

    /**
     * Limits a query to the sections inside the user's grade-level scope.
     * Every query that lists sections for a signed-in user should start from this.
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->whereIn('grade_level_id', $user->gradeLevelIdsInScope());
    }
}
