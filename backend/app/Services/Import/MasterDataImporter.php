<?php

namespace App\Services\Import;

use App\Models\SchoolYear;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * One kind of master-data import. MasterDataImportService runs every row through handle(),
 * inside one transaction, for a preview (rolled back) and for the import itself (kept), so a
 * preview always says exactly what the import will do.
 */
abstract class MasterDataImporter
{
    protected SchoolYear $year;

    protected User $user;

    protected string $onDuplicate = 'skip';

    public function __construct(protected AuditLogger $audit) {}

    /**
     * The template's columns, in order: column => required.
     *
     * @return array<string, bool>
     */
    abstract public function columns(): array;

    /**
     * One example row for the template.
     *
     * @return array<string, string>
     */
    abstract public function example(): array;

    /**
     * What each column takes, shown on the template's second sheet.
     *
     * @return array<string, string>
     */
    abstract public function notes(): array;

    /** The table the audit log names, e.g. "teachers". */
    abstract public function table(): string;

    /**
     * The key that must not repeat in one file (lower case), or null when the row lacks it.
     *
     * @param  array<string, mixed>  $row
     */
    abstract public function key(array $row): ?string;

    /**
     * How a row is shown in the preview, e.g. "Ana Reyes (4512301)".
     *
     * @param  array<string, mixed>  $row
     */
    abstract public function label(array $row): string;

    /**
     * Checks one row against the database and saves it when it is new or an update.
     *
     * @param  array<string, mixed>  $row
     * @return array{0: string, 1: array<int, string>} status and readable messages
     */
    abstract public function handle(array $row): array;

    /** The key's name in a message, e.g. 'employee ID "4512301"'. */
    abstract public function describeKey(array $row): string;

    /**
     * Called once before the rows, with the school year imported into.
     */
    public function start(SchoolYear $year, User $user, string $onDuplicate): void
    {
        $this->year = $year;
        $this->user = $user;
        $this->onDuplicate = $onDuplicate;
    }

    /**
     * A grade typed as "7", "Grade 7", "G7" or "grade-7": the grade_levels row id, or null.
     */
    protected function gradeLevelId(string $typed): ?int
    {
        if (! preg_match('/^(?:grade|gr|g)?\s*[-.]?\s*(\d{1,2})$/i', trim($typed), $match)) {
            return null;
        }

        return DB::table('grade_levels')->where('grade', (int) $match[1])->value('id');
    }

    /**
     * A name in a list table matched in any letter case and spacing, or null.
     */
    protected function idByName(string $table, string $name, string $column = 'name'): ?int
    {
        $id = DB::table($table)->whereRaw("LOWER(TRIM({$column})) = LOWER(?)", [trim($name)])->value('id');

        return $id === null ? null : (int) $id;
    }

    /**
     * Junior High, Senior High or shared, typed as "JHS", "Junior High", "SHS", "senior high",
     * "shared" or left empty. False when it is none of these.
     */
    protected function department(string $typed): string|null|false
    {
        $text = strtolower(preg_replace('/[^a-z]/i', '', $typed));

        return match ($text) {
            'jhs', 'juniorhigh', 'juniorhighschool' => 'JHS',
            'shs', 'seniorhigh', 'seniorhighschool' => 'SHS',
            '', 'shared', 'both' => null,
            default => false,
        };
    }

    protected function skipOrUpdate(): string
    {
        return $this->onDuplicate === 'update' ? 'update' : 'skip';
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>  $after
     */
    protected function log(string $action, int $id, ?array $before, array $after): void
    {
        $this->audit->log($this->user, $action, $this->table(), $id, $before, ['source' => 'import', ...$after]);
    }
}
