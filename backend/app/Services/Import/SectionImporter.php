<?php

namespace App\Services\Import;

use App\Models\Section;
use App\Models\Teacher;
use Illuminate\Support\Facades\DB;

/**
 * Sections of the school year imported into, with their adviser and co-adviser by employee ID.
 * Teachers must already be in the system (import them first). One advisory per teacher per year.
 */
class SectionImporter extends MasterDataImporter
{
    public function columns(): array
    {
        return [
            'section_name' => true,
            'grade_level' => true,
            'track' => false,
            'adviser_employee_id' => false,
            'co_adviser_employee_id' => false,
            'shift' => false,
        ];
    }

    public function example(): array
    {
        return [
            'section_name' => 'Honesty',
            'grade_level' => 'Grade 7',
            'track' => '',
            'adviser_employee_id' => '4512301',
            'co_adviser_employee_id' => '',
            'shift' => 'WHOLE_DAY',
        ];
    }

    public function notes(): array
    {
        return [
            'section_name' => 'Up to 60 characters. The same name in the same grade is updated or skipped.',
            'grade_level' => 'A grade from 7 to 12, typed as 7 or Grade 7.',
            'track' => 'Senior High only. Must be a track already in the system, e.g. TechPro.',
            'adviser_employee_id' => 'Optional. The employee ID of an active teacher already in the system. A teacher advises one section a year. Empty keeps the adviser on Update.',
            'co_adviser_employee_id' => 'Optional. Someone other than the adviser. Empty keeps the co-adviser on Update.',
            'shift' => 'AM, PM or WHOLE_DAY (default).',
        ];
    }

    public function table(): string
    {
        return 'sections';
    }

    public function key(array $row): ?string
    {
        return strtolower(($this->gradeLevelId($row['grade_level']) ?? $row['grade_level'])."|{$row['section_name']}");
    }

    public function describeKey(array $row): string
    {
        return "section \"{$row['section_name']}\" of {$row['grade_level']}";
    }

    public function label(array $row): string
    {
        return trim("{$row['grade_level']} – {$row['section_name']}", ' –');
    }

    public function handle(array $row): array
    {
        $errors = [];

        if (mb_strlen($row['section_name']) > 60) {
            $errors[] = 'the section name is longer than 60 characters.';
        }

        $gradeLevelId = $this->gradeLevelId($row['grade_level']);
        $level = $gradeLevelId ? DB::table('grade_levels')->where('id', $gradeLevelId)->value('level') : null;
        if ($gradeLevelId === null) {
            $errors[] = "grade level \"{$row['grade_level']}\" is not a grade from 7 to 12.";
        }

        $trackId = null;
        if ($row['track'] !== '') {
            $trackId = $this->idByName('tracks', $row['track']);
            if ($level === 'JHS') {
                $errors[] = 'only Senior High sections have a track. Leave the track empty.';
            } elseif ($trackId === null) {
                $errors[] = "track \"{$row['track']}\" does not exist. Add it on the Subjects page (Tracks) or fix the spelling.";
            }
        }

        $shift = $this->shift($row['shift']);
        if ($shift === null) {
            $errors[] = "shift \"{$row['shift']}\" is not AM, PM or WHOLE_DAY.";
        }

        $adviser = $this->teacher($row['adviser_employee_id'], 'adviser', $errors);
        $coAdviser = $this->teacher($row['co_adviser_employee_id'], 'co-adviser', $errors);
        if ($adviser && $coAdviser && $adviser->id === $coAdviser->id) {
            $errors[] = 'the co-adviser must be someone other than the adviser.';
        }

        if ($errors !== []) {
            return ['error', $errors];
        }

        $section = Section::where('school_year_id', $this->year->id)
            ->where('grade_level_id', $gradeLevelId)
            ->whereRaw('LOWER(TRIM(name)) = LOWER(?)', [$row['section_name']])
            ->first();

        if ($section && $this->skipOrUpdate() === 'skip') {
            return ['skip', ["{$this->describeKey($row)} is already in this school year. Skipped."]];
        }

        $adviserId = $adviser?->id ?? $section?->adviser_id;
        $coAdviserId = $coAdviser?->id ?? $section?->co_adviser_id;

        if ($adviserId !== null && $adviserId === $coAdviserId) {
            return ['error', ['the co-adviser must be someone other than the adviser.']];
        }

        if ($adviser) {
            $advisory = Section::with('gradeLevel')
                ->where('school_year_id', $this->year->id)
                ->where('adviser_id', $adviser->id)
                ->when($section, fn ($query) => $query->whereKeyNot($section->id))
                ->first();
            if ($advisory) {
                return ['error', ["{$adviser->printedName()} already advises {$advisory->label()}. A teacher advises one section a year."]];
            }
        }

        $values = ['track_id' => $trackId, 'shift' => $shift, 'adviser_id' => $adviserId, 'co_adviser_id' => $coAdviserId];

        if ($section === null) {
            $section = Section::create([...$values, 'school_year_id' => $this->year->id, 'grade_level_id' => $gradeLevelId, 'name' => $row['section_name']]);
            $this->log('create', $section->id, null, [...$values, 'grade_level_id' => $gradeLevelId, 'name' => $section->name]);

            return ['new', $adviserId ? [] : ['no adviser yet. A section needs one before its schedule is submitted.']];
        }

        $before = $section->only(array_keys($values));
        $section->update($values);
        $this->log('update', $section->id, $before, $values);

        return ['update', []];
    }

    /**
     * An active teaching person by employee ID, or null when the cell is empty or wrong.
     *
     * @param  array<int, string>  $errors
     */
    private function teacher(string $employeeId, string $role, array &$errors): ?Teacher
    {
        if ($employeeId === '') {
            return null;
        }

        $teacher = Teacher::whereRaw('LOWER(employee_id) = LOWER(?)', [$employeeId])->first();

        if ($teacher === null) {
            $errors[] = "{$role} employee ID \"{$employeeId}\" is not in the system. Import or add the teacher first.";

            return null;
        }

        if ($teacher->personnel_type !== 'teaching' || ! $teacher->is_active) {
            $errors[] = "{$teacher->printedName()} cannot be the {$role}: only active teaching personnel can.";

            return null;
        }

        return $teacher;
    }

    private function shift(string $typed): ?string
    {
        return match (strtoupper(preg_replace('/[^a-z]/i', '', $typed))) {
            '', 'WHOLEDAY' => 'WHOLE_DAY',
            'AM' => 'AM',
            'PM' => 'PM',
            default => null,
        };
    }
}
