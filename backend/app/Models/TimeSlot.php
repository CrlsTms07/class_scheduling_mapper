<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimeSlot extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['is_break' => 'boolean'];

    public function dayPattern(): BelongsTo
    {
        return $this->belongsTo(DayPattern::class);
    }
}
