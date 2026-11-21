<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subject extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    /** Homeroom Guidance, the one subject with a minutes limit (CLAUDE.md: 60 minutes a week). */
    public function isHomeroom(): bool
    {
        return (bool) preg_match('/home\s*room/i', (string) $this->name);
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }
}
