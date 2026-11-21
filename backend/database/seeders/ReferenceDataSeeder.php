<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

/**
 * Fixed values the system cannot run without: the four roles, Grades 7 to 12, and DepEd's
 * teacher designations (a teacher's designation is required since Nov 21, 2026; more can be added).
 */
class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['super_admin', 'glc', 'master_teacher', 'teacher'] as $role) {
            Role::findOrCreate($role, 'web');
        }

        foreach (range(7, 12) as $grade) {
            DB::table('grade_levels')->updateOrInsert(
                ['grade' => $grade],
                ['level' => $grade <= 10 ? 'JHS' : 'SHS'],
            );
        }

        $designations = ['Teacher I', 'Teacher II', 'Teacher III', 'Master Teacher I', 'Master Teacher II', 'Master Teacher III', 'Master Teacher IV',
            'Head Teacher I', 'Head Teacher II', 'Head Teacher III', 'Head Teacher IV', 'Head Teacher V', 'Head Teacher VI'];
        foreach ($designations as $name) {
            DB::table('designations')->updateOrInsert(['name' => $name]);
        }
    }
}
