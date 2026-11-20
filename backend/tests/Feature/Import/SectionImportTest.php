<?php

use Illuminate\Support\Facades\DB;

require_once __DIR__.'/ImportHelpers.php';

const SECTION_HEADERS = ['section_name', 'grade_level', 'track', 'adviser_employee_id', 'co_adviser_employee_id', 'shift'];

beforeEach(function () {
    importSetUp($this);
    $this->anaId = DB::table('teachers')->insertGetId(['employee_id' => 'T-1', 'first_name' => 'Ana', 'last_name' => 'Reyes']);
    $this->benId = DB::table('teachers')->insertGetId(['employee_id' => 'T-2', 'first_name' => 'Ben', 'last_name' => 'Cruz']);
    DB::table('teachers')->insert(['employee_id' => 'S-1', 'first_name' => 'Staff', 'last_name' => 'Member', 'personnel_type' => 'non_teaching']);
    $this->techProId = DB::table('tracks')->insertGetId(['name' => 'TechPro']);
});

it('imports sections with their adviser, co-adviser and track', function () {
    $data = sendImport($this, 'sections', importFile(SECTION_HEADERS, [
        ['Honesty', 'Grade 7', '', 't-1', 'T-2', ''],
        ['ICT A', '11', 'techpro', '', '', 'am'],
    ]), 'commit')->assertOk()->json('data');

    $honesty = DB::table('sections')->where('name', 'Honesty')->first();
    expect($data['added'])->toBe(2)
        ->and($honesty->adviser_id)->toBe($this->anaId)
        ->and($honesty->co_adviser_id)->toBe($this->benId)
        ->and($honesty->school_year_id)->toBe($this->yearId)
        ->and(DB::table('sections')->where('name', 'ICT A')->value('track_id'))->toBe($this->techProId)
        ->and(DB::table('sections')->where('name', 'ICT A')->value('shift'))->toBe('AM')
        ->and($data['rows'][1]['messages'][0])->toContain('no adviser yet');
});

it('keeps one advisory per teacher, in the database and in the same file', function () {
    $rows = sendImport($this, 'sections', importFile(SECTION_HEADERS, [
        ['Honesty', '7', '', 'T-1', '', ''],
        ['Kindness', '7', '', 'T-1', '', ''],
    ]), 'commit')->json('data.rows');

    expect(collect($rows)->pluck('status')->all())->toBe(['new', 'error'])
        ->and($rows[1]['messages'][0])->toBe('Row 3: Ana Reyes already advises Grade 7 – Honesty. A teacher advises one section a year.')
        ->and(DB::table('sections')->count())->toBe(1);
});

it('says why a section row is wrong', function () {
    $rows = sendImport($this, 'sections', importFile(SECTION_HEADERS, [
        ['Honesty', '7', '', 'T-1', 'T-1', ''],
        ['Faith', '7', 'TechPro', 'X-9', '', ''],
        ['Hope', '8', '', 'S-1', '', 'night'],
    ]))->json('data.rows');

    expect($rows[0]['messages'])->toBe(['Row 2: the co-adviser must be someone other than the adviser.'])
        ->and($rows[1]['messages'])->toBe([
            'Row 3: only Senior High sections have a track. Leave the track empty.',
            'Row 3: adviser employee ID "X-9" is not in the system. Import or add the teacher first.',
        ])
        ->and($rows[2]['messages'])->toBe([
            'Row 4: shift "night" is not AM, PM or WHOLE_DAY.',
            'Row 4: Staff Member cannot be the adviser: only active teaching personnel can.',
        ]);
});

it('skips or updates a section already in the year, keeping the adviser when the cell is empty', function () {
    $gradeId = DB::table('grade_levels')->where('grade', 7)->value('id');
    DB::table('sections')->insert(['school_year_id' => $this->yearId, 'grade_level_id' => $gradeId, 'name' => 'Honesty', 'adviser_id' => $this->anaId]);
    $file = fn () => importFile(SECTION_HEADERS, [['HONESTY', '7', '', '', 'T-2', 'PM']]);

    expect(sendImport($this, 'sections', $file(), 'commit')->json('data.rows.0.status'))->toBe('skip')
        ->and(sendImport($this, 'sections', $file(), 'commit', ['on_duplicate' => 'update'])->json('data.rows.0.status'))->toBe('update');

    $section = DB::table('sections')->first();
    expect(DB::table('sections')->count())->toBe(1)
        ->and($section->adviser_id)->toBe($this->anaId)
        ->and($section->co_adviser_id)->toBe($this->benId)
        ->and($section->shift)->toBe('PM');
});
