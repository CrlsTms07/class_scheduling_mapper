<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Room extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    public function building(): BelongsTo
    {
        return $this->belongsTo(Building::class);
    }

    /** Rooms in the user's department's buildings and in shared ones: the rooms they may use. */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->whereHas('building', fn (Builder $building) => $building->visibleTo($user));
    }

    /** Rooms a section of this level (JHS or SHS) may use: its department's and the shared ones. */
    public function scopeForLevel(Builder $query, string $level): void
    {
        $query->whereHas('building', fn (Builder $building) => \App\Support\DepartmentScope::applyLevel($building, $level));
    }

    public function label(): string
    {
        return "{$this->building->name} – {$this->room_number}";
    }
}
