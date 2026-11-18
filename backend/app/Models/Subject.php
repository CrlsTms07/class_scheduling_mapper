<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subject extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }
}
