<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Section extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    /**
     * Limits a query to the sections inside the user's grade-level scope.
     * Every query that lists sections for a signed-in user should start from this.
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->whereIn('grade_level_id', $user->gradeLevelIdsInScope());
    }

    public function gradeLevel(): BelongsTo
    {
        return $this->belongsTo(GradeLevel::class);
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }

    public function adviser(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'adviser_id');
    }

    public function homeRoom(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'home_room_id');
    }

    /**
     * For messages and documents, such as "Grade 7 – Honesty".
     */
    public function label(): string
    {
        return "Grade {$this->gradeLevel->grade} – {$this->name}";
    }
}
