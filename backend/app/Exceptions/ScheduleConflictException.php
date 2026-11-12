<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;

/**
 * A hard conflict: nothing is saved. The reply says who or what conflicts and when,
 * and offers free rooms, time slots and teachers.
 */
class ScheduleConflictException extends Exception
{
    /**
     * @param  array<int, array<string, mixed>>  $conflicts
     * @param  array{rooms: array<int, array<string, mixed>>, slots: array<int, array<string, mixed>>, teachers: array<int, array<string, mixed>>}  $suggestions
     */
    public function __construct(private array $conflicts, private array $suggestions)
    {
        parent::__construct('This schedule conflicts with another entry.');
    }

    /**
     * A conflict is a normal answer to the user, not a system error, so it stays out of the log.
     */
    public function report(): void {}

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => 'schedule_conflict',
            'conflicts' => $this->conflicts,
            'suggestions' => $this->suggestions,
        ], 422);
    }
}
