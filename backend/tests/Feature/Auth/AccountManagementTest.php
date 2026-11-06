<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);
    $this->admin = User::factory()->create(['last_name' => 'Zamora'])->assignRole('super_admin');
});

describe('account list', function () {
    it('shows the Admin all accounts with pending sign-ups first', function () {
        $pending = User::factory()->pending()->create(['last_name' => 'Yap']);

        $this->actingAs($this->admin)->getJson('/api/users')
            ->assertOk()
            ->assertJsonPath('data.0.id', $pending->id)
            ->assertJsonPath('data.0.status', 'pending')
            ->assertJsonMissingPath('data.0.password');
    });

    it('is only for the Admin', function (string $role) {
        $this->actingAs(User::factory()->create()->assignRole($role))->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/users/access-options')->assertForbidden();
    })->with(['glc', 'master_teacher', 'teacher']);

    it('offers grade levels and personnel records without an account', function () {
        DB::table('teachers')->insert([
            ['first_name' => 'Free', 'last_name' => 'Teacher', 'user_id' => null],
            ['first_name' => 'Linked', 'last_name' => 'Teacher', 'user_id' => $this->admin->id],
        ]);

        $data = $this->actingAs($this->admin)->getJson('/api/users/access-options')->assertOk()->json('data');

        expect($data['grade_levels'])->toHaveCount(6)
            ->and(collect($data['teachers'])->pluck('first_name')->all())->toBe(['Free']);
    });
});

describe('app:create-admin', function () {
    function runCreateAdmin(object $test, string $email, string $password = 'Password123!')
    {
        return $test->artisan('app:create-admin')
            ->expectsQuestion('DepEd email', $email)
            ->expectsQuestion('First name', 'First')
            ->expectsQuestion('Last name', 'Admin')
            ->expectsQuestion('Password', $password);
    }

    it('creates an active Admin who can sign in', function () {
        runCreateAdmin($this, 'first.admin@deped.gov.ph')->assertSuccessful();

        $user = User::where('email', 'first.admin@deped.gov.ph')->first();

        expect($user->status)->toBe('active')
            ->and($user->hasRole('super_admin'))->toBeTrue()
            ->and($user->password)->not->toBe('Password123!');
    });

    it('refuses an email that is not an official DepEd email', function () {
        runCreateAdmin($this, 'someone@gmail.com')->assertFailed();

        expect(User::where('email', 'someone@gmail.com')->exists())->toBeFalse();
    });

    it('refuses a weak password', function () {
        runCreateAdmin($this, 'first.admin@deped.gov.ph', 'weak')->assertFailed();

        expect(User::where('email', 'first.admin@deped.gov.ph')->exists())->toBeFalse();
    });
});
