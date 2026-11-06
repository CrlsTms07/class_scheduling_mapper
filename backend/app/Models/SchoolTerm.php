<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SchoolTerm extends Model
{
    public $timestamps = false;

    protected $fillable = ['school_year_id', 'term_no', 'name', 'start_date', 'end_date', 'is_active'];

    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }
}
