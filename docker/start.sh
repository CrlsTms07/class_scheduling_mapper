#!/bin/sh
# Runs each time the live server starts.
set -e

if [ -z "$APP_KEY" ] || [ -z "$DB_URL" ]; then
    echo "APP_KEY and DB_URL must be set in the environment of the host." >&2
    exit 1
fi

# Error pages with code and settings must never reach the public.
if [ "${APP_ENV:-production}" = "production" ] && [ "$APP_DEBUG" = "true" ]; then
    echo "APP_DEBUG must be false on the live server." >&2
    exit 1
fi

# The host provides its own address, so nothing has to be typed in or kept up to date.
export APP_URL="${APP_URL:-$RENDER_EXTERNAL_URL}"
export FRONTEND_URL="${FRONTEND_URL:-$APP_URL}"
export SANCTUM_STATEFUL_DOMAINS="${SANCTUM_STATEFUL_DOMAINS:-$RENDER_EXTERNAL_HOSTNAME}"

# Listen on the port the host asks for.
PORT="${PORT:-10000}"
sed -ri "s/^Listen [0-9]+/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

mkdir -p storage/fonts storage/framework/cache storage/framework/sessions storage/framework/views storage/logs

php artisan config:cache
php artisan route:cache
php artisan view:cache

# Safe to repeat. Demo accounts are never added here: the live server has real data only.
php artisan migrate --force --no-interaction
php artisan db:seed --class='Database\Seeders\ReferenceDataSeeder' --force --no-interaction

chown -R www-data:www-data storage bootstrap/cache

exec apache2-foreground
