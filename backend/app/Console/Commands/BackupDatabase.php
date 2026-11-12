<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

/**
 * Saves a copy of the whole database with pg_dump, named by date, in storage/app/private/backups
 * (kept out of Git). Run it before the evaluation and before any big change. --url backs up
 * another database, such as Neon, from a computer that has the PostgreSQL tools.
 */
class BackupDatabase extends Command
{
    protected $signature = 'app:backup {--url= : A postgresql:// connection URL; the app\'s own database when left out}';

    protected $description = 'Save a dated copy of the database (pg_dump) in storage/app/private/backups';

    public function handle(): int
    {
        $folder = storage_path('app/private/backups');
        if (! is_dir($folder)) {
            mkdir($folder, 0775, true);
        }

        $url = (string) ($this->option('url') ?: config('database.connections.pgsql.url'));
        $connection = config('database.connections.pgsql');
        $name = ($url !== '' ? (parse_url($url, PHP_URL_PATH) ? ltrim((string) parse_url($url, PHP_URL_PATH), '/') : 'database') : $connection['database']);
        $file = $folder.DIRECTORY_SEPARATOR.preg_replace('/[^A-Za-z0-9_-]/', '_', $name).'-'.now()->format('Y-m-d-His').'.dump';

        // Custom format (-Fc): compressed, and pg_restore can bring back all or part of it.
        $command = $url !== ''
            ? ['pg_dump', '--format=custom', '--no-owner', '--file='.$file, $url]
            : ['pg_dump', '--format=custom', '--no-owner', '--file='.$file, '--host='.$connection['host'], '--port='.$connection['port'], '--username='.$connection['username'], $connection['database']];

        $process = new Process($command, null, ['PGPASSWORD' => (string) ($connection['password'] ?? '')], null, 600);
        $process->run();

        if (! $process->isSuccessful() || ! is_file($file)) {
            $this->error('The backup failed: '.trim($process->getErrorOutput() ?: $process->getOutput()));
            $this->line('Make sure the PostgreSQL tools (pg_dump) are installed and the same version as the database, or newer.');

            return self::FAILURE;
        }

        $this->info('Saved: '.$file.' ('.round(filesize($file) / 1024).' KB)');
        $this->line('To bring it back: pg_restore --clean --if-exists --no-owner -d "<connection URL>" "'.$file.'"');

        return self::SUCCESS;
    }
}
