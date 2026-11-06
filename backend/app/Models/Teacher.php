<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Teacher extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    /**
     * The name printed on schedules: display_name, or first name + middle initial + last name.
     */
    public function printedName(): string
    {
        if ($this->display_name) {
            return $this->display_name;
        }

        $middleInitial = $this->middle_name ? mb_substr($this->middle_name, 0, 1).'. ' : '';

        return "{$this->first_name} {$middleInitial}{$this->last_name}";
    }
}
