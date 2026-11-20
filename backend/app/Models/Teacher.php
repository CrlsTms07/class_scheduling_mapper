<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Teacher extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    /**
     * The name printed on schedules: first name + middle initial + last name, made by the code and
     * never typed (beneficiary review, Nov 21, 2026: no separate "name on printed forms").
     */
    public function printedName(): string
    {
        $middleInitial = $this->middle_name ? mb_substr($this->middle_name, 0, 1).'. ' : '';

        return "{$this->first_name} {$middleInitial}{$this->last_name}";
    }
}
