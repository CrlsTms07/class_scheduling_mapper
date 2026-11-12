<?php

namespace App\Http\Resources;

use App\Services\SchoolYearService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

class SchoolYearResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $service = app(SchoolYearService::class);
        $countIn = fn (string $table) => DB::table($table)->where('school_year_id', $this->id)->count();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'term_count' => $this->term_count,
            'term_label' => $this->term_label,
            'start_date' => $this->start_date,
            'end_date' => $this->end_date,
            'cannot_delete_reason' => $service->whyYearCannotBeDeleted($this->resource),
            // What the wizard can copy from this year.
            'counts' => [
                'subjects' => $countIn('subjects'),
                'day_patterns' => $countIn('day_patterns'),
                'sections' => $countIn('sections'),
                'signatories' => DB::table('report_signatories')
                    ->whereIn('term_id', $this->terms->pluck('id'))
                    ->count(),
            ],
            'terms' => $this->terms->map(fn ($term) => [
                'id' => $term->id,
                'term_no' => $term->term_no,
                'name' => $term->name,
                'start_date' => $term->start_date,
                'end_date' => $term->end_date,
                'is_active' => $term->is_active,
                'cannot_remove_reason' => $service->whyTermCannotBeRemoved($term),
            ]),
        ];
    }
}
