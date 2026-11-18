# System Report: Stack, Security and Privacy

ERCIHS Class Scheduling System. Checked against the code and configuration on **Nov 18, 2026**.
Every item below names the file it comes from, so the team can show it during the defense.

---

## 1. What the system is built with

### Languages
| Language | Where |
|---|---|
| PHP 8.4 (needs ^8.3) | Back-end (`backend/`), `php:8.4-apache` in the `Dockerfile` |
| JavaScript (ES modules, plain; JSDoc types checked with `// @ts-check`) | Web app (`frontend/`) |
| HTML5 | Web app pages (`frontend/index.html`, built with DOM code in `src/lib/dom.js`) |
| CSS (Tailwind CSS v4 utility classes) | `frontend/src/styles.css` |
| SQL (PostgreSQL) | `docs/schema.sql`, migrations in `backend/database/migrations` |

### Back-end packages (`backend/composer.lock`)
| Package | Version | Used for |
|---|---|---|
| laravel/framework | 13.40.0 | REST API, validation, mail, queues, scheduler |
| laravel/sanctum | 4.3.3 | Sign-in with session cookies for the web app (SPA) |
| laravel/socialite | 5.32.0 | "Continue with Google" |
| spatie/laravel-permission | 8.4.0 | Roles: `super_admin`, `glc`, `master_teacher`, `teacher` |
| maatwebsite/excel | 4.0.6 (PhpSpreadsheet 5.10.0) | CSV exports, XLSX import and template |
| barryvdh/laravel-dompdf | 3.1.2 | PDF reports (Class Program, Teacher Program, Room Schedule, …) |
| pestphp/pest | 5.3.5 (PHPUnit 13.4.5) | Back-end tests |

### Web app packages (`frontend/package-lock.json`)
| Package | Version | Used for |
|---|---|---|
| vite | 8.3.8 | Development server and build |
| tailwindcss, @tailwindcss/vite | 4.3.5 | Styles, light and dark mode |
| lucide | 1.74.0 | Icons (always shown with a text label) |
| qrcode | 1.5.4 | QR code of a section's public schedule link |
| @fontsource-variable/inter | 5.3.x | Inter font, served with the app (no outside font service) |
| vitest | 5.1.0 (with jsdom 31.0.1) | Unit tests |
| @playwright/test | 1.65.1 | End-to-end tests in a real Chrome browser |

The earlier React app (React + TypeScript) was removed on Nov 18, 2026; it remains in the Git history.

### Database features (PostgreSQL 18; `docs/schema.sql`)
- **`btree_gist` extension**, needed so one constraint can compare both equal values (same teacher,
  same day) and overlapping time ranges.
- **Exclusion constraints** on `schedule_entries`: `no_teacher_conflict`, `no_room_conflict`,
  `no_section_conflict`. Same term, same day, overlapping `[start, end)` time is refused by the
  database itself; rejected entries are not counted. A fourth one on `time_slots` stops two periods
  of one bell schedule from overlapping.
- **Views:** `teacher_load`, `subject_minutes_check`, `room_usage`, `section_term_status`.
- **Audit log table:** `audit_logs`.

### Hosting, email and tools
| Item | What is used | Source |
|---|---|---|
| Hosting | Render, one Docker service (Apache + PHP serves the API and the built web app), free plan, Singapore | `Dockerfile`, `render.yaml`, `docs/deployment.md` |
| Database host | Supabase PostgreSQL; Neon kept as a fallback | `docs/deployment.md` |
| Email | The school's Gmail account: SMTP on a computer, or the Gmail API over HTTPS on Render's free plan (it blocks SMTP ports). Sends the sign-in code and the forgot-password link. | `backend/config/mail.php`, `docs/deployment.md` |
| CI | GitHub Actions: Pest against PostgreSQL 18; tests and build of `frontend` and `frontend` on Node 24 | `.github/workflows/ci.yml` |
| Version control | Git and GitHub; the live system deploys from `main` by Manual Deploy | `docs/deployment.md` |

### Tests (latest run, Nov 18, 2026)
| Suite | Result |
|---|---|
| Pest (back-end) | 770 passed, 2,986 assertions |
| Vitest (`frontend`) | 89 passed |
| Playwright (`frontend`, real Chrome, throwaway database) | 41 passed, including size checks at 360×640, 844×390 and 1366×768 |

---

## 2. Security

### Passwords
- Stored with **bcrypt, cost 12** (`BCRYPT_ROUNDS=12` in `.env.example`; the `password` attribute is cast
  to `hashed` in `app/Models/User.php`). Passwords are never stored or logged in plain text, and the
  `password` field is hidden from every API answer.
- Rules (`app/Providers/AppServiceProvider.php`, `Password::defaults`): 8 to 64 characters, upper and
  lower case, a number and a symbol. The web app checks the same rules (`frontend/src/lib/forms.js`).
- The Admin can reset a password; the user must then choose a new one at the next sign-in
  (`must_change_password`).

### Where SHA-256 is used (and where it is not)
- **Only for the "Remember this device" token** (`app/Services/LoginCodeService.php`). The browser gets a
  random 64-character token in a cookie; the database keeps only its SHA-256 hash, so a copy of the
  database cannot be used to pose as a remembered device. A fast hash is fine here because the token is
  long and random (it cannot be guessed like a password).
- **Not** used for passwords or sign-in codes. Those use bcrypt.

### Sessions, cookies and CSRF
- **Laravel Sanctum, SPA mode:** the web app signs in with a session cookie, not a token kept in the
  browser's storage. Session data is kept in the database (`SESSION_DRIVER=database`), 120 minutes
  of inactivity (`SESSION_LIFETIME=120`).
- Cookies are **HttpOnly** (scripts cannot read them), **SameSite=Lax**, and **Secure** on the live
  server (HTTPS). Laravel encrypts its cookies with **AES-256-CBC** using `APP_KEY` (`config/app.php`).
- **CSRF:** every change (POST, PUT, PATCH, DELETE) needs the `XSRF-TOKEN` cookie sent back as the
  `X-XSRF-TOKEN` header (`frontend/src/api/client.js`); Sanctum refuses requests without it.
- The session ID is renewed after every sign-in (`session()->regenerate()`), which blocks session
  fixation.
- CORS allows only the web app's own address, with credentials (`config/cors.php`).

### 6-digit sign-in code (`app/Services/LoginCodeService.php`)
- After the right password, a code is made with `random_int(0, 999999)` (a cryptographically secure
  random number) and emailed to the account's DepEd address.
- Stored as a **bcrypt hash**, never the code itself. A new code deletes the old one.
- Valid for **10 minutes**, using the database's own clock.
- **5 wrong tries** end the code. Requests are also limited to 10 a minute per browser session
  (`login-code` limiter), and "Send a new code" to once a minute.
- On only when real email can be sent (`SCHOOL_LOGIN_CODE=auto`), so no one is locked out while email
  is not set up.

### "Remember this device for 30 days"
- A random 64-character token in an HttpOnly, SameSite=Lax (Secure on HTTPS) cookie named
  `trusted_device`, valid 30 days. Only its SHA-256 hash is stored, with an expiry date
  (`trusted_devices` table). It skips the code step only, never the password.

### Google sign-in (Laravel Socialite; `app/Http/Controllers/GoogleAuthController.php`, `app/Services/AccountService.php`)
- Google is asked to show only `deped.gov.ph` accounts (`hd=deped.gov.ph`), **and** the server checks
  again that the email ends with `@deped.gov.ph` and that Google marks it verified.
- A new Google account starts as **pending** with a random 40-character password the user never sees,
  unless its name matches a teacher record and auto-activation is on (`SCHOOL_AUTO_ACTIVATE_TEACHERS`).

### Password reset
- Laravel's password broker: the token in the email is stored **hashed (bcrypt)** in
  `password_reset_tokens`, expires after **60 minutes**, and one email can ask again only after
  60 seconds (`config/auth.php`). Reset links always use HTTPS on the live server.

### Rate limits (`app/Providers/AppServiceProvider.php`)
| Limiter | Limit |
|---|---|
| Sign-in | 5 a minute per email and device; 20 every 15 minutes per account from anywhere |
| Sign-in code | 10 a minute per browser session |
| Sign-up, forgot and reset password, Google | 30 a minute per address; 5 a minute per email |
| Change password | 10 a minute per account |
| Public (guest) pages | 300 a minute per address (a whole class on the school Wi-Fi still gets through) |

### Roles, permissions and scope
- Roles from **spatie/laravel-permission**. New accounts are **pending** until the Admin activates
  them; `EnsureAccountIsActive` middleware blocks pending and deactivated accounts on every request.
- **Policies** (`app/Policies`: DayPattern, SchoolYear, Section, Subject, User) plus gates in
  `AppServiceProvider` decide who may do what.
- **Grade-level scope:** a GLC or Master Teacher only sees and changes the grade levels given to them
  (`user_grade_levels`; `User::gradeLevelIdsInScope()`), and the department's own buildings, rooms and
  activities (`App\Support\DepartmentScope`). Approving, rejecting and reopening are Admin only.
- The web app hides menu items a role cannot use, but **the API is the real guard**: the same checks
  run on every request.

### Input validation, SQL injection and XSS
- Every write goes through a **Form Request** (`app/Http/Requests`) with rules; emails must end with
  `@deped.gov.ph`.
- Database access uses Eloquent and the query builder with **bound parameters**. The few raw SQL parts
  (`whereRaw('LOWER(email) = ?', [$email])`) also pass values as bound parameters.
- The web app builds pages with `textContent` and DOM elements (`frontend/src/lib/dom.js`), so text
  from the database is never run as HTML. The two `innerHTML` uses put back a button's own label and
  insert the SVG made by the `qrcode` library from the app's own link.
- PDFs are made from Blade templates, which escape text by default.
- Uploads: imports accept only `.xlsx` and `.pdf`, with a size limit; logos and photos accept images only.

### HTTPS and browser headers (`app/Http/Middleware/SecurityHeaders.php`)
- Render serves the site over HTTPS. On the live server, links are forced to HTTPS and **HSTS** is sent
  (one year).
- Every answer has `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that turns off the
  camera, microphone and location.

### Secrets
- Secrets are only in `.env` locally and in Render's environment settings; `.env` is ignored by Git and
  `.env.example` has no real values. This includes `APP_KEY`, the database URL, Gmail and Google keys.

### Audit log and backups
- `audit_logs` records important actions with who and when, for example: sign-in with a code, Google
  sign-up, approvals, rejections and reopens, Start New School Year, and account changes
  (`app/Services/AuditLogger.php`).
- `php artisan app:backup` saves a compressed `pg_dump` copy of the database (also the live one with
  `--url=`) in `storage/app/private/backups`, outside Git. Run it before the evaluation and before every
  deploy that has a migration.

---

## 3. Data Privacy Notice and Terms and Conditions

- **Where the text is:** `frontend/src/lib/legal.js` (`TERMS` and the privacy notice). Each is
  accepted with **its own checkbox** at sign-up and once at the first sign-in of older accounts; the
  time is saved (`users.terms_accepted_at`, `users.privacy_accepted_at`).
- **Law cited in the text:** Republic Act No. 10173, the Data Privacy Act of 2012. The notice also tells
  users they may file a complaint with the National Privacy Commission (privacy.gov.ph). No other law,
  circular or NPC issuance is cited in the repository.
- **Who wrote it:** the project team, approved as a team decision on Nov 16, 2026
  (`docs/client-notes.md`). It was **not** written or checked by a lawyer, the school, or the school's
  Data Protection Officer.
- **Needs review before the evaluation: yes.** The school (principal, or the division's Data Protection
  Officer if there is one) should read and approve both texts, especially who the personal
  information controller is, how long data is kept, and who to contact.

### What personal information is kept, and protections for minors
- Personnel: name, DepEd email, qualifications, designation, schedule.
- **No student personal data is kept.** Sections have names and class sizes only. The public guest
  view has no student search, and it names only the adviser and co-adviser.

---

## 4. Points to raise with the adviser
1. The ISO/IEC 25010 "Security" characteristic can cite sections 2.1 to 2.9 above as evidence.
2. The legal texts need the school's approval (section 3).
3. Possible improvements after the evaluation: a defense against spreadsheet formula injection in CSV
   exports (a cell that starts with `=` is shown as text), and reading the contents of PDF imports.
