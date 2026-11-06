<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActiveTermResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'term_no' => $this->term_no,
            'name' => $this->name,
            'start_date' => $this->start_date,
            'end_date' => $this->end_date,
            'school_year' => [
                'id' => $this->schoolYear->id,
                'name' => $this->schoolYear->name,
                'term_count' => $this->schoolYear->term_count,
                'term_label' => $this->schoolYear->term_label,
            ],
        ];
    }
}
