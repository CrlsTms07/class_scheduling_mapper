<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Team decisions, Nov 12, 2026:
 * - Every teacher carries at most 5 subjects (config school.max_subjects), the same for all.
 * - An account whose password the Admin reset must choose a new one on the next sign-in.
 * - The school's region and division head the printed forms; each logo is printed at the top
 *   (like the DepEd seal) or in the footer (DepEd, Bagong Pilipinas, the school seal).
 * - A room can name who is in charge of it, such as the teacher of an ICT lab.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('teachers')->update(['max_subjects' => 5]);

        Schema::table('users', function (Blueprint $table) {
            $table->boolean('must_change_password')->default(false);
        });

        Schema::table('school_profile', function (Blueprint $table) {
            $table->string('region', 120)->nullable();
            $table->string('division', 150)->nullable();
        });

        Schema::table('school_logos', function (Blueprint $table) {
            $table->string('placement', 10)->default('header');
        });
        DB::statement("ALTER TABLE school_logos ADD CONSTRAINT school_logos_placement_check CHECK (placement IN ('header', 'footer'))");

        Schema::table('rooms', function (Blueprint $table) {
            $table->string('in_charge', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('rooms', fn (Blueprint $table) => $table->dropColumn('in_charge'));
        DB::statement('ALTER TABLE school_logos DROP CONSTRAINT IF EXISTS school_logos_placement_check');
        Schema::table('school_logos', fn (Blueprint $table) => $table->dropColumn('placement'));
        Schema::table('school_profile', fn (Blueprint $table) => $table->dropColumn(['region', 'division']));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('must_change_password'));
    }
};
