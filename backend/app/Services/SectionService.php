<?php

namespace App\Services;

use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SectionService
{
    public function __construct(private AuditLogger $audit) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(SchoolYear $year, array $data, User $admin): Section
    {
        return DB::transaction(function () use ($year, $data, $admin) {
            $section = Section::create([...$data, 'name' => trim($data['name']), 'school_year_id' => $year->id]);

            $this->audit->log($admin, 'create', 'sections', $section->id, null, $data);

            return $section;
        });
    }

    /**
     * The name, adviser, room and class size can always change. The grade and shift cannot
     * once there is work on the section: its subjects belong to the grade, and its schedule
     * follows the bell schedule of the shift.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Section $section, array $data, User $admin): Section
    {
        return DB::transaction(function () use ($section, $data, $admin) {
            $reason = $this->whyLocked($section);

            if ($reason !== null) {
                if ((int) $data['grade_level_id'] !== (int) $section->grade_level_id) {
                    throw ValidationException::withMessages(['grade_level_id' => "The grade cannot change. {$reason}"]);
                }
                if ($data['shift'] !== $section->shift) {
                    throw ValidationException::withMessages(['shift' => "The shift cannot change. {$reason}"]);
                }
            }

            $before = $section->only(array_keys($data));
            $section->update([...$data, 'name' => trim($data['name'])]);

            $this->audit->log($admin, 'update', 'sections', $section->id, $before, $data);

            return $section;
        });
    }

    public function delete(Section $section, User $admin): void
    {
        DB::transaction(function () use ($section, $admin) {
            $reason = $this->whyLocked($section);
            if ($reason !== null) {
                throw ValidationException::withMessages(['section' => $reason]);
            }

            $before = $section->only(['name', 'school_year_id', 'grade_level_id']);
            $section->delete();

            $this->audit->log($admin, 'delete', 'sections', $section->id, $before);
        });
    }

    /**
     * What keeps this section's grade and shift fixed, in words for the Admin, or null.
     */
    public function whyLocked(Section $section): ?string
    {
        if (DB::table('schedule_entries')->where('section_id', $section->id)->exists()) {
            return 'This section already has schedules.';
        }

        if (DB::table('section_subjects')->where('section_id', $section->id)->exists()) {
            return 'This section already has teacher loading.';
        }

        return null;
    }
}
