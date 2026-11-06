<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Room extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    public function building(): BelongsTo
    {
        return $this->belongsTo(Building::class);
    }

    public function label(): string
    {
        return "{$this->building->name} – {$this->room_number}";
    }
}
