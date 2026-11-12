<?php

namespace App\Http\Controllers;

use App\Models\SchoolTerm;
use App\Services\SchedulerDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SchedulerDashboardController extends Controller
{
    public function show(Request $request, SchoolTerm $term, SchedulerDashboardService $dashboard): JsonResponse
    {
        Gate::authorize('view-scheduler-dashboard');

        return response()->json(['data' => $dashboard->overview($term, $request->user())]);
    }
}
