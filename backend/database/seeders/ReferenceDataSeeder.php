<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

/**
 * Fixed values the system cannot run without: the four roles and Grades 7 to 12.
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
    }
}
