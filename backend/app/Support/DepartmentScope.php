<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Buildings and activities belong to Junior High (JHS), Senior High (SHS) or both (NULL, shared).
 * A Chairperson or Master Teacher sees their own department's and the shared ones, and changes only
 * their own. The Admin sees and changes everything.
 */
class DepartmentScope
{
    /** The departments the user works in, or null for every department (the Admin). */
    public static function departments(User $user): ?array
    {
        if ($user->hasRole(User::ROLE_ADMIN)) {
            return null;
        }

        return $user->departmentsInScope() ?? [];
    }

    /** Only the rows of the user's departments, plus the shared ones. */
    public static function apply(Builder $query, User $user, string $column = 'department'): void
    {
        $departments = self::departments($user);

        if ($departments !== null) {
            $query->where(fn (Builder $inner) => $inner->whereNull($column)->orWhereIn($column, $departments));
        }
    }

    /** Rows a section of this level may use: its department's and the shared ones. */
    public static function applyLevel(Builder $query, string $level, string $column = 'department'): void
    {
        $query->where(fn (Builder $inner) => $inner->whereNull($column)->orWhere($column, $level));
    }

    public static function canSee(?string $department, User $user): bool
    {
        $departments = self::departments($user);

        return $departments === null || $department === null || in_array($department, $departments, true);
    }

    /** Shared rows are the Admin's to change; a department's rows are its own schedulers' too. */
    public static function canEdit(?string $department, User $user): bool
    {
        $departments = self::departments($user);

        return $departments === null || ($department !== null && in_array($department, $departments, true));
    }

    /** What a new building or activity belongs to: the Admin picks, a scheduler gets their own. */
    public static function forNew(User $user, ?string $chosen): ?string
    {
        $departments = self::departments($user);

        if ($departments === null) {
            return $chosen ?: null;
        }

        return $chosen && in_array($chosen, $departments, true) ? $chosen : ($departments[0] ?? null);
    }

    public static function label(?string $department): string
    {
        return match ($department) {
            'JHS' => 'Junior High',
            'SHS' => 'Senior High',
            default => 'Shared',
        };
    }
}
