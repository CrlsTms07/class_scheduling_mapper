<?php

use App\Http\Controllers\ActiveTermController;
use App\Http\Controllers\ActivityController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\ApprovalController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AutoFillController;
use App\Http\Controllers\BuildingController;
use App\Http\Controllers\ClassProgramController;
use App\Http\Controllers\GuestController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\ManagedSectionController;
use App\Http\Controllers\MyRecordsController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\PlotterController;
use App\Http\Controllers\PublicSchoolController;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ReportSettingsController;
use App\Http\Controllers\ScheduleImportController;
use App\Http\Controllers\ScheduleMapController;
use App\Http\Controllers\SchedulerDashboardController;
use App\Http\Controllers\SchoolYearController;
use App\Http\Controllers\SectionController;
use App\Http\Controllers\SectionPeriodController;
use App\Http\Controllers\SectionRoomController;
use App\Http\Controllers\SubjectController;
use App\Http\Controllers\TeacherController;
use App\Http\Controllers\TeacherLoadingController;
use App\Http\Controllers\TeacherScheduleController;
use App\Http\Controllers\TermController;
use App\Http\Controllers\TermCopyController;
use App\Http\Controllers\TimeSlotController;
use App\Http\Controllers\UserActivationController;
use App\Http\Controllers\UserController;
use App\Services\TeacherService;
use Illuminate\Support\Facades\Route;

// Public
Route::get('/active-term', [ActiveTermController::class, 'show']);
// Who is signed in, or null for a visitor. Open to all, so a visitor gets no error.
Route::get('/me', [AuthController::class, 'me']);
Route::get('/public/school', [PublicSchoolController::class, 'show']);
Route::get('/public/school/photo', [PublicSchoolController::class, 'photo']);

Route::middleware('throttle:login')->post('/login', [AuthController::class, 'login'])->name('login');

Route::middleware('throttle:guest')->prefix('/guest')->group(function () {
    Route::get('/sections', [GuestController::class, 'sections']);
    Route::get('/sections/{section}', [GuestController::class, 'show']);
    Route::get('/sections/{section}/class-program.pdf', [GuestController::class, 'pdf']);
});

Route::middleware('throttle:account')->group(function () {
    Route::post('/register', [RegistrationController::class, 'store']);
    Route::post('/forgot-password', [PasswordResetController::class, 'sendLink']);
    Route::post('/reset-password', [PasswordResetController::class, 'reset']);
});

// Signed-in users with an active account
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::put('/me/preferences', [AuthController::class, 'updatePreferences']);
    Route::post('/me/accept-terms', [AuthController::class, 'acceptTerms']);
    // Limited like sign-in, so a session left open cannot be used to guess the current password.
    Route::put('/me/password', [AuthController::class, 'changePassword'])->middleware('throttle:account');
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/notifications', [NotificationController::class, 'index']);

    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/access-options', [UserController::class, 'accessOptions']);
    Route::put('/users/{user}/activation', [UserActivationController::class, 'update']);
    Route::put('/users/{user}/status', [UserActivationController::class, 'changeStatus']);
    Route::delete('/users/{user}', [UserActivationController::class, 'destroy']);
    Route::post('/users/{user}/reset-password', [UserActivationController::class, 'resetPassword']);

    Route::get('/school-years', [SchoolYearController::class, 'index']);
    Route::post('/school-years', [SchoolYearController::class, 'store']);
    Route::put('/school-years/{schoolYear}', [SchoolYearController::class, 'update']);
    Route::delete('/school-years/{schoolYear}', [SchoolYearController::class, 'destroy']);
    Route::put('/terms/{term}/activate', [SchoolYearController::class, 'activateTerm']);

    Route::get('/school-years/{schoolYear}/day-patterns', [TimeSlotController::class, 'index']);
    Route::post('/school-years/{schoolYear}/day-patterns', [TimeSlotController::class, 'storePattern']);
    Route::put('/day-patterns/{dayPattern}', [TimeSlotController::class, 'updatePattern']);
    Route::delete('/day-patterns/{dayPattern}', [TimeSlotController::class, 'destroyPattern']);
    Route::post('/day-patterns/{dayPattern}/copy', [TimeSlotController::class, 'copyPattern']);
    Route::post('/day-patterns/{dayPattern}/slots', [TimeSlotController::class, 'storeSlot']);
    Route::post('/day-patterns/{dayPattern}/slots/preset', [TimeSlotController::class, 'presetSlots']);
    Route::put('/time-slots/{timeSlot}', [TimeSlotController::class, 'updateSlot']);
    Route::delete('/time-slots/{timeSlot}', [TimeSlotController::class, 'destroySlot']);

    Route::get('/school-years/{schoolYear}/sections', [ManagedSectionController::class, 'index']);
    Route::get('/school-years/{schoolYear}/section-options', [ManagedSectionController::class, 'options']);
    Route::post('/school-years/{schoolYear}/sections', [ManagedSectionController::class, 'store']);
    Route::put('/sections/{section}', [ManagedSectionController::class, 'update']);
    Route::delete('/sections/{section}', [ManagedSectionController::class, 'destroy']);
    Route::put('/sections/{section}/room', [SectionRoomController::class, 'update']);
    Route::post('/tracks', [ManagedSectionController::class, 'storeTrack']);
    Route::delete('/tracks/{track}', [ManagedSectionController::class, 'destroyTrack'])->whereNumber('track');

    Route::get('/report-settings', [ReportSettingsController::class, 'index']);
    Route::put('/school-profile', [ReportSettingsController::class, 'saveProfile']);
    Route::post('/school-profile/logos', [ReportSettingsController::class, 'addLogo']);
    Route::post('/school-profile/photo', [ReportSettingsController::class, 'savePhoto']);
    Route::delete('/school-profile/photo', [ReportSettingsController::class, 'removePhoto']);
    Route::delete('/school-profile/logos/{index}', [ReportSettingsController::class, 'removeLogo'])->whereNumber('index');
    Route::put('/school-profile/logos/{index}/placement', [ReportSettingsController::class, 'placeLogo'])->whereNumber('index');
    Route::put('/report-settings/documents', [ReportSettingsController::class, 'saveDocument']);
    Route::get('/terms/{term}/signatories', [ReportSettingsController::class, 'signatories']);
    Route::post('/terms/{term}/signatories', [ReportSettingsController::class, 'addSignatory']);
    Route::post('/terms/{term}/signatories/copy', [ReportSettingsController::class, 'copySignatories']);
    Route::put('/signatories/{signatory}', [ReportSettingsController::class, 'updateSignatory'])->whereNumber('signatory');
    Route::delete('/signatories/{signatory}', [ReportSettingsController::class, 'deleteSignatory'])->whereNumber('signatory');
    Route::post('/signatories/{signatory}/move', [ReportSettingsController::class, 'moveSignatory'])->whereNumber('signatory');

    Route::get('/terms/{term}/dashboard', [AdminDashboardController::class, 'show']);
    Route::get('/terms/{term}/my-dashboard', [SchedulerDashboardController::class, 'show']);

    Route::get('/buildings', [BuildingController::class, 'index']);
    Route::post('/buildings', [BuildingController::class, 'store']);
    Route::put('/buildings/{building}', [BuildingController::class, 'update']);
    Route::delete('/buildings/{building}', [BuildingController::class, 'destroy']);
    Route::post('/buildings/{building}/rooms', [BuildingController::class, 'storeRoom']);
    Route::put('/rooms/{room}', [BuildingController::class, 'updateRoom']);
    Route::delete('/rooms/{room}', [BuildingController::class, 'destroyRoom']);

    Route::get('/terms/{term}/schedule-map', [ScheduleMapController::class, 'index']);
    Route::get('/terms/{term}/rooms/{room}/schedule', [ScheduleMapController::class, 'room']);
    Route::post('/terms/{term}/loading/copy', [TeacherLoadingController::class, 'copy']);
    Route::post('/terms/{term}/import-previous', [ImportController::class, 'store']);
    Route::get('/terms/{term}/schedule-import/template.csv', [ScheduleImportController::class, 'template']);
    Route::get('/terms/{term}/schedule-import/template.xlsx', [ScheduleImportController::class, 'template']);
    Route::post('/terms/{term}/schedule-import', [ScheduleImportController::class, 'store']);
    Route::post('/terms/{term}/schedule-copy', [TermCopyController::class, 'store']);
    Route::post('/teachers/quick-add', [TeacherLoadingController::class, 'quickAddTeacher']);
    Route::get('/personnel-options', [TeacherController::class, 'options']);
    Route::post('/personnel-options/{type}', [TeacherController::class, 'storeOption'])
        ->whereIn('type', array_keys(TeacherService::OPTION_TABLES));
    Route::delete('/personnel-options/{type}/{id}', [TeacherController::class, 'destroyOption'])
        ->whereIn('type', array_keys(TeacherService::OPTION_TABLES))
        ->whereNumber('id');
    Route::get('/terms/{term}/teachers', [TeacherController::class, 'index']);
    Route::get('/terms/{term}/teachers/{teacher}/schedule', [TeacherScheduleController::class, 'show']);
    Route::post('/terms/{term}/teachers', [TeacherController::class, 'store']);
    Route::put('/terms/{term}/teachers/{teacher}', [TeacherController::class, 'update']);
    Route::delete('/teachers/{teacher}', [TeacherController::class, 'destroy']);

    Route::get('/school-years/{schoolYear}/subjects', [SubjectController::class, 'index']);
    Route::get('/school-years/{schoolYear}/subject-options', [SubjectController::class, 'options']);
    Route::post('/school-years/{schoolYear}/subjects', [SubjectController::class, 'store']);
    Route::put('/subjects/{subject}', [SubjectController::class, 'update']);
    Route::delete('/subjects/{subject}', [SubjectController::class, 'destroy']);
    Route::get('/school-years/{schoolYear}/activities', [ActivityController::class, 'index']);
    Route::post('/school-years/{schoolYear}/activities', [ActivityController::class, 'store']);
    Route::put('/activities/{activity}', [ActivityController::class, 'update']);
    Route::delete('/activities/{activity}', [ActivityController::class, 'destroy']);

    Route::prefix('/terms/{term}/reports')->group(function () {
        Route::get('/options', [ReportController::class, 'options']);
        Route::get('/teachers/{teacher}', [ReportController::class, 'teacherProgram']);
        Route::get('/teachers/{teacher}/program.pdf', [ReportController::class, 'teacherProgramPdf']);
        Route::get('/teachers/{teacher}/program.xlsx', [ReportController::class, 'teacherProgramXlsx']);
        Route::get('/teachers/{teacher}/program.csv', [ReportController::class, 'teacherProgramXlsx']);
        Route::get('/rooms/{room}', [ReportController::class, 'roomSchedule']);
        Route::get('/rooms/{room}/schedule.pdf', [ReportController::class, 'roomSchedulePdf']);
        Route::get('/rooms/{room}/schedule.xlsx', [ReportController::class, 'roomScheduleXlsx']);
        Route::get('/rooms/{room}/schedule.csv', [ReportController::class, 'roomScheduleXlsx']);
        Route::get('/room-usage', [ReportController::class, 'roomUsage']);
        Route::get('/room-usage.pdf', [ReportController::class, 'roomUsagePdf']);
        Route::get('/room-usage.xlsx', [ReportController::class, 'roomUsageXlsx']);
        Route::get('/room-usage.csv', [ReportController::class, 'roomUsageXlsx']);
        Route::get('/teacher-load', [ReportController::class, 'teacherLoad']);
        Route::get('/teacher-load.pdf', [ReportController::class, 'teacherLoadPdf']);
        Route::get('/teacher-load.xlsx', [ReportController::class, 'teacherLoadXlsx']);
        Route::get('/teacher-load.csv', [ReportController::class, 'teacherLoadXlsx']);
        Route::get('/adviser-summary', [ReportController::class, 'adviserSummary']);
        Route::get('/adviser-summary.pdf', [ReportController::class, 'adviserSummaryPdf']);
        Route::get('/adviser-summary.xlsx', [ReportController::class, 'adviserSummaryXlsx']);
        Route::get('/adviser-summary.csv', [ReportController::class, 'adviserSummaryXlsx']);
        Route::get('/grades/{grade}/timetable', [ReportController::class, 'gradeTimetable'])->whereNumber('grade');
        Route::get('/grades/{grade}/timetable.pdf', [ReportController::class, 'gradeTimetablePdf'])->whereNumber('grade');
        Route::get('/grades/{grade}/timetable.xlsx', [ReportController::class, 'gradeTimetableXlsx'])->whereNumber('grade');
        Route::get('/grades/{grade}/timetable.csv', [ReportController::class, 'gradeTimetableXlsx'])->whereNumber('grade');
        Route::get('/validation', [ReportController::class, 'validationReport']);
        Route::get('/validation.pdf', [ReportController::class, 'validationPdf']);
        Route::get('/validation.xlsx', [ReportController::class, 'validationXlsx']);
        Route::get('/validation.csv', [ReportController::class, 'validationXlsx']);
    });

    Route::get('/terms/{term}/my-schedule', [MyRecordsController::class, 'schedule']);
    Route::get('/terms/{term}/my-schedule/program.pdf', [MyRecordsController::class, 'schedulePdf']);
    Route::get('/terms/{term}/my-schedule/program.xlsx', [MyRecordsController::class, 'scheduleXlsx']);
    Route::get('/terms/{term}/my-schedule/program.csv', [MyRecordsController::class, 'scheduleXlsx']);
    Route::get('/terms/{term}/my-profile', [MyRecordsController::class, 'profile']);

    Route::get('/terms', [TermController::class, 'index']);
    Route::get('/terms/{term}/sections', [SectionController::class, 'index']);

    Route::get('/terms/{term}/approvals', [ApprovalController::class, 'index']);
    Route::post('/terms/{term}/approvals', [ApprovalController::class, 'store']);

    Route::prefix('/terms/{term}/sections/{section}')->group(function () {
        Route::get('/plotter', [PlotterController::class, 'show']);
        Route::post('/periods', [SectionPeriodController::class, 'store']);
        Route::put('/slots/{timeSlot}', [PlotterController::class, 'assign']);
        Route::delete('/slots/{timeSlot}', [PlotterController::class, 'clear']);
        Route::post('/slots/{timeSlot}/move', [PlotterController::class, 'move']);
        Route::post('/slots/{timeSlot}/activity', [ActivityController::class, 'place']);
        Route::post('/auto-fill/preview', [AutoFillController::class, 'preview']);
        Route::post('/auto-fill', [AutoFillController::class, 'store']);
        Route::delete('/auto-fill/{run}', [AutoFillController::class, 'destroy']);
        Route::delete('/schedule', [PlotterController::class, 'clearAll']);
        Route::post('/submit', [PlotterController::class, 'submit']);
        Route::post('/revise', [PlotterController::class, 'revise']);
        Route::get('/class-program.pdf', [ClassProgramController::class, 'show']);
        Route::get('/class-program.xlsx', [ReportController::class, 'classProgramXlsx']);
        Route::get('/class-program.csv', [ReportController::class, 'classProgramXlsx']);
        Route::get('/loading', [TeacherLoadingController::class, 'show']);
        Route::put('/loading/{subject}', [TeacherLoadingController::class, 'assign']);
        Route::delete('/loading/{subject}', [TeacherLoadingController::class, 'remove']);
    });
});
