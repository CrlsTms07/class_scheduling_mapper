<?php

namespace App\Services;

use App\Models\SchoolTerm;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * What the printed forms are made from: the school's details and logos, the document
 * control block of each form, and the people who sign them.
 */
class ReportSettingsService
{
    public const MAX_LOGOS = 4;

    public function __construct(private AuditLogger $audit) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function saveProfile(array $data, User $admin): void
    {
        DB::transaction(function () use ($data, $admin) {
            $before = DB::table('school_profile')->first();

            DB::table('school_profile')->updateOrInsert(['id' => 1], $data);

            $this->audit->log($admin, 'update', 'school_profile', 1, (array) $before, $data);
        });
    }

    /**
     * Paths of the logos in printing order. The first one is the school's own logo.
     *
     * @return array<int, string>
     */
    public function logoPaths(): array
    {
        $profile = DB::table('school_profile')->first();

        if (! $profile) {
            return [];
        }

        return array_values(array_filter([$profile->logo_path, ...json_decode($profile->extra_logos, true)]));
    }

    /**
     * The logos as embedded images. The PDF library and the browser both read these directly,
     * so the files never need to be public. A file that is missing on disk is left out.
     *
     * @return array<int, string>
     */
    public function logoDataUris(): array
    {
        $uris = [];

        foreach ($this->logoPaths() as $path) {
            $file = base_path($path);

            if (is_file($file)) {
                $uris[] = 'data:'.mime_content_type($file).';base64,'.base64_encode(file_get_contents($file));
            }
        }

        return $uris;
    }

    public function addLogo(UploadedFile $file, User $admin): void
    {
        if (! DB::table('school_profile')->exists()) {
            throw ValidationException::withMessages(['logo' => 'Save the school name first.']);
        }

        $paths = $this->logoPaths();

        if (count($paths) >= self::MAX_LOGOS) {
            throw ValidationException::withMessages(['logo' => 'A form can have up to '.self::MAX_LOGOS.' logos. Remove one first.']);
        }

        $stored = Storage::disk('local')->putFile('report-assets', $file);
        $relative = str_replace('\\', '/', Str::after(Storage::disk('local')->path($stored), base_path().DIRECTORY_SEPARATOR));

        $this->saveLogoPaths([...$paths, $relative], $admin);
    }

    /**
     * Removing the first logo moves the next one into its place.
     */
    public function removeLogo(int $index, User $admin): void
    {
        $paths = $this->logoPaths();

        if (! isset($paths[$index])) {
            throw ValidationException::withMessages(['logo' => 'This logo no longer exists.']);
        }

        $removed = $paths[$index];
        unset($paths[$index]);
        $this->saveLogoPaths(array_values($paths), $admin);

        // Only uploaded files are deleted, never the images that ship with the system.
        if (str_starts_with($removed, 'storage/') && is_file(base_path($removed))) {
            unlink(base_path($removed));
        }
    }

    /**
     * @param  array<int, string>  $paths
     */
    private function saveLogoPaths(array $paths, User $admin): void
    {
        DB::table('school_profile')->where('id', 1)->update([
            'logo_path' => $paths[0] ?? null,
            'extra_logos' => json_encode(array_slice($paths, 1)),
        ]);

        $this->audit->log($admin, 'update', 'school_profile', 1, null, ['logos' => count($paths)]);
    }

    /**
     * One row per document and department. "All departments" has no level, which the
     * database does not treat as a duplicate, so this looks the row up first.
     *
     * @param  array<string, mixed>  $data
     */
    public function saveDocument(array $data, User $admin): void
    {
        DB::transaction(function () use ($data, $admin) {
            $match = ['report_type' => $data['report_type'], 'level' => $data['level'] ?? null];

            DB::table('report_settings')->updateOrInsert($match, array_diff_key($data, $match));

            $this->audit->log($admin, 'update', 'report_settings', null, null, $data);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function addSignatory(SchoolTerm $term, array $data, User $admin): int
    {
        return DB::transaction(function () use ($term, $data, $admin) {
            $group = $this->groupQuery($term->id, $data['report_type'] ?? null, $data['level'] ?? null);

            $id = DB::table('report_signatories')->insertGetId([
                ...$this->signatoryValues($data),
                'term_id' => $term->id,
                'sort_order' => ((int) $group->max('sort_order')) + 1,
            ]);

            $this->audit->log($admin, 'create', 'report_signatories', $id, null, $data);

            return $id;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateSignatory(int $id, array $data, User $admin): void
    {
        DB::transaction(function () use ($id, $data, $admin) {
            $before = DB::table('report_signatories')->where('id', $id)->first();

            DB::table('report_signatories')->where('id', $id)->update($this->signatoryValues($data));

            $this->audit->log($admin, 'update', 'report_signatories', $id, (array) $before, $data);
        });
    }

    public function deleteSignatory(int $id, User $admin): void
    {
        DB::transaction(function () use ($id, $admin) {
            $before = DB::table('report_signatories')->where('id', $id)->first();

            DB::table('report_signatories')->where('id', $id)->delete();

            $this->audit->log($admin, 'delete', 'report_signatories', $id, (array) $before);
        });
    }

    /**
     * The order decides who signs where on the form, so moving swaps places with a neighbor.
     */
    public function moveSignatory(int $id, string $direction, User $admin): void
    {
        DB::transaction(function () use ($id, $direction, $admin) {
            $signatory = DB::table('report_signatories')->where('id', $id)->first();
            $group = $this->groupQuery($signatory->term_id, $signatory->report_type, $signatory->level)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->pluck('id')
                ->all();

            $from = array_search($id, $group);
            $to = $direction === 'up' ? $from - 1 : $from + 1;

            if (! isset($group[$to])) {
                return;
            }

            [$group[$from], $group[$to]] = [$group[$to], $group[$from]];

            // Numbered fresh, because older rows may share the same number.
            foreach ($group as $index => $rowId) {
                DB::table('report_signatories')->where('id', $rowId)->update(['sort_order' => $index + 1]);
            }

            $this->audit->log($admin, 'update', 'report_signatories', $id, null, ['moved' => $direction]);
        });
    }

    /**
     * Makes the other terms of the school year use this term's signatories.
     *
     * @return int how many terms were changed
     */
    public function copyToOtherTerms(SchoolTerm $term, User $admin): int
    {
        return DB::transaction(function () use ($term, $admin) {
            $rows = DB::table('report_signatories')->where('term_id', $term->id)->get();
            $otherTermIds = SchoolTerm::where('school_year_id', $term->school_year_id)
                ->whereKeyNot($term->id)
                ->pluck('id');

            DB::table('report_signatories')->whereIn('term_id', $otherTermIds)->delete();

            foreach ($otherTermIds as $termId) {
                foreach ($rows as $row) {
                    DB::table('report_signatories')->insert([
                        ...collect($row)->except('id')->all(),
                        'term_id' => $termId,
                    ]);
                }
            }

            $this->audit->log($admin, 'copy', 'report_signatories', $term->id, null, [
                'to_terms' => $otherTermIds->all(),
                'rows' => $rows->count(),
            ]);

            return $otherTermIds->count();
        });
    }

    /**
     * The signatories that appear together on one form.
     */
    private function groupQuery(int $termId, ?string $reportType, ?string $level)
    {
        return DB::table('report_signatories')
            ->where('term_id', $termId)
            ->where(fn ($query) => $reportType === null ? $query->whereNull('report_type') : $query->where('report_type', $reportType))
            ->where(fn ($query) => $level === null ? $query->whereNull('level') : $query->where('level', $level));
    }

    /**
     * An automatic name is filled in per document, so no typed name is kept with it.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function signatoryValues(array $data): array
    {
        $autoSource = $data['auto_source'] ?? null;

        return [
            'report_type' => $data['report_type'] ?? null,
            'level' => $data['level'] ?? null,
            'label' => $data['label'],
            'name' => $autoSource ? null : $data['name'],
            'position' => $data['position'] ?? null,
            'auto_source' => $autoSource,
        ];
    }
}
