<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One click of Auto-fill. Its entries point here, so it can be undone. */
class AutoFillRun extends Model
{
    public $timestamps = false;

    protected $guarded = [];
}
