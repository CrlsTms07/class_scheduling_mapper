<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);
    $this->admin = User::factory()->create(['status' => 'active'])->assignRole('super_admin');
    $this->teacher = User::factory()->create(['status' => 'active', 'password' => 'OldPassword123!'])->assignRole('teacher');
});

it('gives a temporary password once, signs the account out, and asks for a new one', function () {
    DB::table('sessions')->insert(['id' => 'abc', 'user_id' => $this->teacher->id, 'payload' => '', 'last_activity' => time()]);
    $this->actingAs($this->admin);

    $temporary = $this->postJson("/api/users/{$this->teacher->id}/reset-password")->assertOk()->json('temporary_password');

    expect($temporary)->toMatch('/^ERC-[A-Z0-9]{4}-\d{4}$/')
        ->and(Hash::check($temporary, $this->teacher->fresh()->password))->toBeTrue()
        ->and($this->teacher->fresh()->must_change_password)->toBeTrue()
        ->and(DB::table('sessions')->where('user_id', $this->teacher->id)->count())->toBe(0);

    // A new sign-in: the old session ended when the password changed.
    $this->flushSession();
    $this->app['auth']->forgetGuards();
    $this->actingAs($this->teacher->fresh());
    $this->getJson('/api/me')->assertJsonPath('data.must_change_password', true);

    $this->putJson('/api/me/password', ['current_password' => $temporary, 'password' => $temporary, 'password_confirmation' => $temporary])
        ->assertUnprocessable()->assertJsonValidationErrors('password');
    $this->putJson('/api/me/password', ['current_password' => 'wrong', 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'])
        ->assertUnprocessable()->assertJsonValidationErrors('current_password');

    $this->putJson('/api/me/password', ['current_password' => $temporary, 'password' => 'NewPassword123!', 'password_confirmation' => 'NewPassword123!'])
        ->assertOk()->assertJsonPath('data.must_change_password', false);
    expect(Hash::check('NewPassword123!', $this->teacher->fresh()->password))->toBeTrue();
});

it('is for the Admin only, and not for the Admin\'s own account', function () {
    $this->actingAs($this->teacher);
    $this->postJson("/api/users/{$this->admin->id}/reset-password")->assertForbidden();

    $this->flushSession();
    $this->app['auth']->forgetGuards();
    $this->actingAs($this->admin);
    $this->postJson("/api/users/{$this->admin->id}/reset-password")->assertForbidden();
});

it('leaves other accounts as they are', function () {
    $this->actingAs($this->teacher);

    $this->getJson('/api/me')->assertJsonPath('data.must_change_password', false);
});
