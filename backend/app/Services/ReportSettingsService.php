<?php

namespace App\Services;

use App\Models\SchoolTerm;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
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
     * The logos as embedded images, in printing order. The first one is the school's own.
     * The PDF library and the browser both read these directly.
     *
     * @return array<int, string>
     */
    public function logoDataUris(): array
    {
        return DB::table('school_logos')
            ->orderBy('id')
            ->get()
            ->map(fn ($logo) => "data:{$logo->mime_type};base64,{$logo->image_base64}")
            ->all();
    }

    public function addLogo(UploadedFile $file, User $admin): void
    {
        if (! DB::table('school_profile')->exists()) {
            throw ValidationException::withMessages(['logo' => 'Save the school name first.']);
        }

        if (DB::table('school_logos')->count() >= self::MAX_LOGOS) {
            throw ValidationException::withMessages(['logo' => 'A form can have up to '.self::MAX_LOGOS.' logos. Remove one first.']);
        }

        $id = DB::table('school_logos')->insertGetId([
            'mime_type' => $file->getMimeType(),
            'image_base64' => base64_encode($file->getContent()),
        ]);

        $this->audit->log($admin, 'create', 'school_logos', $id);
    }

    /**
     * Removing the first logo moves the next one into its place.
     */
    public function removeLogo(int $index, User $admin): void
    {
        $id = DB::table('school_logos')->orderBy('id')->offset($index)->value('id');

        if (! $id) {
            throw ValidationException::withMessages(['logo' => 'This logo no longer exists.']);
        }

        DB::table('school_logos')->where('id', $id)->delete();

        $this->audit->log($admin, 'delete', 'school_logos', $id);
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
