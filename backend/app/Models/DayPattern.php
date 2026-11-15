<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Days that share one bell schedule, such as "Monday – Thursday".
 */
class DayPattern extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    public function timeSlots(): HasMany
    {
        return $this->hasMany(TimeSlot::class)->orderBy('start_time');
    }

    /**
     * PostgreSQL returns the array as text, like "{1,2,3,4}". This turns it into [1, 2, 3, 4].
     */
    protected function dayNumbers(): Attribute
    {
        return Attribute::get(fn () => array_map('intval', explode(',', trim($this->days, '{}'))));
    }

    /**
     * The bell schedules that apply to a section: same school year, level and shift.
     */
    public static function forSection(Section $section)
    {
        return static::where('school_year_id', $section->school_year_id)
            ->where('level', $section->gradeLevel->level)
            ->where('shift', $section->shift);
    }
}
