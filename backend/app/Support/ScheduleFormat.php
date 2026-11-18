<?php

namespace App\Support;

class ScheduleFormat
{
    private const DAY_NAMES = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday'];

    public static function dayName(int $day): string
    {
        return self::DAY_NAMES[$day];
    }

    /**
     * "13:05:00" becomes "1:05 PM".
     */
    public static function time(string $time): string
    {
        return date('g:i A', strtotime($time));
    }

    /**
     * "13:05:00" becomes "13:05", the format the front-end works with.
     */
    public static function shortTime(string $time): string
    {
        return substr($time, 0, 5);
    }

    public static function minutesBetween(string $start, string $end): int
    {
        return (int) ((strtotime($end) - strtotime($start)) / 60);
    }

    /** 360 becomes "6 hours", 330 "5.5 hours", 60 "1 hour": the totals line of the Class Program. */
    public static function hoursText(int $minutes): string
    {
        $hours = round($minutes / 60, 2);
        $text = rtrim(rtrim(number_format($hours, 2, '.', ''), '0'), '.');

        return $text.((float) $text === 1.0 ? ' hour' : ' hours');
    }

    /**
     * 595 becomes "9 hours 55 minutes".
     */
    public static function duration(int $minutes): string
    {
        $hours = intdiv($minutes, 60);
        $rest = $minutes % 60;
        $parts = [];

        if ($hours > 0) {
            $parts[] = $hours.($hours === 1 ? ' hour' : ' hours');
        }

        if ($rest > 0 || $parts === []) {
            $parts[] = $rest.($rest === 1 ? ' minute' : ' minutes');
        }

        return implode(' ', $parts);
    }
}
