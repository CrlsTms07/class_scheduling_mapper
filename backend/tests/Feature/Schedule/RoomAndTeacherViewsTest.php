<?php

use App\Models\SchoolTerm;
use App\Models\Section;
use App\Models\SectionSubject;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(DatabaseSeeder::class);
    $this->term = SchoolTerm::where('is_active', true)->first();
    $this->sectionA = Section::where('name', 'Sample A')->first();
    $this->glc = User::where('email', 'glc@deped.gov.ph')->first();
});

describe('a section in a room', function () {
    it('puts a section in a room from the room card, and takes it out', function () {
        $this->actingAs($this->glc);
        $room = DB::table('rooms')->where('id', '<>', $this->sectionA->home_room_id)->value('id');

        $this->putJson("/api/sections/{$this->sectionA->id}/room", ['room_id' => $room])->assertOk()->assertJsonPath('message', fn ($text) => str_contains($text, 'now uses'));
        expect($this->sectionA->fresh()->home_room_id)->toBe($room);

        $this->putJson("/api/sections/{$this->sectionA->id}/room", ['room_id' => null])->assertOk();
        expect($this->sectionA->fresh()->home_room_id)->toBeNull();
    });

    it('is for the sections of the user only', function () {
        $master = User::factory()->create()->assignRole('master_teacher');
        $master->gradeLevels()->sync(DB::table('grade_levels')->where('grade', 11)->pluck('id'));
        $this->actingAs($master);

        $this->putJson("/api/sections/{$this->sectionA->id}/room", ['room_id' => null])->assertForbidden();
    });
});

describe('a teacher\'s classes', function () {
    it('lists each section and subject, with the day, time and room of every class', function () {
        $this->actingAs($this->glc);
        $loading = SectionSubject::where('section_id', $this->sectionA->id)->whereNotNull('teacher_id')->first();
        foreach ([1, 3] as $day) {
            DB::table('schedule_entries')->insert([
                'term_id' => $this->term->id, 'section_id' => $this->sectionA->id, 'section_subject_id' => $loading->id,
                'teacher_id' => $loading->teacher_id, 'room_id' => $this->sectionA->home_room_id, 'day_of_week' => $day,
                'start_time' => '07:15', 'end_time' => '08:00', 'created_by' => $this->glc->id,
            ]);
        }

        $data = $this->getJson("/api/terms/{$this->term->id}/teachers/{$loading->teacher_id}/schedule")->assertOk()->json('data');

        expect($data['classes'])->toHaveCount(1)
            ->and($data['classes'][0]['section'])->toBe('Grade 7 – Sample A')
            ->and($data['classes'][0]['meetings'])->toHaveCount(2)
            ->and($data['classes'][0]['meetings'][1])->toMatchArray(['day' => 3, 'start_time' => '07:15', 'end_time' => '08:00', 'minutes' => 45])
            ->and($data['minutes_per_week'])->toBe(90);
    });
});
