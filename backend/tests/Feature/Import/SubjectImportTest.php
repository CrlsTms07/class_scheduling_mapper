<?php

use Illuminate\Support\Facades\DB;

require_once __DIR__.'/ImportHelpers.php';

const SUBJECT_HEADERS = ['subject_name', 'grade_level', 'minutes_per_week', 'track', 'term_no', 'subject_type'];

beforeEach(function () {
    importSetUp($this);
    $this->trackId = DB::table('tracks')->insertGetId(['name' => 'Academic']);
});

it('imports subjects into the school year, matching grades and tracks however they are typed', function () {
    $data = sendImport($this, 'subjects', importFile(SUBJECT_HEADERS, [
        ['Mathematics 7', 'Grade 7', 225, '', '', ''],
        ['Homeroom Guidance', '7', 60, '', '', 'other'],
        ['General Mathematics', 'G11', 240, 'academic', 1, 'core'],
    ]), 'commit')->assertOk()->json('data');

    expect($data['added'])->toBe(3)
        ->and(DB::table('subjects')->where('school_year_id', $this->yearId)->count())->toBe(3)
        ->and(DB::table('subjects')->where('name', 'General Mathematics')->value('track_id'))->toBe($this->trackId)
        ->and(DB::table('subjects')->where('name', 'Homeroom Guidance')->value('subject_type'))->toBe('other');
});

it('says why a subject row is wrong', function () {
    $rows = sendImport($this, 'subjects', importFile(SUBJECT_HEADERS, [
        ['Math 13', 'Grade 13', 225, '', '', ''],
        ['Math 7', '7', 0, '', '', ''],
        ['English 7', '7', 200, 'Academic', '', ''],
        ['Physics', '11', 200, 'STEMM', 4, 'major'],
    ]))->json('data.rows');

    expect($rows[0]['messages'])->toBe(['Row 2: grade level "Grade 13" is not a grade from 7 to 12.'])
        ->and($rows[1]['messages'])->toBe(['Row 3: minutes per week "0" must be a whole number from 1 to 3000.'])
        ->and($rows[2]['messages'])->toBe(['Row 4: only Senior High subjects have a track. Leave the track empty.'])
        ->and($rows[3]['messages'])->toHaveCount(3)
        ->and($rows[3]['messages'][0])->toContain('track "STEMM" does not exist')
        ->and($rows[3]['messages'][1])->toContain('Use a number from 1 to 1');
});

it('skips or updates the same subject of the same grade, and calls a repeat in the file an error', function () {
    $gradeId = DB::table('grade_levels')->where('grade', 7)->value('id');
    DB::table('subjects')->insert(['school_year_id' => $this->yearId, 'grade_level_id' => $gradeId, 'name' => 'Mathematics 7', 'minutes_per_week' => 200]);
    $file = fn () => importFile(SUBJECT_HEADERS, [['MATHEMATICS 7', '7', 225, '', '', '']]);

    expect(sendImport($this, 'subjects', $file(), 'commit')->json('data.rows.0.status'))->toBe('skip')
        ->and(sendImport($this, 'subjects', $file(), 'commit', ['on_duplicate' => 'update'])->json('data.rows.0.status'))->toBe('update')
        ->and(DB::table('subjects')->count())->toBe(1)
        ->and(DB::table('subjects')->value('minutes_per_week'))->toBe(225);

    $rows = sendImport($this, 'subjects', importFile(SUBJECT_HEADERS, [['Science 7', '7', 200, '', '', ''], ['science 7', 'Grade 7', 225, '', '', '']]))->json('data.rows');
    expect(collect($rows)->pluck('status')->all())->toBe(['error', 'error']);
});
