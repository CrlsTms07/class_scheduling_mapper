<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Asynchronous sessions (Senior High, team decision, Nov 21, 2026): a period of the class hours can
 * be asynchronous, like the session after the break on the SHS Class Program. A class placed there
 * keeps its subject and teacher but needs no room, so it never blocks a room. Where the session
 * falls is set in Class Hours, not in code.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE time_slots ADD COLUMN is_async BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE time_slots ADD CONSTRAINT async_is_a_period CHECK (NOT (is_async AND is_break));
ALTER TABLE schedule_entries ADD COLUMN is_async BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE schedule_entries DROP CONSTRAINT entry_complete_unless_draft;
ALTER TABLE schedule_entries ADD CONSTRAINT entry_complete_unless_draft
    CHECK (status = 'draft' OR activity_id IS NOT NULL OR (section_subject_id IS NOT NULL AND (room_id IS NOT NULL OR is_async)));
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE schedule_entries DROP CONSTRAINT entry_complete_unless_draft;
ALTER TABLE schedule_entries ADD CONSTRAINT entry_complete_unless_draft
    CHECK (status = 'draft' OR activity_id IS NOT NULL OR (section_subject_id IS NOT NULL AND room_id IS NOT NULL));
ALTER TABLE schedule_entries DROP COLUMN IF EXISTS is_async;
ALTER TABLE time_slots DROP CONSTRAINT IF EXISTS async_is_a_period;
ALTER TABLE time_slots DROP COLUMN IF EXISTS is_async;
SQL);
    }
};
