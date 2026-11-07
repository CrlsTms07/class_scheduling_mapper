<?php

namespace App\Http\Controllers;

use App\Models\SchoolTerm;
use App\Services\AdminDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class AdminDashboardController extends Controller
{
    public function show(SchoolTerm $term, AdminDashboardService $dashboard): JsonResponse
    {
        Gate::authorize('view-admin-dashboard');

        return response()->json(['data' => $dashboard->overview($term)]);
    }
}
