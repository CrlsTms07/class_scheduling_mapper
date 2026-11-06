<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Synthetic records for development and demos. No real names are used here.
 * The JHS bell schedule follows the school's official Class Program form.
 *
 * Every demo account uses the password: Password123!
 */
class DemoDataSeeder extends Seeder
{
    private const MON_THU_SLOTS = [
        [1, null, '06:30', '07:15'],
        [2, null, '07:15', '08:00'],
        [3, null, '08:00', '09:20'],
        [null, 'Break', '09:20', '09:40'],
        [4, null, '09:40', '10:25'],
        [5, null, '10:25', '11:45'],
        [6, null, '11:45', '12:30'],
        [null, 'Lunch', '12:30', '12:50'],
        [7, null, '12:50', '14:10'],
        [8, null, '14:10', '14:55'],
        [9, null, '14:55', '15:40'],
        [10, null, '15:40', '16:25'],
    ];

    private const FRIDAY_SLOTS = [
        [1, null, '06:30', '07:10'],
        [2, null, '07:10', '07:50'],
        [3, null, '07:50', '09:10'],
        [null, 'Break', '09:10', '09:30'],
        [4, null, '09:30', '10:10'],
        [5, null, '10:10', '11:30'],
        [6, null, '11:30', '12:10'],
        [null, 'Lunch', '12:10', '12:30'],
        [7, null, '12:30', '13:50'],
        [8, null, '13:50', '14:30'],
        [9, null, '14:30', '15:10'],
        [10, null, '15:10', '15:50'],
        [11, null, '15:50', '16:30'],
    ];

    // Name => minutes per week. Homeroom stays at 60 until the client answers Q2 in docs/analysis.md.
    private const GRADE_7_SUBJECTS = [
        'Values Education' => 220,
        'Filipino' => 220,
        'Enhanced Mathematics' => 400,
        'Araling Panlipunan' => 220,
        'Enhanced English' => 400,
        'TLE' => 220,
        'Enhanced Science' => 400,
        'MAPEH' => 220,
        'Research 1' => 220,
        'Environmental Science' => 220,
        'Homeroom Guidance' => 60,
    ];

    public function run(): void
    {
        $this->seedAccounts();

        $schoolYearId = DB::table('school_years')->insertGetId([
            'name' => '2026-2027',
            'term_count' => 3,
            'term_label' => 'Term',
            'start_date' => '2026-06-08',
            'end_date' => '2027-03-26',
        ]);

        $activeTermId = $this->seedTerms($schoolYearId);
        $this->seedBellSchedule($schoolYearId);
        $this->seedGradeSeven($schoolYearId, $activeTermId);
        $this->seedDocumentSettings();

        foreach (['Academic', 'TechPro'] as $track) {
            DB::table('tracks')->insert(['name' => $track]);
        }
    }

    private function seedAccounts(): void
    {
        $accounts = [
            ['admin', 'super_admin', []],
            ['glc', 'glc', [7, 8, 9, 10]],
            ['master.teacher', 'master_teacher', [11, 12]],
            ['teacher', 'teacher', []],
        ];

        foreach ($accounts as [$name, $role, $grades]) {
            $user = User::create([
                'email' => "{$name}@deped.gov.ph",
                'password' => 'Password123!',
                'first_name' => 'Demo',
                'last_name' => ucwords(str_replace(['.', '_'], ' ', $role)),
                'status' => 'active',
            ]);
            $user->assignRole($role);

            foreach ($grades as $grade) {
                DB::table('user_grade_levels')->insert([
                    'user_id' => $user->id,
                    'grade_level_id' => DB::table('grade_levels')->where('grade', $grade)->value('id'),
                ]);
            }
        }
    }

    private function seedTerms(int $schoolYearId): int
    {
        $terms = [
            [1, 'First Term', '2026-06-08', '2026-09-11', false],
            [2, 'Second Term', '2026-09-14', '2026-12-18', true],
            [3, 'Third Term', '2027-01-04', '2027-03-26', false],
        ];

        foreach ($terms as [$termNo, $name, $start, $end, $isActive]) {
            DB::table('school_terms')->insert([
                'school_year_id' => $schoolYearId,
                'term_no' => $termNo,
                'name' => $name,
                'start_date' => $start,
                'end_date' => $end,
                'is_active' => $isActive,
            ]);
        }

        return DB::table('school_terms')->where('is_active', true)->value('id');
    }

    private function seedBellSchedule(int $schoolYearId): void
    {
        $patterns = [
            ['Monday – Thursday', '{1,2,3,4}', self::MON_THU_SLOTS],
            ['Friday', '{5}', self::FRIDAY_SLOTS],
        ];

        foreach ($patterns as [$name, $days, $slots]) {
            $patternId = DB::table('day_patterns')->insertGetId([
                'school_year_id' => $schoolYearId,
                'level' => 'JHS',
                'shift' => 'WHOLE_DAY',
                'name' => $name,
                'days' => $days,
            ]);

            foreach ($slots as [$periodNo, $label, $start, $end]) {
                DB::table('time_slots')->insert([
                    'day_pattern_id' => $patternId,
                    'period_no' => $periodNo,
                    'label' => $label,
                    'start_time' => $start,
                    'end_time' => $end,
                    'is_break' => $periodNo === null,
                ]);
            }
        }
    }

    /**
     * Two fully loaded Grade 7 sections, so the plotter has data to work with.
     */
    private function seedGradeSeven(int $schoolYearId, int $termId): void
    {
        $gradeId = DB::table('grade_levels')->where('grade', 7)->value('id');
        $buildingId = DB::table('buildings')->insertGetId(['name' => 'Sample Building']);

        $roomIds = [];
        foreach (['101', '102', '103'] as $roomNumber) {
            $roomIds[] = DB::table('rooms')->insertGetId([
                'building_id' => $buildingId,
                'room_number' => $roomNumber,
                'capacity' => 45,
            ]);
        }

        $teacherIds = [];
        foreach (array_keys(self::GRADE_7_SUBJECTS) as $index => $subject) {
            $teacherIds[] = DB::table('teachers')->insertGetId([
                'first_name' => 'Teacher',
                'last_name' => 'Sample '.($index + 1),
            ]);
        }

        // The demo teacher account can see a real schedule once entries exist.
        DB::table('teachers')->where('id', $teacherIds[0])->update([
            'user_id' => User::where('email', 'teacher@deped.gov.ph')->value('id'),
        ]);

        $sectionIds = [];
        foreach (['Sample A', 'Sample B'] as $index => $name) {
            $sectionIds[] = DB::table('sections')->insertGetId([
                'school_year_id' => $schoolYearId,
                'grade_level_id' => $gradeId,
                'name' => $name,
                'adviser_id' => $teacherIds[$index],
                'home_room_id' => $roomIds[$index],
                'class_size' => 40,
            ]);
        }

        foreach (array_keys(self::GRADE_7_SUBJECTS) as $index => $name) {
            $minutes = self::GRADE_7_SUBJECTS[$name];
            $isHomeroom = $name === 'Homeroom Guidance';

            $subjectId = DB::table('subjects')->insertGetId([
                'school_year_id' => $schoolYearId,
                'grade_level_id' => $gradeId,
                'name' => $name,
                'subject_type' => $isHomeroom ? 'other' : 'core',
                'minutes_per_week' => $minutes,
                'is_priority' => $isHomeroom,
            ]);

            // Both sections share the same teachers, so teacher conflicts can be tried out.
            foreach ($sectionIds as $sectionId) {
                DB::table('section_subjects')->insert([
                    'term_id' => $termId,
                    'section_id' => $sectionId,
                    'subject_id' => $subjectId,
                    'teacher_id' => $teacherIds[$index],
                ]);
            }
        }
    }

    /**
     * Placeholder document details, all editable later in Admin → Report Settings.
     */
    private function seedDocumentSettings(): void
    {
        DB::table('school_profile')->insert([
            'school_name' => 'Emmanuel Resurreccion Congressional Integrated High School',
            'address' => 'Sample Address, Sample City',
            'phone' => '(000) 000-0000',
            'email' => 'school@deped.gov.ph',
            'website' => 'https://www.example.com',
            'logo_path' => 'resources/report-assets/school-logo.png',
        ]);

        DB::table('report_settings')->insert([
            'report_type' => 'class_program',
            'level' => 'JHS',
            'title_format' => '{level} GRADE {grade} – CLASS PROGRAM',
            'doc_ref_code' => 'SAMPLE-F001',
            'revision_no' => '00',
            'effectivity_date' => '2026-06-08',
            'reference_note' => 'DO 12, s. 2024',
        ]);

        $signatories = [
            ['Prepared by', 'Sample Head Teacher', 'Head Teacher III', null],
            ['Conforme', null, 'Class Adviser', 'section_adviser'],
            ['Recommending Approval', 'Sample Principal', 'School Principal II', null],
            ['Approved by', 'Sample Supervisor', 'PSDS Cluster IV', null],
        ];

        foreach (DB::table('school_terms')->pluck('id') as $termId) {
            foreach ($signatories as $index => [$label, $name, $position, $autoSource]) {
                DB::table('report_signatories')->insert([
                    'term_id' => $termId,
                    'report_type' => 'class_program',
                    'level' => 'JHS',
                    'label' => $label,
                    'name' => $name,
                    'position' => $position,
                    'auto_source' => $autoSource,
                    'sort_order' => $index + 1,
                ]);
            }
        }
    }
}
