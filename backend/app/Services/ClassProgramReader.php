<?php

namespace App\Services;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Reads the school's own Excel schedules, whatever the file or sheet is called, and turns them
 * into one row per class, in the order of the import template:
 * Grade, Section, Day, Start, End, Subject, Teacher, Room.
 *
 * Every block starts at a "TIME" heading followed by day headings. Three layouts are read:
 * - SHS class program: TIME, NO. OF MINUTES, MONDAY to FRIDAY; each class takes up to four
 *   lines (subject, the section again, teacher "J. DELA CRUZ", room "C 401"), under the
 *   section's name.
 * - JHS class program: under "SECTION <name>", a "Monday – Thursday" block (one column per day,
 *   or one column for all four) and a "Friday" block, each with its own TIME column; the
 *   cells hold the subjects.
 * - Teachers Program: under "NAME OF TEACHER <name>" and "SUBJECT <subject>", the same
 *   blocks, and the cells hold the section the teacher meets at that time.
 *
 * The grade comes from the block's title ("GRADE 9"), the sheet's name, a "GRADE 9" heading
 * anywhere in the workbook, or the file's name ("Grade-9.xlsx").
 */
class ClassProgramReader
{
    private const DAY_NUMBERS = ['MONDAY' => 1, 'TUESDAY' => 2, 'WEDNESDAY' => 3, 'THURSDAY' => 4, 'FRIDAY' => 5];

    private const DAY_NAMES = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday'];

    private const MAX_ROWS = 3000;

    /** "G11_2ND Sem_CP", "Grade 9" or "GRADE-10" in a sheet's name; not the "g" of "Program". */
    private const GRADE_IN_NAME = '/(?<![A-Z])G(?:RADE)?\s*-?\s*(\d{1,2})(?!\d)/i';

    private const MAX_COLUMNS = 120;

    /** Lines in a cell that are not a class: breaks, notes and homeroom guidance remarks. */
    private const IGNORED = ['HOMEROOM', 'GUIDANCE', 'BREAK TIME', 'BREAK', 'LUNCH', 'LUNCH BREAK', 'RECESS', 'NOON BREAK', 'SNACK'];

    /**
     * @return array{rows: array<int, array<int, string|int>>, sections: array<int, string>}|null null when no
     *                                                                                        schedule block is found
     */
    public function read(string $path, ?string $fileName = null): ?array
    {
        $reader = IOFactory::createReader(str_ends_with(strtolower($fileName ?? $path), '.xls') ? 'Xls' : 'Xlsx');
        $reader->setReadDataOnly(true);
        $reader->setReadFilter(new class(self::MAX_ROWS, self::MAX_COLUMNS) implements IReadFilter
        {
            public function __construct(private int $maxRow, private int $maxColumn) {}

            public function readCell(string $columnAddress, int $row, string $worksheetName = ''): bool
            {
                return $row <= $this->maxRow && Coordinate::columnIndexFromString($columnAddress) <= $this->maxColumn;
            }
        });

        // One sheet at a time, so a large workbook stays within the server's memory.
        $names = $reader->listWorksheetNames($path);
        $grade = $this->workbookGrade($names, $fileName);

        $teacherRows = [];
        $otherRows = [];
        foreach ($names as $name) {
            $reader->setLoadSheetsOnly([$name]);
            $book = $reader->load($path);
            $sheet = $book->getSheet(0);
            $sheetGrade = $grade ?? $this->firstCellsGrade($sheet);

            foreach ($this->readSheet($sheet, $sheetGrade) as [$row, $fromTeacherProgram]) {
                $fromTeacherProgram ? $teacherRows[] = $row : $otherRows[] = $row;
            }
            $book->disconnectWorksheets();
            unset($book, $sheet);
        }

        // A class can be in both the Teachers Program and a class program: the one with the teacher wins.
        $rows = [];
        foreach ([...$teacherRows, ...$otherRows] as $row) {
            $rows[strtoupper("{$row[0]}|{$row[1]}|{$row[2]}|{$row[3]}")] ??= $row;
        }
        if ($rows === []) {
            return null;
        }

        $sections = [];
        foreach ($rows as $row) {
            $sections["{$row[0]}|".strtoupper($row[1])] = trim("Grade {$row[0]} – {$row[1]}");
        }

        return ['rows' => array_values($rows), 'sections' => array_values($sections)];
    }

    /** "GRADE 9" in a sheet's name, else in the file's name. */
    private function workbookGrade(array $sheetNames, ?string $fileName): ?int
    {
        foreach ($sheetNames as $name) {
            if (preg_match(self::GRADE_IN_NAME, $name, $match) && $this->isGrade((int) $match[1])) {
                return (int) $match[1];
            }
        }

        return $fileName && preg_match('/grade\s*[-_ ]?\s*(\d{1,2})/i', $fileName, $match) && $this->isGrade((int) $match[1]) ? (int) $match[1] : null;
    }

    /** A "GRADE 9" heading in the first cells of a sheet. */
    private function firstCellsGrade(Worksheet $sheet): ?int
    {
        foreach (['A1', 'A2', 'B1', 'B2'] as $address) {
            if (preg_match('/GRADE\s*(\d{1,2})/i', (string) $sheet->getCell($address)->getValue(), $match) && $this->isGrade((int) $match[1])) {
                return (int) $match[1];
            }
        }

        return null;
    }

    /**
     * @return array<int, array{0: array<int, string|int>, 1: bool}> each row, and whether it came from a Teachers Program
     */
    private function readSheet(Worksheet $sheet, ?int $workbookGrade): array
    {
        $cells = $sheet->toArray(null, false, false, false);
        $sheetGrade = preg_match(self::GRADE_IN_NAME, $sheet->getTitle(), $match) && $this->isGrade((int) $match[1]) ? (int) $match[1] : $workbookGrade;
        $rows = [];

        foreach ($cells as $r => $line) {
            foreach ($line as $c => $value) {
                if ($this->text($value) !== 'TIME') {
                    continue;
                }

                $days = $this->dayColumns($line, $c);
                if ($days === []) {
                    continue;
                }

                $title = $this->blockTitle($cells, $r, $c, $sheetGrade);
                if ($title === null) {
                    continue;
                }

                foreach ($this->readBlock($cells, $r + 1, $c, $days, $title) as $row) {
                    $rows[] = [$row, $title['mode'] === 'teacher'];
                }
            }
        }

        return $rows;
    }

    /**
     * The day columns after a TIME heading, until the next TIME heading.
     * "MONDAY – THURSDAY" over four columns is one day per column; over one column, all four days.
     *
     * @return array<int, array<int, int>> column => day numbers
     */
    private function dayColumns(array $line, int $timeColumn): array
    {
        $columns = [];
        $range = null; // [first column, day numbers]
        $width = 0;

        for ($c = $timeColumn + 1; $c <= $timeColumn + 9 && $c < count($line); $c++) {
            $name = $this->text($line[$c] ?? null);
            if ($name === 'TIME') {
                break;
            }
            if ($name === '' && $range !== null) {
                $width++; // an empty heading under a merged "MONDAY – THURSDAY"

                continue;
            }
            if ($range !== null) {
                $columns += $this->spread($range, $width);
                $range = null;
            }
            if (isset(self::DAY_NUMBERS[$name])) {
                $columns[$c] = [self::DAY_NUMBERS[$name]];
            } elseif (preg_match('/^(MON|TUE|WED|THU|FRI)[A-Z]*\.?\s*[-–TO ]+\s*(MON|TUE|WED|THU|FRI)[A-Z]*\.?$/', $name, $match)) {
                $from = $this->dayNumber($match[1]);
                $to = $this->dayNumber($match[2]);
                if ($from && $to && $to >= $from) {
                    $range = [$c, range($from, $to)];
                    $width = 1;
                }
            }
        }
        if ($range !== null) {
            $columns += $this->spread($range, $width);
        }

        return $columns;
    }

    /** A day range over its columns: one day each when they match, else every day in the first. */
    private function spread(array $range, int $width): array
    {
        [$first, $days] = $range;
        if ($width === count($days)) {
            $columns = [];
            foreach ($days as $i => $day) {
                $columns[$first + $i] = [$day];
            }

            return $columns;
        }

        return [$first => $days];
    }

    private function dayNumber(string $prefix): ?int
    {
        return ['MON' => 1, 'TUE' => 2, 'WED' => 3, 'THU' => 4, 'FRI' => 5][$prefix] ?? null;
    }

    /**
     * What a block is about, from the rows above its TIME heading: a teacher and subject
     * (Teachers Program), or a section (class program).
     *
     * @return array{mode: string, grade: int|null, section: string|null, teacher: string, subject: string}|null
     */
    private function blockTitle(array $cells, int $headerRow, int $column, ?int $grade): ?array
    {
        for ($r = $headerRow - 1; $r >= max(0, $headerRow - 6); $r--) {
            for ($c = $column; $c >= max(0, $column - 7); $c--) {
                $label = $this->text($cells[$r][$c] ?? null);

                if (str_contains($label, 'NAME OF TEACHER') || $label === 'TEACHER') {
                    $teacher = $this->valueAfter($cells[$r], $c, ['SUBJECT']);
                    $subject = '';
                    foreach ($cells[$r] as $i => $cell) {
                        if ($i > $c && $i <= $c + 8 && $this->text($cell) === 'SUBJECT') {
                            $subject = $this->valueAfter($cells[$r], $i, ['NAME OF TEACHER', 'TEACHER', 'SUBJECT']);
                            break;
                        }
                    }

                    // No subject written: the heading of the column group at the top of the sheet ("FILIPINO").
                    for ($top = 0; $subject === '' && $top <= 2 && $top < $r; $top++) {
                        $heading = trim((string) ($cells[$top][$c] ?? ''));
                        if ($heading !== '' && ! str_contains($this->text($heading), 'NAME OF TEACHER')) {
                            $subject = mb_convert_case($heading, MB_CASE_TITLE);
                        }
                    }

                    return $teacher === '' ? null : ['mode' => 'teacher', 'grade' => $grade, 'section' => null, 'teacher' => $teacher, 'subject' => $subject];
                }

                if (preg_match('/^SECTION\b\s*:?\s*(.*)$/', $label, $match)) {
                    $section = trim($match[1]) !== '' ? $this->clean((string) $cells[$r][$c], true) : $this->valueAfter($cells[$r], $c, ['ADVISER', 'GRADE']);

                    return $section === '' ? null : ['mode' => 'section', 'grade' => $this->gradeAbove($cells, $headerRow, $column) ?? $grade, 'section' => $section, 'teacher' => '', 'subject' => ''];
                }
            }
        }

        // The SHS class program: the section's name and "GRADE 11" in the rows above, in the same column.
        $section = null;
        for ($r = $headerRow - 1; $r >= max(0, $headerRow - 8); $r--) {
            $value = trim((string) ($cells[$r][$column] ?? ''));
            if ($value === '') {
                continue;
            }
            if (preg_match('/GRADE\s*(\d{1,2})/i', $value, $match)) {
                $grade = (int) $match[1];
                break;
            }
            // Titles above the block are not section names: the school, the form's name, the term.
            if ($section === null && strlen($value) <= 40 && ! preg_match('/adviser|semester|school|term|class\s*program|republic|division|region|department/i', $value)) {
                $section = preg_replace('/\s+/', ' ', $value);
            }
        }

        return $section === null ? null : ['mode' => 'program', 'grade' => $grade, 'section' => $section, 'teacher' => '', 'subject' => ''];
    }

    /** The first value to the right of a label, before any of the stop labels. */
    private function valueAfter(array $line, int $labelColumn, array $stops): string
    {
        for ($c = $labelColumn + 1; $c <= $labelColumn + 6 && $c < count($line); $c++) {
            $value = trim(preg_replace('/\s+/', ' ', (string) ($line[$c] ?? '')));
            if ($value === '') {
                continue;
            }
            foreach ($stops as $stop) {
                if (str_starts_with(strtoupper($value), $stop)) {
                    return '';
                }
            }

            return rtrim($value, ':');
        }

        return '';
    }

    private function gradeAbove(array $cells, int $headerRow, int $column): ?int
    {
        for ($r = $headerRow - 1; $r >= max(0, $headerRow - 4); $r--) {
            foreach (array_slice($cells[$r] ?? [], max(0, $column - 2), 10) as $value) {
                if (preg_match('/GRADE\s*(\d{1,2})/i', (string) $value, $match) && $this->isGrade((int) $match[1])) {
                    return (int) $match[1];
                }
            }
        }

        return null;
    }

    /**
     * The classes of one block, until its totals or the next block.
     *
     * @param  array<int, array<int, int>>  $days  column => day numbers
     * @param  array{mode: string, grade: int|null, section: string|null, teacher: string, subject: string}  $title
     * @return array<int, array<int, string|int>>
     */
    private function readBlock(array $cells, int $fromRow, int $column, array $days, array $title): array
    {
        $rows = [];
        $last = count($cells);
        $misses = 0;

        for ($r = $fromRow; $r < $last; $r++) {
            $time = trim((string) ($cells[$r][$column] ?? ''));

            if (preg_match('/total|prepared|teaching\s*load|weekly/i', $time) || $this->text($time) === 'TIME') {
                break;
            }
            if (! preg_match('/^(\d{1,2})[:.](\d{2})\s*(?:[AP]M)?\s*[-–]\s*(\d{1,2})[:.](\d{2})/i', $time, $match)) {
                // A long gap ends the block, so the next block's rows are not read twice.
                if ($time === '' && ++$misses > 6) {
                    break;
                }

                continue;
            }
            $misses = 0;

            $start = $this->clock((int) $match[1], (int) $match[2]);
            $end = $this->clock((int) $match[3], (int) $match[4]);
            // "5:00 - 7:00" in the afternoon: the end comes after the start.
            if ($end <= $start) {
                $end = sprintf('%02d:%s', (int) substr($end, 0, 2) + 12, substr($end, 3, 2));
            }

            // The period's lines run until the next time, or four rows at most.
            $height = 1;
            while ($height < 4 && $r + $height < $last && trim((string) ($cells[$r + $height][$column] ?? '')) === '' && $this->blankRowAcross($cells[$r + $height], $days) === false) {
                $height++;
            }

            foreach ($days as $dayColumn => $dayNumbers) {
                $lines = [];
                for ($i = 0; $i < $height; $i++) {
                    $value = $this->clean((string) ($cells[$r + $i][$dayColumn] ?? ''));
                    if ($value !== '') {
                        $lines[] = $value;
                    }
                }

                $class = $this->classOf($lines, $title);
                if ($class === null) {
                    continue;
                }

                foreach ($dayNumbers as $day) {
                    $rows[] = [$title['grade'] ?? '', $class['section'], self::DAY_NAMES[$day], $start, $end, $class['subject'], $class['teacher'], $class['room']];
                }
            }

            $r += $height - 1;
        }

        return $rows;
    }

    /** True when a row has nothing in the day columns (the period has ended). */
    private function blankRowAcross(array $line, array $days): bool
    {
        foreach (array_keys($days) as $column) {
            if (trim((string) ($line[$column] ?? '')) !== '') {
                return false;
            }
        }

        return true;
    }

    /**
     * One cell of a block as a class. In a Teachers Program the cell names the section; in a
     * class program it holds the subject, and in the SHS layout also the teacher and the room.
     *
     * @param  array<int, string>  $lines
     * @return array{section: string, subject: string, teacher: string, room: string}|null
     */
    private function classOf(array $lines, array $title): ?array
    {
        $lines = array_values(array_filter($lines, fn (string $line) => ! in_array($this->text($line), self::IGNORED, true) && ! str_starts_with($this->text($line), '*')));
        if ($lines === []) {
            return null;
        }

        if ($title['mode'] === 'teacher') {
            return ['section' => $lines[0], 'subject' => $title['subject'], 'teacher' => $this->personName($title['teacher']), 'room' => $lines[1] ?? ''];
        }

        $subject = $teacher = $room = '';
        foreach ($lines as $line) {
            $upper = $this->text($line);

            if ($this->looksLikeSection($upper, (string) $title['section'])) {
                continue;
            }
            if ($room === '' && preg_match('/^[A-Z]{1,2}\s?-?\s?\d{2,4}\b|\bLAB\b|\bGYM\b|\bCOURT\b|\bROOM\b/i', $line)) {
                $room = $line;
            } elseif ($teacher === '' && preg_match('/^[A-Z]\.\s?[A-Z]/', $upper)) {
                $teacher = $line;
            } elseif ($subject === '') {
                $subject = $line;
            }
        }

        return $subject === '' ? null : ['section' => (string) $title['section'], 'subject' => $subject, 'teacher' => $this->personName($teacher), 'room' => $room];
    }

    /** "STEM 11-1", or a near spelling of it such as "HUMS 11-2" for "HUMSS 11-2". */
    private function looksLikeSection(string $upper, string $section): bool
    {
        return $upper === $this->text($section) || preg_match('/^[A-Z]{2,6}\s?\d{1,2}\s?-\s?\d{1,2}$/', $upper) === 1;
    }

    /** The workbook writes times without AM or PM. School hours run from 6:00 AM, so 1:00 to 5:59 is PM. */
    private function clock(int $hour, int $minute): string
    {
        if ($hour >= 1 && $hour < 6) {
            $hour += 12;
        }

        return sprintf('%02d:%02d', $hour, $minute);
    }

    /** A teacher's name without "Mr.", "Ms.", "Mrs.", "Dr." or "Sir". */
    private function personName(string $name): string
    {
        return trim(preg_replace("/^(MR|MRS|MS|MISS|DR|SIR|MA'?AM)\\.?\\s+/i", '', trim($name)));
    }

    private function isGrade(int $grade): bool
    {
        return $grade >= 7 && $grade <= 12;
    }

    private function clean(string $value, bool $dropSectionLabel = false): string
    {
        $value = trim(preg_replace('/\s+/', ' ', $value));

        return $dropSectionLabel ? trim(preg_replace('/^SECTION\s*:?\s*/i', '', $value)) : $value;
    }

    private function text(mixed $value): string
    {
        return strtoupper(trim(preg_replace('/\s+/', ' ', (string) $value)));
    }
}
