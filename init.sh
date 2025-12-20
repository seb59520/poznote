#!/bin/sh
set -e

echo "Poznote Migration Script - Checking for legacy permissions..."

DATA_DIR="/var/www/html/data"
DB_PATH="$DATA_DIR/database/poznote.db"

# Get current UID for www-data
WWW_DATA_UID=$(id -u www-data)

# Ensure data directory exists with correct permissions
mkdir -p "$DATA_DIR"

# Check if we're using old Debian permissions (UID 33) and migrate to Alpine (UID 82)
if [ -d "$DATA_DIR" ] && [ "$(stat -c '%u' "$DATA_DIR" 2>/dev/null || stat -f '%u' "$DATA_DIR")" = "33" ] && [ "$WWW_DATA_UID" = "82" ]; then
    echo "Migrating from Debian (UID 33) to Alpine (UID 82) permissions..."
    chown -R 82:82 "$DATA_DIR"
    echo "Permission migration complete"
elif [ "$(stat -c '%u' "$DATA_DIR" 2>/dev/null || stat -f '%u' "$DATA_DIR")" = "82" ]; then
    echo "Alpine permissions already correct (UID 82)"
else
    echo "Setting correct permissions..."
    chown -R www-data:www-data "$DATA_DIR"
fi

chmod -R 775 "$DATA_DIR"

echo "Final permissions check:"
ls -la "$DATA_DIR"

# Ensure final permissions are correct for database files
if [ -f "$DB_PATH" ]; then
    chown www-data:www-data "$DB_PATH"
    chmod 664 "$DB_PATH"
fi

# Configure nginx port for Railway (PORT) or local (HTTP_WEB_PORT)
# Railway requires listening on 0.0.0.0:$PORT (see https://docs.railway.com/guides/public-networking)
NGINX_PORT=${PORT:-${HTTP_WEB_PORT:-80}}
if [ "$NGINX_PORT" != "80" ]; then
    echo "Configuring nginx to listen on 0.0.0.0:$NGINX_PORT (Railway/Cloud mode)"
    # Replace port in nginx config - ensure it listens on 0.0.0.0 (all interfaces)
    sed -i "s/listen 80;/listen 0.0.0.0:$NGINX_PORT;/" /etc/nginx/http.d/default.conf
else
    echo "Using default port 80 on 0.0.0.0 (local mode)"
    # Ensure nginx listens on all interfaces even for default port
    sed -i "s/listen 80;/listen 0.0.0.0:80;/" /etc/nginx/http.d/default.conf
fi

echo "Starting Poznote services..."
echo ""
echo "======================================"
echo "  Poznote is ready!"
echo "======================================"
echo ""
if [ -n "$PORT" ]; then
    echo "  Railway deployment detected"
    echo "  Port: $PORT"
elif [ -n "$HTTP_WEB_PORT" ]; then
    echo "  Access your instance at:"
    echo "  → http://localhost:${HTTP_WEB_PORT}"
fi
echo ""
echo "======================================"
echo ""