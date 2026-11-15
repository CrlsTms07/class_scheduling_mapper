<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// What the landing page shows about the school, kept with the rest of the school profile.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE school_profile
    ADD COLUMN tagline       VARCHAR(200),
    ADD COLUMN facebook_url  VARCHAR(255),
    ADD COLUMN vision        TEXT,
    ADD COLUMN mission       TEXT,
    ADD COLUMN core_values   VARCHAR(255),
    ADD COLUMN photo_mime    VARCHAR(50),
    ADD COLUMN photo_base64  TEXT;
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE school_profile
    DROP COLUMN tagline, DROP COLUMN facebook_url, DROP COLUMN vision, DROP COLUMN mission,
    DROP COLUMN core_values, DROP COLUMN photo_mime, DROP COLUMN photo_base64;
SQL);
    }
};
