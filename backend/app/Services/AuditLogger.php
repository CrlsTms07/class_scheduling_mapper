<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class AuditLogger
{
    /**
     * @param  array<string, mixed>|null  $oldData
     * @param  array<string, mixed>|null  $newData
     */
    public function log(?User $actor, string $action, string $table, ?int $recordId, ?array $oldData = null, ?array $newData = null): void
    {
        DB::table('audit_logs')->insert([
            'user_id' => $actor?->id,
            'action' => $action,
            'table_name' => $table,
            'record_id' => $recordId,
            'old_data' => $oldData === null ? null : json_encode($oldData),
            'new_data' => $newData === null ? null : json_encode($newData),
        ]);
    }
}
