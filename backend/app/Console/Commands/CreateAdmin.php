<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Rules\DepEdEmail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * Creates the first Admin on a new server. Nobody else can activate accounts until one exists.
 */
class CreateAdmin extends Command
{
    protected $signature = 'app:create-admin';

    protected $description = 'Create an active Admin account';

    public function handle(): int
    {
        $data = [
            'email' => strtolower(trim((string) $this->ask('DepEd email'))),
            'first_name' => trim((string) $this->ask('First name')),
            'last_name' => trim((string) $this->ask('Last name')),
            'password' => (string) $this->secret('Password'),
        ];

        $validator = Validator::make($data, [
            'email' => ['required', 'email', 'max:150', new DepEdEmail, 'unique:users,email'],
            'first_name' => ['required', 'max:60'],
            'last_name' => ['required', 'max:60'],
            'password' => ['required', Password::defaults()],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        User::create([...$data, 'status' => 'active'])->assignRole(User::ROLE_ADMIN);

        $this->info("Admin account created for {$data['email']}.");

        return self::SUCCESS;
    }
}
