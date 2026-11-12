<?php

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
});

it('creates the four roles and six grade levels', function () {
    expect(Role::pluck('name')->sort()->values()->all())
        ->toBe(['glc', 'master_teacher', 'super_admin', 'teacher'])
        ->and(DB::table('grade_levels')->count())->toBe(6);
});

it('gives each demo account its role and grade-level scope', function () {
    $scope = fn (string $email) => DB::table('user_grade_levels')
        ->join('grade_levels', 'grade_levels.id', '=', 'user_grade_levels.grade_level_id')
        ->where('user_id', User::where('email', $email)->value('id'))
        ->orderBy('grade')->pluck('grade')->all();

    expect(User::where('email', 'admin@deped.gov.ph')->first()->hasRole('super_admin'))->toBeTrue()
        ->and($scope('glc@deped.gov.ph'))->toBe([7, 8, 9, 10])
        ->and($scope('master.teacher@deped.gov.ph'))->toBe([11, 12]);
});

it('creates the JHS Monday to Thursday and Friday bell schedules from the official form', function () {
    $minutesFor = fn (string $pattern) => DB::table('time_slots')
        ->join('day_patterns', 'day_patterns.id', '=', 'time_slots.day_pattern_id')
        ->where('day_patterns.name', $pattern)
        ->selectRaw('SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 60) AS total')
        ->selectRaw('SUM(CASE WHEN is_break THEN 0 ELSE EXTRACT(EPOCH FROM (end_time - start_time)) / 60 END) AS class_total')
        ->first();

    expect((int) $minutesFor('Monday – Thursday')->total)->toBe(595)
        ->and((int) $minutesFor('Monday – Thursday')->class_total)->toBe(555)
        ->and((int) $minutesFor('Friday')->total)->toBe(600)
        ->and((int) $minutesFor('Friday')->class_total)->toBe(560);
});

it('has exactly one active term and loaded sample sections', function () {
    expect(DB::table('school_terms')->where('is_active', true)->count())->toBe(1)
        ->and(DB::table('section_subjects')->count())->toBe(22);
});
