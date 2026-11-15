<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SchoolYear extends Model
{
    public $timestamps = false;

    protected $fillable = ['name', 'term_count', 'term_label', 'start_date', 'end_date'];

    public function terms(): HasMany
    {
        return $this->hasMany(SchoolTerm::class)->orderBy('term_no');
    }
}
