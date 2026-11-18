# ERCIHS Class Scheduling System

Capstone project of BSIT students, Cavite State University – Trece Martires City Campus.
A web system for making conflict-free class schedules for Emmanuel Resurreccion Congressional
Integrated High School (ERCIHS).

| Folder | What is inside |
|--------|----------------|
| `backend/` | Laravel REST API, PostgreSQL migrations, reports and tests (Pest) |
| `frontend/` | The web app the users open (built with Vite and Tailwind CSS) |
| `docker/`, `Dockerfile`, `render.yaml` | How the live system is built and deployed on Render |
| `docs/` | Database design (`schema.sql`, ERD), client notes and the deployment guide |

## Run it on your computer

```bash
# backend (http://localhost:8000)
cd backend
composer install
php artisan migrate --seed
php artisan serve

# frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Tests: `./vendor/bin/pest` in `backend`, and `npm run test` in `frontend`.
Deployment steps are in `docs/deployment.md`. Rules for the team are in `CLAUDE.md`.
