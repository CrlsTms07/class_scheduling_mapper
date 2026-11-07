<?php

use Illuminate\Support\Facades\Config;

describe('with a built React app', function () {
    beforeEach(function () {
        $this->index = tempnam(sys_get_temp_dir(), 'spa');
        file_put_contents($this->index, '<!doctype html><title>ERCIHS</title>');
        Config::set('app.spa_index', $this->index);
    });

    afterEach(fn () => unlink($this->index));

    it('serves it at the home page and at any page address', function (string $path) {
        $this->get($path)
            ->assertOk()
            ->assertSee('<title>ERCIHS</title>', false)
            ->assertHeader('Content-Type', 'text/html; charset=utf-8');
    })->with(['/', '/dashboard', '/guest/sections/12', '/schedule/rooms/3']);

    it('asks browsers to check for a new version', function () {
        expect($this->get('/')->headers->get('Cache-Control'))->toContain('no-cache');
    });

    it('leaves the API, the sign-in cookie and the health check alone', function () {
        $this->getJson('/api/does-not-exist')->assertNotFound()->assertJsonMissingPath('title');
        $this->get('/api/does-not-exist')->assertDontSee('<title>ERCIHS</title>', false);
        $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->get('/up')->assertOk()->assertDontSee('<title>ERCIHS</title>', false);
    });
});

describe('without a build, as on a developer computer', function () {
    beforeEach(fn () => Config::set('app.spa_index', base_path('no-such-file.html')));

    it('still answers at the home page', function () {
        $this->get('/')->assertOk()->assertJsonStructure(['name']);
    });

    it('says not found elsewhere', function () {
        $this->get('/dashboard')->assertNotFound();
    });
});

it('reads the address and secure cookies from the proxy of the host', function () {
    $this->withHeaders(['X-Forwarded-Proto' => 'https', 'X-Forwarded-Host' => 'ercihs.example.com'])
        ->get('/up')
        ->assertOk();

    expect(request()->isSecure())->toBeTrue();
});
