<?php

namespace App\Models;

use App\Support\DepartmentScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Flag Ceremony, Catch-up Friday and the like: they take a period but have no teacher. */
class Activity extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }

    /** The user's department's activities and the school-wide ones. */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        DepartmentScope::apply($query, $user);
    }

    /** Activities a section of this level may get: its department's and the school-wide ones. */
    public function scopeForLevel(Builder $query, string $level): void
    {
        DepartmentScope::applyLevel($query, $level);
    }

    public function isEditableBy(User $user): bool
    {
        return DepartmentScope::canEdit($this->department, $user);
    }
}
