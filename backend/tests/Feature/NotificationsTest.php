<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

function noticeGrade(int $grade): int
{
    return DB::table('grade_levels')->where('grade', $grade)->value('id');
}

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);

    $yearId = DB::table('school_years')->insertGetId(['name' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
    $this->termId = DB::table('school_terms')->insertGetId([
        'school_year_id' => $yearId, 'term_no' => 1, 'name' => 'First Term', 'start_date' => '2026-06-01', 'end_date' => '2026-09-30', 'is_active' => true,
    ]);
    $this->teacherAccount = User::factory()->create()->assignRole('teacher');
    $this->teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes', 'user_id' => $this->teacherAccount->id]);
    $this->otherTeacher = DB::table('teachers')->insertGetId(['first_name' => 'Ben', 'last_name' => 'Cruz']);
    $building = DB::table('buildings')->insertGetId(['name' => 'Main']);
    $this->roomId = DB::table('rooms')->insertGetId(['building_id' => $building, 'room_number' => '101']);

    $this->admin = User::factory()->create()->assignRole('super_admin');
    $this->glc = User::factory()->create()->assignRole('glc');
    $this->glc->gradeLevels()->attach(noticeGrade(7));

    $this->seven = DB::table('sections')->insertGetId(['school_year_id' => $yearId, 'grade_level_id' => noticeGrade(7), 'name' => 'Honesty']);
    $this->eight = DB::table('sections')->insertGetId(['school_year_id' => $yearId, 'grade_level_id' => noticeGrade(8), 'name' => 'Faith']);

    $this->entry = function (int $sectionId, int $teacherId, string $status, ?int $reviewId = null, int $day = 1) use ($yearId) {
        $subject = DB::table('subjects')->insertGetId([
            'school_year_id' => $yearId, 'grade_level_id' => DB::table('sections')->where('id', $sectionId)->value('grade_level_id'),
            'name' => 'S'.uniqid(), 'minutes_per_week' => 45,
        ]);
        $loading = DB::table('section_subjects')->insertGetId([
            'term_id' => $this->termId, 'section_id' => $sectionId, 'subject_id' => $subject, 'teacher_id' => $teacherId,
        ]);
        DB::table('schedule_entries')->insert([
            'term_id' => $this->termId, 'section_id' => $sectionId, 'section_subject_id' => $loading, 'teacher_id' => $teacherId,
            'room_id' => $this->roomId, 'created_by' => $this->glc->id, 'status' => $status, 'review_id' => $reviewId,
            'day_of_week' => $day, 'start_time' => '07:00', 'end_time' => '07:45',
        ]);
    };

    $this->review = fn (string $action, ?string $remarks = null, string $when = 'now') => DB::table('schedule_reviews')->insertGetId([
        'term_id' => $this->termId, 'scope' => 'all', 'action' => $action, 'remarks' => $remarks,
        'reviewed_by' => $this->admin->id, 'created_at' => now()->modify($when),
    ]);
});

it('tells the Admin what is waiting', function () {
    ($this->entry)($this->seven, $this->teacherId, 'pending');
    ($this->entry)($this->eight, $this->otherTeacher, 'pending', null, 2);
    User::factory()->create(['status' => 'pending']);

    $this->actingAs($this->admin)->getJson('/api/notifications')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonFragment(['title' => '2 sections are waiting for approval', 'link' => '/approvals'])
        ->assertJsonFragment(['title' => '1 account is waiting to be activated', 'link' => '/users']);
});

it('tells the Admin nothing when nothing is waiting', function () {
    $this->actingAs($this->admin)->getJson('/api/notifications')->assertOk()->assertJsonPath('data', []);
});

it('tells a Chairperson about decisions on their sections, with the remarks', function () {
    $rejected = ($this->review)('reject', 'Too many Math periods.');
    ($this->entry)($this->seven, $this->teacherId, 'rejected', $rejected);

    $this->actingAs($this->glc)->getJson('/api/notifications')
        ->assertOk()
        ->assertJsonPath('data.0.title', 'Rejected: Grade 7 – Honesty')
        ->assertJsonPath('data.0.link', "/schedule/sections/{$this->seven}")
        ->assertJsonPath('data.0.body', 'First Term. Remarks: Too many Math periods. Open it, revise, then submit again.');
});

it('leaves out decisions on other grade levels, and old ones', function () {
    $other = ($this->review)('approve');
    ($this->entry)($this->eight, $this->otherTeacher, 'approved', $other);
    $old = ($this->review)('approve', null, '-40 days');
    ($this->entry)($this->seven, $this->teacherId, 'approved', $old, 3);

    $this->actingAs($this->glc)->getJson('/api/notifications')->assertJsonPath('data', []);
});

it('lists the newest first', function () {
    $first = ($this->review)('approve', null, '-2 days');
    ($this->entry)($this->seven, $this->teacherId, 'approved', $first);
    $second = ($this->review)('reopen', 'Teacher change.');
    ($this->entry)($this->seven, $this->otherTeacher, 'draft', $second, 2);

    $this->actingAs($this->glc)->getJson('/api/notifications')
        ->assertJsonPath('data.0.title', 'Reopened: Grade 7 – Honesty')
        ->assertJsonPath('data.1.title', 'Approved: Grade 7 – Honesty');
});

it('tells a teacher when their own classes are approved, and nobody else', function () {
    $approved = ($this->review)('approve');
    ($this->entry)($this->seven, $this->teacherId, 'approved', $approved);

    $this->actingAs($this->teacherAccount)->getJson('/api/notifications')
        ->assertJsonPath('data.0.title', 'Your schedule was approved')
        ->assertJsonPath('data.0.body', 'First Term: Grade 7 – Honesty.')
        ->assertJsonPath('data.0.link', '/my-schedule');

    $stranger = User::factory()->create()->assignRole('teacher');
    DB::table('teachers')->where('id', $this->otherTeacher)->update(['user_id' => $stranger->id]);

    $this->actingAs($stranger)->getJson('/api/notifications')->assertJsonPath('data', []);
});

it('does not tell a teacher about a rejection, which they never saw', function () {
    $rejected = ($this->review)('reject', 'Fix it.');
    ($this->entry)($this->seven, $this->teacherId, 'rejected', $rejected);

    $this->actingAs($this->teacherAccount)->getJson('/api/notifications')->assertJsonPath('data', []);
});

it('needs a sign-in', function () {
    $this->getJson('/api/notifications')->assertUnauthorized();
});
