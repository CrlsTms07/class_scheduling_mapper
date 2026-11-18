<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Free hosting erases its disk on every restart, so logos now live in the database.
// Logos already on this computer or server are carried over.
return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE TABLE school_logos (
    id            BIGSERIAL PRIMARY KEY,
    mime_type     VARCHAR(50) NOT NULL,
    image_base64  TEXT        NOT NULL,      -- the first logo is the school's own
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL);

        $profile = DB::table('school_profile')->first();

        if ($profile) {
            $paths = array_filter([$profile->logo_path, ...json_decode($profile->extra_logos, true)]);

            foreach ($paths as $path) {
                $file = base_path($path);

                if (is_file($file)) {
                    DB::table('school_logos')->insert([
                        'mime_type' => mime_content_type($file),
                        'image_base64' => base64_encode(file_get_contents($file)),
                    ]);
                }
            }
        }

        DB::unprepared('ALTER TABLE school_profile DROP COLUMN logo_path, DROP COLUMN extra_logos;');
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
ALTER TABLE school_profile
    ADD COLUMN logo_path   VARCHAR(255),
    ADD COLUMN extra_logos JSONB NOT NULL DEFAULT '[]';
DROP TABLE IF EXISTS school_logos;
SQL);
    }
};
