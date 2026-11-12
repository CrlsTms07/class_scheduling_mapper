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

    public function coAdviser(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'co_adviser_id');
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
    /**
     * The label a viewer may see. Junior High and Senior High stay apart (team decision,
     * Nov 10, 2026): to a Chairperson or Master Teacher, a section of the other department
     * shows only its department. Everyone else sees every label.
     */
    public function labelFor(?User $viewer = null, bool $withArticle = false): string
    {
        $viewer ??= auth()->user();

        if (! $viewer || $this->isVisibleTo($viewer)) {
            return $this->label();
        }

        return ($withArticle ? 'a ' : '').$this->departmentName().' section';
    }

    /** Whether this section is in the viewer's own department, or the viewer is not a scheduler. */
    public function isVisibleTo(User $viewer): bool
    {
        $departments = $viewer->departmentsInScope();

        return $departments === null || in_array($this->gradeLevel?->level, $departments, true);
    }

    private function departmentName(): string
    {
        return $this->gradeLevel?->level === 'SHS' ? 'Senior High' : 'Junior High';
    }

    public function label(): string
    {
        return "Grade {$this->gradeLevel->grade} – {$this->name}";
    }
}
