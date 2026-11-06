<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(150) UNIQUE NOT NULL
                    CHECK (email ILIKE '%@deped.gov.ph'),   -- DepEd email requirement
    password        VARCHAR(255) NOT NULL,                  -- bcrypt hash, never plain text
    remember_token  VARCHAR(100),                           -- Laravel "remember me"
    first_name      VARCHAR(60)  NOT NULL,
    middle_name     VARCHAR(60),
    last_name       VARCHAR(60)  NOT NULL,
    suffix          VARCHAR(10),
    phone_number    VARCHAR(20),
    status          account_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL);

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
