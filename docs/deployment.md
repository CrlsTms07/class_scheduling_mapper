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
- **Email:** `MAIL_MAILER=log` sends no real email, so forgot password does not reach users until an
  SMTP service is added.
- **Updates:** Render deploys again on each push to the chosen branch.
