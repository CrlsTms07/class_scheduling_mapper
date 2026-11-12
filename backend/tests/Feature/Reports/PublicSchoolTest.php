<?php

use App\Models\User;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:5173');
    $this->seed(ReferenceDataSeeder::class);
});

it('shows the school details to anyone, from the built-in defaults at first', function () {
    $this->getJson('/api/public/school')
        ->assertOk()
        ->assertJsonPath('data.school_name', 'Emmanuel Resurreccion Congressional Integrated High School')
        ->assertJsonPath('data.short_name', 'ERCIHS')
        ->assertJsonPath('data.email', '301179@deped.gov.ph')
        ->assertJsonPath('data.has_photo', false);
});

it('uses what the Admin saved, and the defaults for what is left empty', function () {
    $this->actingAs(User::factory()->create()->assignRole('super_admin'));

    $this->putJson('/api/school-profile', [
        'school_name' => 'ERCIHS', 'address' => 'New address', 'phone' => null, 'email' => null, 'website' => null,
        'vision' => 'Our vision', 'mission' => 'Our mission', 'core_values' => 'Maka-Diyos',
    ])->assertOk();

    $this->getJson('/api/public/school')
        ->assertJsonPath('data.address', 'New address')
        ->assertJsonPath('data.vision', 'Our vision')
        ->assertJsonPath('data.phone', '(046) 894-1463 / (046) 472-9768');
});

it('serves the campus photo the Admin uploads, and removes it', function () {
    $this->actingAs(User::factory()->create()->assignRole('super_admin'));
    $this->putJson('/api/school-profile', ['school_name' => 'ERCIHS'])->assertOk();

    $this->post('/api/school-profile/photo', ['photo' => UploadedFile::fake()->image('campus.jpg', 1200, 600)], ['Accept' => 'application/json'])
        ->assertOk();

    $this->getJson('/api/public/school')->assertJsonPath('data.has_photo', true);
    $this->get('/api/public/school/photo')->assertOk()->assertHeader('Content-Type', 'image/jpeg');

    $this->deleteJson('/api/school-profile/photo')->assertOk();
    $this->get('/api/public/school/photo')->assertNotFound();
});

it('lets only the Admin change the photo, and only to an image', function () {
    DB::table('school_profile')->insert(['school_name' => 'ERCIHS']);

    $this->actingAs(User::factory()->create()->assignRole('glc'));
    $this->post('/api/school-profile/photo', ['photo' => UploadedFile::fake()->image('campus.jpg')], ['Accept' => 'application/json'])
        ->assertForbidden();

    $this->actingAs(User::factory()->create()->assignRole('super_admin'));
    $this->post('/api/school-profile/photo', ['photo' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
        ->assertUnprocessable();
});
