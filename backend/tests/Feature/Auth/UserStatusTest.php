<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $this->admin = User::factory()->create()->assignRole('super_admin');
    $this->member = User::factory()->create(['password' => 'Password123!'])->assignRole('teacher');
    $this->pending = User::factory()->pending()->create();
    $this->actingAs($this->admin);
});

it('deactivates an account, keeps its role and writes an audit log', function () {
    $this->putJson("/api/users/{$this->member->id}/status", ['status' => 'inactive'])
        ->assertOk()
        ->assertJsonPath('data.status', 'inactive')
        ->assertJsonPath('data.role', 'teacher');

    $log = DB::table('audit_logs')->where('action', 'deactivate')->first();

    expect($log->record_id)->toBe($this->member->id)
        ->and($log->user_id)->toBe($this->admin->id);
});

it('signs a deactivated user out of every device', function () {
    DB::table('sessions')->insert([
        'id' => 'member-session', 'user_id' => $this->member->id, 'ip_address' => null, 'user_agent' => null,
        'payload' => '', 'last_activity' => time(),
    ]);
    DB::table('sessions')->insert([
        'id' => 'admin-session', 'user_id' => $this->admin->id, 'ip_address' => null, 'user_agent' => null,
        'payload' => '', 'last_activity' => time(),
    ]);

    $this->putJson("/api/users/{$this->member->id}/status", ['status' => 'inactive'])->assertOk();

    expect(DB::table('sessions')->pluck('id')->all())->toBe(['admin-session']);
});

it('stops a deactivated user at the next request', function () {
    $this->member->update(['status' => 'inactive']);

    $this->actingAs($this->member->fresh())->getJson('/api/me')
        ->assertForbidden()
        ->assertJsonPath('code', 'account_not_active');
});

it('reactivates an account as it was', function () {
    $this->member->update(['status' => 'inactive']);

    $this->putJson("/api/users/{$this->member->id}/status", ['status' => 'active'])
        ->assertOk()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.role', 'teacher');

    expect(DB::table('audit_logs')->where('action', 'reactivate')->exists())->toBeTrue();
});

it('does not let status change skip activation', function () {
    $this->putJson("/api/users/{$this->pending->id}/status", ['status' => 'active'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});

it('rejects an unknown status', function () {
    $this->putJson("/api/users/{$this->member->id}/status", ['status' => 'pending'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});

it('stops the Admin from deactivating or declining themselves', function () {
    $this->putJson("/api/users/{$this->admin->id}/status", ['status' => 'inactive'])->assertForbidden();
    $this->deleteJson("/api/users/{$this->admin->id}")->assertForbidden();

    expect($this->admin->fresh()->status)->toBe('active');
});

it('keeps these actions to the Admin', function (string $role) {
    $this->actingAs(User::factory()->create()->assignRole($role));

    $this->putJson("/api/users/{$this->member->id}/status", ['status' => 'inactive'])->assertForbidden();
    $this->deleteJson("/api/users/{$this->pending->id}")->assertForbidden();
})->with(['glc', 'master_teacher', 'teacher']);

it('declines a pending sign-up and writes an audit log', function () {
    $email = $this->pending->email;

    $this->deleteJson("/api/users/{$this->pending->id}")->assertOk();

    expect(User::find($this->pending->id))->toBeNull();

    $log = DB::table('audit_logs')->where('action', 'decline')->first();
    expect(json_decode($log->old_data)->email)->toBe($email);
});

it('deletes an active account with no work and writes an audit log', function () {
    $this->deleteJson("/api/users/{$this->member->id}")->assertOk();

    expect(User::find($this->member->id))->toBeNull()
        ->and(DB::table('audit_logs')->where('action', 'delete')->where('record_id', $this->member->id)->exists())->toBeTrue();
});

it('keeps the personnel record of a deleted account, without a login', function () {
    $teacherId = DB::table('teachers')->insertGetId([
        'first_name' => 'Ana', 'last_name' => 'Reyes', 'user_id' => $this->member->id,
    ]);

    $this->deleteJson("/api/users/{$this->member->id}")->assertOk();

    expect(DB::table('teachers')->where('id', $teacherId)->value('user_id'))->toBeNull();
});

it('refuses to delete an account that has worked on schedules, and says why', function () {
    $yearId = DB::table('school_years')->insertGetId([
        'name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
    ]);
    $termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $yearId, 'term_no' => 1, 'name' => 'First Term',
        'start_date' => '2026-06-01', 'end_date' => '2026-09-30',
    ]);
    $sectionId = DB::table('sections')->insertGetId([
        'school_year_id' => $yearId, 'grade_level_id' => DB::table('grade_levels')->where('grade', 7)->value('id'), 'name' => 'Honesty',
    ]);
    DB::table('schedule_entries')->insert([
        'term_id' => $termId, 'section_id' => $sectionId, 'created_by' => $this->member->id,
        'day_of_week' => 1, 'start_time' => '07:00', 'end_time' => '07:45',
    ]);

    $this->getJson('/api/users')->assertJsonFragment([
        'cannot_delete_reason' => 'This account has already worked on schedules, and that history must stay. Deactivate it instead.',
    ]);

    $this->deleteJson("/api/users/{$this->member->id}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['user' => 'Deactivate it instead']);

    expect(User::find($this->member->id))->not->toBeNull();
});

it('shows the linked personnel record of an account', function () {
    $teacherId = DB::table('teachers')->insertGetId([
        'first_name' => 'Ana', 'last_name' => 'Reyes', 'user_id' => $this->member->id,
    ]);

    $this->getJson('/api/users')->assertOk()->assertJsonFragment([
        'personnel' => ['id' => $teacherId, 'name' => 'Ana Reyes'],
    ]);
});

it('keeps the personnel link when access is saved with the same record', function () {
    $teacherId = DB::table('teachers')->insertGetId([
        'first_name' => 'Ana', 'last_name' => 'Reyes', 'user_id' => $this->member->id,
    ]);

    $this->putJson("/api/users/{$this->member->id}/activation", [
        'role' => 'teacher', 'grade_level_ids' => [], 'teacher_id' => $teacherId,
    ])
        ->assertOk()
        ->assertJsonPath('data.personnel.id', $teacherId);
});
