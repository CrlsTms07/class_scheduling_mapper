<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Flag Ceremony, Catch-up Friday and the like: they take a period but have no teacher. */
class Activity extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }
}
