<?php

use App\Models\Section;
use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->admin = User::factory()->create()->assignRole('super_admin');
    $this->pending = User::factory()->pending()->create();
});

function gradeId(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

function activate(object $test, array $data, ?User $target = null)
{
    return $test->putJson('/api/users/'.($target ?? $test->pending)->id.'/activation', $data);
}

it('lets the Admin activate an account with a role and grade-level scope', function () {
    $this->actingAs($this->admin);

    activate($this, ['role' => 'glc', 'grade_level_ids' => [gradeId(7), gradeId(8)]])
        ->assertOk()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.role', 'glc')
        ->assertJsonCount(2, 'data.grade_levels');
});

it('writes an audit log when an account is activated', function () {
    $this->actingAs($this->admin);

    activate($this, ['role' => 'teacher', 'grade_level_ids' => []])->assertOk();

    $log = DB::table('audit_logs')->where('action', 'activate')->first();

    expect($log->user_id)->toBe($this->admin->id)
        ->and($log->record_id)->toBe($this->pending->id)
        ->and(json_decode($log->old_data)->status)->toBe('pending')
        ->and(json_decode($log->new_data)->role)->toBe('teacher');
});

it('replaces the old role, so a user only ever has one', function () {
    $this->actingAs($this->admin);

    activate($this, ['role' => 'teacher', 'grade_level_ids' => []])->assertOk();
    activate($this, ['role' => 'master_teacher', 'grade_level_ids' => [gradeId(11)]])->assertOk();

    expect($this->pending->fresh()->getRoleNames()->all())->toBe(['master_teacher']);
});

it('refuses anyone who is not the Admin', function (string $role) {
    $this->actingAs(User::factory()->create()->assignRole($role));

    activate($this, ['role' => 'teacher', 'grade_level_ids' => []])->assertForbidden();

    expect($this->pending->fresh()->status)->toBe('pending');
})->with(['glc', 'master_teacher', 'teacher']);

it('refuses visitors who are not signed in', function () {
    activate($this, ['role' => 'teacher', 'grade_level_ids' => []])->assertUnauthorized();
});

it('stops the Admin from changing their own access', function () {
    $this->actingAs($this->admin);

    activate($this, ['role' => 'teacher', 'grade_level_ids' => []], $this->admin)->assertForbidden();

    expect($this->admin->fresh()->hasRole('super_admin'))->toBeTrue();
});

it('keeps each scheduler inside their own department', function (string $role, int $grade) {
    $this->actingAs($this->admin);

    activate($this, ['role' => $role, 'grade_level_ids' => [gradeId($grade)]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('grade_level_ids');
})->with([
    'GLC given SHS' => ['glc', 11],
    'Master Teacher given JHS' => ['master_teacher', 7],
]);

it('requires a scheduler to have at least one grade level', function () {
    $this->actingAs($this->admin);

    activate($this, ['role' => 'glc', 'grade_level_ids' => []])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('grade_level_ids');
});

it('does not give grade levels to other roles', function () {
    $this->actingAs($this->admin);

    activate($this, ['role' => 'teacher', 'grade_level_ids' => [gradeId(7)]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('grade_level_ids');
});

it('links the account to a personnel record', function () {
    $this->actingAs($this->admin);
    $teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes']);

    activate($this, ['role' => 'teacher', 'grade_level_ids' => [], 'teacher_id' => $teacherId])->assertOk();

    expect(DB::table('teachers')->where('id', $teacherId)->value('user_id'))->toBe($this->pending->id);
});

it('does not link a personnel record that belongs to someone else', function () {
    $this->actingAs($this->admin);
    $teacherId = DB::table('teachers')->insertGetId([
        'first_name' => 'Ana', 'last_name' => 'Reyes', 'user_id' => User::factory()->create()->id,
    ]);

    activate($this, ['role' => 'teacher', 'grade_level_ids' => [], 'teacher_id' => $teacherId])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('teacher_id');
});

describe('grade-level scope', function () {
    beforeEach(function () {
        $yearId = DB::table('school_years')->insertGetId([
            'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
        ]);

        foreach ([7, 8, 11] as $grade) {
            DB::table('sections')->insert([
                'school_year_id' => $yearId, 'grade_level_id' => gradeId($grade), 'name' => "Section {$grade}",
            ]);
        }
    });

    it('shows a GLC only the sections of assigned grade levels', function () {
        $glc = User::factory()->create()->assignRole('glc');
        $glc->gradeLevels()->attach(gradeId(7));

        expect(Section::visibleTo($glc)->pluck('name')->all())->toBe(['Section 7']);
    });

    it('shows the Admin every section', function () {
        expect(Section::visibleTo($this->admin)->count())->toBe(3);
    });

    it('shows a teacher no sections through this scope', function () {
        $teacher = User::factory()->create()->assignRole('teacher');

        expect(Section::visibleTo($teacher)->count())->toBe(0);
    });
});
