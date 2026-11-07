<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Building extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }
}
