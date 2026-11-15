<?php

namespace App\Models;

use App\Support\DepartmentScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Building extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }

    /** The user's department's buildings and the shared ones. */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        DepartmentScope::apply($query, $user);
    }

    public function isEditableBy(User $user): bool
    {
        return DepartmentScope::canEdit($this->department, $user);
    }
}
