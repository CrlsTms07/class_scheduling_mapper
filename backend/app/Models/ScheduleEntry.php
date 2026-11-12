<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduleEntry extends Model
{
    protected $guarded = [];

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    public function sectionSubject(): BelongsTo
    {
        return $this->belongsTo(SectionSubject::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class);
    }

    /** The subject, or the activity, this period holds. Null for an open slot. */
    public function subjectName(): ?string
    {
        return $this->sectionSubject?->subject->name ?? $this->activity?->name;
    }
}
