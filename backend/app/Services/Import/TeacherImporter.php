<?php

namespace App\Services\Import;

use App\Models\Teacher;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\TeacherService;
use Illuminate\Support\Str;

/**
 * Teachers by employee ID. A new row adds a personnel record and, when it has a DepEd email,
 * an active Teacher account with no known password (they sign in with Google or Forgot password,
 * and accept the Data Privacy Notice at the first sign-in). The department must already exist.
 */
class TeacherImporter extends MasterDataImporter
{
    public function __construct(AuditLogger $audit, private TeacherService $teachers)
    {
        parent::__construct($audit);
    }

    public function columns(): array
    {
        return [
            'employee_id' => true,
            'last_name' => true,
            'first_name' => true,
            'middle_name' => false,
            'email' => false,
            'department' => true,
            'personnel_type' => false,
        ];
    }

    public function example(): array
    {
        return [
            'employee_id' => '4512301',
            'last_name' => 'Dela Cruz',
            'first_name' => 'Juan',
            'middle_name' => 'Santos',
            'email' => 'juan.delacruz@deped.gov.ph',
            'department' => 'Mathematics',
            'personnel_type' => 'teaching',
        ];
    }

    public function notes(): array
    {
        return [
            'employee_id' => 'The DepEd employee number. Letters, numbers and dashes, up to 20. A teacher already listed with this ID is skipped or updated.',
            'last_name' => 'Up to 60 characters.',
            'first_name' => 'Up to 60 characters.',
            'middle_name' => 'Optional. The middle initial on printed forms comes from it.',
            'email' => 'Optional. An official @deped.gov.ph email gives the teacher an active account (sign in with Google or Forgot password).',
            'department' => 'Must be a department already in the system (Teachers page, Edit lists), e.g. Mathematics.',
            'personnel_type' => 'teaching (default) or non-teaching. Only teaching personnel get subjects or an advisory.',
        ];
    }

    public function table(): string
    {
        return 'teachers';
    }

    public function key(array $row): ?string
    {
        return $row['employee_id'] === '' ? null : strtolower($row['employee_id']);
    }

    public function describeKey(array $row): string
    {
        return "employee ID \"{$row['employee_id']}\"";
    }

    public function label(array $row): string
    {
        $name = trim("{$row['first_name']} {$row['last_name']}");

        return trim(($name === '' ? 'No name' : $name).($row['employee_id'] !== '' ? " ({$row['employee_id']})" : ''));
    }

    public function handle(array $row): array
    {
        $errors = [];
        $employeeId = $row['employee_id'];

        if (strlen($employeeId) > 20 || ! preg_match('/^[0-9A-Za-z-]+$/', $employeeId)) {
            $errors[] = "employee ID \"{$employeeId}\" can have only letters, numbers and dashes, up to 20.";
        }
        foreach (['last_name' => 'last name', 'first_name' => 'first name', 'middle_name' => 'middle name'] as $column => $words) {
            if (mb_strlen($row[$column]) > 60) {
                $errors[] = "the {$words} is longer than 60 characters.";
            }
        }

        $departmentId = $this->idByName('departments', $row['department']);
        if ($departmentId === null) {
            $errors[] = "department \"{$row['department']}\" does not exist. Add it on the Teachers page (Edit lists) or fix the spelling.";
        }

        $type = $this->personnelType($row['personnel_type']);
        if ($type === null) {
            $errors[] = "personnel type \"{$row['personnel_type']}\" is not teaching or non-teaching.";
        }

        $email = strtolower($row['email']);
        if ($email !== '' && (! filter_var($email, FILTER_VALIDATE_EMAIL) || ! str_ends_with($email, '@deped.gov.ph'))) {
            $errors[] = "email \"{$row['email']}\" is not an official DepEd email (@deped.gov.ph).";
        }

        if ($errors !== []) {
            return ['error', $errors];
        }

        $teacher = Teacher::whereRaw('LOWER(employee_id) = LOWER(?)', [$employeeId])->first();
        $adopted = false;

        if ($teacher === null) {
            // Someone encoded by hand before, with no employee ID yet: the same person, not a new one.
            $sameName = Teacher::whereNull('employee_id')
                ->whereRaw('LOWER(TRIM(first_name)) = LOWER(?)', [$row['first_name']])
                ->whereRaw('LOWER(TRIM(last_name)) = LOWER(?)', [$row['last_name']])
                ->get();

            if ($sameName->count() > 1) {
                return ['error', ["{$sameName->count()} teachers named {$row['first_name']} {$row['last_name']} have no employee ID. Give the right one this ID on the Teachers page first."]];
            }

            $teacher = $sameName->first();
            $adopted = $teacher !== null;
        }

        $account = $email === '' ? null : User::whereRaw('LOWER(email) = ?', [$email])->first();
        $accountOwner = $account ? Teacher::where('user_id', $account->id)->first() : null;
        if ($accountOwner && $accountOwner->id !== $teacher?->id) {
            return ['error', ["email {$email} is already the account of {$accountOwner->printedName()}."]];
        }

        $values = [
            'employee_id' => $employeeId,
            'first_name' => $row['first_name'],
            'middle_name' => $row['middle_name'] === '' ? null : $row['middle_name'],
            'last_name' => $row['last_name'],
            'department_id' => $departmentId,
            'personnel_type' => $type,
        ];

        if ($teacher === null) {
            return $this->create($values, $email, $account);
        }

        if ($this->skipOrUpdate() === 'skip') {
            return ['skip', [$adopted
                ? "{$teacher->printedName()} is already listed without an employee ID. Choose Update to give that record this ID."
                : "{$this->describeKey($row)} is already {$teacher->printedName()}. Skipped."]];
        }

        return $this->update($teacher, $values, $email, $account, $adopted);
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array{0: string, 1: array<int, string>}
     */
    private function create(array $values, string $email, ?User $account): array
    {
        $messages = [];
        $userId = null;

        if ($email !== '') {
            [$userId, $messages] = $this->linkAccount($values, $email, $account);
        }

        $teacher = Teacher::create([...$values, 'user_id' => $userId, 'max_subjects' => (int) config('school.max_subjects')]);
        $this->log('create', $teacher->id, null, $values);

        return ['new', $messages];
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array{0: string, 1: array<int, string>}
     */
    private function update(Teacher $teacher, array $values, string $email, ?User $account, bool $adopted): array
    {
        $messages = $adopted ? ["{$teacher->printedName()} was listed without an employee ID; this ID is added to that record."] : [];

        if ($teacher->personnel_type === 'teaching' && $values['personnel_type'] !== 'teaching' && $this->teachers->hasTeachingWork($teacher)) {
            return ['error', ["{$teacher->printedName()} has an advisory or teacher loading, so they must stay teaching personnel."]];
        }

        if ($email !== '') {
            if ($teacher->user_id === null) {
                [$userId, $linked] = $this->linkAccount($values, $email, $account);
                $values['user_id'] = $userId;
                $messages = [...$messages, ...$linked];
            } elseif (strtolower((string) User::whereKey($teacher->user_id)->value('email')) !== $email) {
                $messages[] = 'this teacher already has an account with another email; the account was not changed.';
            }
        }

        $before = $teacher->only(array_keys($values));
        $teacher->update($values);
        $this->log('update', $teacher->id, $before, $values);

        return ['update', $messages];
    }

    /**
     * The teacher's account: one that signed up with this email and is not linked yet, or a new,
     * active Teacher account.
     *
     * @param  array<string, mixed>  $values
     * @return array{0: int, 1: array<int, string>}
     */
    private function linkAccount(array $values, string $email, ?User $account): array
    {
        if ($account) {
            return [$account->id, ["linked to the account that signed up with {$email}."]];
        }

        $user = User::create([
            'email' => $email,
            // Never shown or sent: they sign in with Google or set a password with Forgot password.
            'password' => Str::random(48),
            'first_name' => $values['first_name'],
            'middle_name' => $values['middle_name'],
            'last_name' => $values['last_name'],
            'status' => 'active',
        ]);
        $user->assignRole('teacher');
        $this->audit->log($this->user, 'create', 'users', $user->id, null, ['source' => 'import', 'email' => $email, 'role' => 'teacher']);

        return [$user->id, ["an active Teacher account is made for {$email} (sign in with Google or Forgot password)."]];
    }

    private function personnelType(string $typed): ?string
    {
        return match (strtolower(preg_replace('/[^a-z]/i', '', $typed))) {
            '', 'teaching' => 'teaching',
            'nonteaching' => 'non_teaching',
            default => null,
        };
    }
}
