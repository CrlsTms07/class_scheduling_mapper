# Deployment

The live system runs on **Render** (one free Docker service: Laravel serving the API and the built
React app) with a **Neon** PostgreSQL database in Singapore.

React and Laravel share one address on purpose. Sanctum's session and CSRF cookies do not work
across two unrelated domains.

## Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Builds React, installs PHP packages, and sets up Apache |
| `docker/start.sh` | Runs at each start: caches config, migrates, adds reference data, starts Apache |
| `render.yaml` | Render Blueprint: free plan, Singapore, and the environment variables |
| `neon.ts` | Neon project settings |

## First deploy

1. Make the secret key, on your computer:

   ```bash
   cd backend
   php artisan key:generate --show
   ```

2. Get the Neon connection string with **Connection pooling off**.
3. In Render, choose **New**, then **Blueprint**, then this repository and the branch to deploy.
4. When asked, enter the key as `APP_KEY` and the connection string as `DB_URL`. Never commit them.
5. Choose **Deploy Blueprint**. The first build takes several minutes.

## First Admin

Render's free plan may not offer a shell, so run this on your computer against the Neon database.
This is the only time your computer points at the live database, so close the terminal afterwards.

```powershell
cd backend
$env:DB_URL = "<Neon connection string>"
$env:DB_CONNECTION = "pgsql"
php artisan config:clear
php artisan app:create-admin
Remove-Item Env:DB_URL, Env:DB_CONNECTION
```

## Good to know

- **Never** run `migrate:fresh`, `db:seed` without a class, or Pest against the live database. They
  erase data or add demo accounts with a known password.
- **Sleep:** the free service sleeps after 15 minutes without visitors, and the next visit takes about
  a minute. Open the system before a demonstration.
- **Disk:** the free service erases its disk on restart. Anything lasting belongs in the database.
- **Email:** `MAIL_MAILER=log` sends no real email. Set up Gmail as described in "Email" below.
- **Updates:** Render deploys again on each push to the chosen branch.
- **Temporary passwords:** if a reset email does not arrive, the Admin opens the user on the Users page
  and presses "Reset password". The person signs in with the temporary password and must choose a new one.

## Email (Gmail, free)

The system sends one kind of email: the forgot-password link. It uses the school's Gmail account
(free, up to 500 emails a day). There are two ways to send it.

### A. Gmail SMTP: local computer or a paid Render plan

Render's **free** plan blocks the SMTP ports (25, 465 and 587), so use this only on your computer or
on a paid plan.

1. Turn on 2-Step Verification for the Gmail account.
2. Open <https://myaccount.google.com/apppasswords>, create an app password named "ERCIHS" and copy
   the 16 characters.
3. Set in `.env` (or the Render environment):

```
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SCHEME=null
MAIL_USERNAME=the.school.account@gmail.com
MAIL_PASSWORD=the16characterapppassword
MAIL_FROM_ADDRESS=the.school.account@gmail.com
MAIL_FROM_NAME="ERCIHS Scheduling System"
```

### B. Gmail API over HTTPS: Render's free plan

The same Gmail account, sent through Google's web API, which Render does not block. Done once:

1. Open <https://console.cloud.google.com>, signed in as the school's Gmail account, and create a
   project named "ERCIHS Scheduling".
2. **APIs & Services → Library:** search "Gmail API" and press **Enable**.
3. **APIs & Services → OAuth consent screen:** choose **External**, enter the app name and the Gmail
   address, and add the scope `https://www.googleapis.com/auth/gmail.send`. Then press
   **Publish app** so its status is **In production**. (In "Testing" the token stops working after
   7 days.)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID:** type **Web application**,
   with the authorized redirect URI `https://developers.google.com/oauthplayground`. Copy the client
   ID and client secret.
5. Open <https://developers.google.com/oauthplayground>. Click the gear icon, check
   **Use your own OAuth credentials** and paste the client ID and secret. In Step 1 type
   `https://www.googleapis.com/auth/gmail.send`, press **Authorize APIs** and sign in with the school's
   Gmail. In Step 2 press **Exchange authorization code for tokens** and copy the **refresh token**.
6. In Render → the service → **Environment**, set:

```
MAIL_MAILER=gmail-api
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
MAIL_FROM_ADDRESS=the.school.account@gmail.com
MAIL_FROM_NAME="ERCIHS Scheduling System"
```

Check it with `php artisan app:test-mail you@example.com` (from the Render shell, or on your computer
with the same variables). Keep these values out of Git: they are as secret as the Gmail password.

## Backup and restore

Back up before each big change (a new school year, an import) and once a week during use.

```bash
cd backend
php artisan app:backup                      # the database in .env
php artisan app:backup --url="postgresql://user:password@host/db?sslmode=require"   # the Neon database
```

The file goes to `backend/storage/app/private/backups/` (ignored by Git). Copy it somewhere safe, like
the school's Google Drive. To restore it into an empty database:

```bash
pg_restore --no-owner --clean --if-exists -d "postgresql://user:password@host/db?sslmode=require" the-file.dump
```

Neon also keeps a short history of its own (point-in-time restore), on its dashboard under **Branches**.
