<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['email', 'password', 'first_name', 'middle_name', 'last_name', 'suffix', 'phone_number', 'status'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, Notifiable;

    public const ROLE_ADMIN = 'super_admin';

    public const ROLES = [self::ROLE_ADMIN, 'glc', 'master_teacher', 'teacher'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'preferences' => 'array',
        ];
    }

    public function gradeLevels(): BelongsToMany
    {
        return $this->belongsToMany(GradeLevel::class, 'user_grade_levels');
    }

    /**
     * The personnel record of this account, if it has one.
     */
    public function teacher(): HasOne
    {
        return $this->hasOne(Teacher::class);
    }

    /**
     * The grade levels this user may work with: all of them for the Admin,
     * the assigned ones for a GLC or Master Teacher, and none for anyone else.
     *
     * @return array<int, int>
     */
    /**
     * The departments (JHS, SHS) of a Chairperson's or Master Teacher's grade levels. Null for
     * everyone else, and for a scheduler with no grade level yet: nothing to keep apart.
     *
     * @return array<int, string>|null
     */
    public function departmentsInScope(): ?array
    {
        if (! $this->hasAnyRole(['glc', 'master_teacher'])) {
            return null;
        }

        $levels = GradeLevel::whereIn('id', $this->gradeLevelIdsInScope())->distinct()->pluck('level')->all();

        return $levels === [] ? null : $levels;
    }

    public function gradeLevelIdsInScope(): array
    {
        if ($this->hasRole(self::ROLE_ADMIN)) {
            return GradeLevel::pluck('id')->all();
        }

        return $this->gradeLevels()->pluck('grade_levels.id')->all();
    }
}
