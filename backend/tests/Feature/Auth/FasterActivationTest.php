<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);
    $this->admin = User::factory()->create()->assignRole('super_admin');
});

function signUpBody(array $overrides = []): array
{
    return [
        'first_name' => 'Ana', 'middle_name' => '', 'last_name' => 'Reyes', 'suffix' => '',
        'email' => 'ana.reyes@deped.gov.ph', 'password' => 'Password123!', 'password_confirmation' => 'Password123!',
        'accept_terms' => true, 'accept_privacy' => true, ...$overrides,
    ];
}

it('makes a sign-up on the list of teachers an active Teacher right away, linked to the record', function () {
    $teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes', 'personnel_type' => 'teaching']);

    $this->postJson('/api/register', signUpBody(['first_name' => ' ana ']))
        ->assertCreated()
        ->assertJsonPath('status', 'active')
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'sign in now'));

    $user = User::where('email', 'ana.reyes@deped.gov.ph')->first();
    expect($user->status)->toBe('active')
        ->and($user->hasRole('teacher'))->toBeTrue()
        ->and(DB::table('teachers')->where('id', $teacherId)->value('user_id'))->toBe($user->id)
        ->and(DB::table('audit_logs')->where('action', 'auto_activate')->count())->toBe(1);
});

it('keeps everyone else waiting for the Admin', function (array $records) {
    foreach ($records as $record) {
        DB::table('teachers')->insert($record);
    }

    $this->postJson('/api/register', signUpBody())->assertCreated()->assertJsonPath('status', 'pending');

    expect(User::where('email', 'ana.reyes@deped.gov.ph')->value('status'))->toBe('pending');
})->with([
    'no record' => [[]],
    'two records with the name' => [[['first_name' => 'Ana', 'last_name' => 'Reyes', 'personnel_type' => 'teaching'], ['first_name' => 'Ana', 'last_name' => 'Reyes', 'personnel_type' => 'teaching']]],
    'non-teaching personnel' => [[['first_name' => 'Ana', 'last_name' => 'Reyes', 'personnel_type' => 'non_teaching']]],
]);

it('can be turned off', function () {
    config(['school.auto_activate_teachers' => false]);
    DB::table('teachers')->insert(['first_name' => 'Ana', 'last_name' => 'Reyes', 'personnel_type' => 'teaching']);

    $this->postJson('/api/register', signUpBody())->assertCreated()->assertJsonPath('status', 'pending');
});

it('activates many waiting sign-ups as Teachers at once, linking those on the list', function () {
    $ana = User::factory()->create(['status' => 'pending', 'first_name' => 'Ana', 'last_name' => 'Reyes']);
    $ben = User::factory()->create(['status' => 'pending', 'first_name' => 'Ben', 'last_name' => 'Cruz']);
    $active = User::factory()->create(['status' => 'active'])->assignRole('glc');
    $teacherId = DB::table('teachers')->insertGetId(['first_name' => 'Ana', 'last_name' => 'Reyes', 'personnel_type' => 'teaching']);
    $this->actingAs($this->admin);

    $this->getJson('/api/users')->assertJsonFragment(['matching_personnel' => ['id' => $teacherId, 'name' => 'Ana Reyes']]);

    $this->postJson('/api/users/activate-teachers', ['user_ids' => [$ana->id, $ben->id, $active->id]])
        ->assertOk()
        ->assertJsonPath('data', ['activated' => 2, 'linked' => 1]);

    expect($ana->fresh()->status)->toBe('active')->and($ana->fresh()->hasRole('teacher'))->toBeTrue()
        ->and($ben->fresh()->hasRole('teacher'))->toBeTrue()
        ->and($active->fresh()->hasRole('glc'))->toBeTrue()
        ->and(DB::table('teachers')->where('id', $teacherId)->value('user_id'))->toBe($ana->id);
});

it('lets only the Admin activate many at once', function () {
    $pending = User::factory()->create(['status' => 'pending']);
    $this->actingAs(User::factory()->create()->assignRole('glc'));

    $this->postJson('/api/users/activate-teachers', ['user_ids' => [$pending->id]])->assertForbidden();
});
