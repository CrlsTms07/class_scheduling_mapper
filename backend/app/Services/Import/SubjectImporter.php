<?php

namespace App\Services\Import;

use App\Models\Subject;
use Illuminate\Support\Facades\DB;

/**
 * Subjects of the school year imported into. The same name may repeat in another grade, track
 * or term (the subjects_unique index), so that whole set is the key.
 */
class SubjectImporter extends MasterDataImporter
{
    public function columns(): array
    {
        return [
            'subject_name' => true,
            'grade_level' => true,
            'minutes_per_week' => true,
            'track' => false,
            'term_no' => false,
            'subject_type' => false,
        ];
    }

    public function example(): array
    {
        return [
            'subject_name' => 'Mathematics 7',
            'grade_level' => 'Grade 7',
            'minutes_per_week' => '225',
            'track' => '',
            'term_no' => '',
            'subject_type' => 'core',
        ];
    }

    public function notes(): array
    {
        return [
            'subject_name' => 'Up to 100 characters. The same name in the same grade, track and term is updated or skipped.',
            'grade_level' => 'A grade from 7 to 12, typed as 7 or Grade 7.',
            'minutes_per_week' => 'A whole number from 1 to 3000, e.g. 225. Homeroom Guidance is 60.',
            'track' => 'Senior High only. Must be a track already in the system (Subjects page, Tracks), e.g. Academic. Empty = all tracks.',
            'term_no' => 'Senior High only: the term number (1, 2 or 3). Empty = the whole school year.',
            'subject_type' => 'core (default), elective or other.',
        ];
    }

    public function table(): string
    {
        return 'subjects';
    }

    public function key(array $row): ?string
    {
        return strtolower(implode('|', [$row['subject_name'], $this->gradeLevelId($row['grade_level']) ?? $row['grade_level'], $row['track'], $row['term_no']]));
    }

    public function describeKey(array $row): string
    {
        return "subject \"{$row['subject_name']}\" for {$row['grade_level']}";
    }

    public function label(array $row): string
    {
        return trim("{$row['subject_name']} · {$row['grade_level']}", ' ·');
    }

    public function handle(array $row): array
    {
        $errors = [];

        if (mb_strlen($row['subject_name']) > 100) {
            $errors[] = 'the subject name is longer than 100 characters.';
        }

        $gradeLevelId = $this->gradeLevelId($row['grade_level']);
        $level = $gradeLevelId ? DB::table('grade_levels')->where('id', $gradeLevelId)->value('level') : null;
        if ($gradeLevelId === null) {
            $errors[] = "grade level \"{$row['grade_level']}\" is not a grade from 7 to 12.";
        }

        $minutes = filter_var($row['minutes_per_week'], FILTER_VALIDATE_INT);
        if ($minutes === false || $minutes < 1 || $minutes > 3000) {
            $errors[] = "minutes per week \"{$row['minutes_per_week']}\" must be a whole number from 1 to 3000.";
        }

        $trackId = null;
        if ($row['track'] !== '') {
            $trackId = $this->idByName('tracks', $row['track']);
            if ($level === 'JHS') {
                $errors[] = 'only Senior High subjects have a track. Leave the track empty.';
            } elseif ($trackId === null) {
                $errors[] = "track \"{$row['track']}\" does not exist. Add it on the Subjects page (Tracks) or fix the spelling.";
            }
        }

        $termNo = null;
        if ($row['term_no'] !== '') {
            $termNo = filter_var($row['term_no'], FILTER_VALIDATE_INT);
            $count = DB::table('school_terms')->where('school_year_id', $this->year->id)->count();
            if ($termNo === false || ! DB::table('school_terms')->where('school_year_id', $this->year->id)->where('term_no', $termNo)->exists()) {
                $errors[] = "term \"{$row['term_no']}\" is not in this school year. Use a number from 1 to {$count}, or leave it empty.";
            }
        }

        $type = $row['subject_type'] === '' ? 'core' : strtolower($row['subject_type']);
        if (! in_array($type, ['core', 'elective', 'other'], true)) {
            $errors[] = "subject type \"{$row['subject_type']}\" is not core, elective or other.";
        }

        if ($errors !== []) {
            return ['error', $errors];
        }

        $values = [
            'name' => $row['subject_name'],
            'grade_level_id' => $gradeLevelId,
            'track_id' => $trackId,
            'term_no' => $termNo,
            'minutes_per_week' => $minutes,
            'subject_type' => $type,
        ];

        $subject = Subject::where('school_year_id', $this->year->id)
            ->where('grade_level_id', $gradeLevelId)
            ->whereRaw('COALESCE(track_id, 0) = ?', [(int) $trackId])
            ->whereRaw('COALESCE(term_no, 0) = ?', [(int) $termNo])
            ->whereRaw('LOWER(TRIM(name)) = LOWER(?)', [$row['subject_name']])
            ->first();

        if ($subject === null) {
            $subject = Subject::create([...$values, 'school_year_id' => $this->year->id, 'is_priority' => false, 'is_active' => true]);
            $this->log('create', $subject->id, null, $values);

            return ['new', []];
        }

        if ($this->skipOrUpdate() === 'skip') {
            return ['skip', ["{$subject->name} is already a subject of this grade. Skipped."]];
        }

        $changes = ['name' => $values['name'], 'minutes_per_week' => $minutes, 'subject_type' => $type];
        $before = $subject->only(array_keys($changes));
        $subject->update($changes);
        $this->log('update', $subject->id, $before, $changes);

        return ['update', []];
    }
}
