<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Empties the school's records so a fresh set can be imported: sections, teachers, subjects,
 * rooms and buildings, bell schedules, teacher loading, schedules, approvals and the audit log.
 *
 * Kept: accounts and their roles and grade levels, Grades 7 to 12, school years and terms,
 * the school profile and logos, report settings and signatories, and the short lists the
 * forms offer (departments, designations, teaching tasks and tracks).
 */
class ClearSchoolData extends Command
{
    protected $signature = 'app:clear-school-data {--force : Do not ask first}';

    protected $description = 'Delete the school records (sections, teachers, subjects, rooms, schedules...) and keep the accounts and settings';

    /** Children before parents, so the order also reads as what depends on what. */
    public const TABLES = [
        'schedule_flag_acknowledgements',
        'schedule_entries',
        'schedule_reviews',
        'auto_fill_runs',
        'section_subjects',
        'activities',
        'sections',
        'subjects',
        'teacher_tasks',
        'teacher_qualifications',
        'teachers',
        'time_slots',
        'day_patterns',
        'rooms',
        'buildings',
        'audit_logs',
    ];

    public function handle(): int
    {
        $database = DB::connection()->getDatabaseName();
        $counts = collect(self::TABLES)->mapWithKeys(fn (string $table) => [$table => DB::table($table)->count()]);

        $this->info("Database: {$database}");
        $this->table(['Table', 'Rows to delete'], $counts->map(fn (int $count, string $table) => [$table, $count])->values()->all());

        if (! $this->option('force') && ! $this->confirm("Delete these rows from {$database}? This cannot be undone.")) {
            $this->line('Nothing was deleted.');

            return self::SUCCESS;
        }

        DB::transaction(function () {
            // A department may name a faculty room. The department stays, the room does not.
            DB::table('departments')->update(['faculty_room_id' => null]);

            // TRUNCATE is refused while a kept table (departments) points at rooms, so delete in order.
            foreach (self::TABLES as $table) {
                DB::table($table)->delete();
                // New records start from 1 again.
                if (Schema::hasColumn($table, 'id')) {
                    DB::statement("SELECT setval(pg_get_serial_sequence('{$table}', 'id'), 1, false) WHERE pg_get_serial_sequence('{$table}', 'id') IS NOT NULL");
                }
            }
        });

        $this->info('Done. '.$counts->sum().' rows were deleted. Accounts, school years and settings were kept.');

        return self::SUCCESS;
    }
}
