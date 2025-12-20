#!/bin/sh
set -e

echo "Poznote Migration Script - Checking for legacy permissions..."

DATA_DIR="/var/www/html/data"
DB_PATH="$DATA_DIR/database/poznote.db"

# Get current UID for www-data
WWW_DATA_UID=$(id -u www-data)

# Ensure data directory exists with correct permissions
echo "Creating data directories..."
mkdir -p "$DATA_DIR"
mkdir -p "$DATA_DIR/database"
mkdir -p "$DATA_DIR/attachments"
mkdir -p "$DATA_DIR/entries"

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

# Ensure directories are writable
chmod -R 775 "$DATA_DIR"
chmod 775 "$DATA_DIR/database"
chmod 775 "$DATA_DIR/attachments"
chmod 775 "$DATA_DIR/entries"

# Create database file if it doesn't exist and ensure it's writable
if [ ! -f "$DB_PATH" ]; then
    echo "Creating database file: $DB_PATH"
    touch "$DB_PATH"
    chown www-data:www-data "$DB_PATH"
    chmod 664 "$DB_PATH"
else
    echo "Database file already exists: $DB_PATH"
    # Ensure existing database is writable
    chown www-data:www-data "$DB_PATH"
    chmod 664 "$DB_PATH"
fi

# Verify database directory is writable
if [ -w "$DATA_DIR/database" ]; then
    echo "✓ Database directory is writable"
else
    echo "ERROR: Database directory is NOT writable!"
    ls -la "$DATA_DIR/database"
    exit 1
fi

# Verify database file is writable (or can be created)
DB_DIR=$(dirname "$DB_PATH")
if [ -w "$DB_DIR" ]; then
    echo "✓ Database file directory is writable"
else
    echo "ERROR: Database file directory is NOT writable: $DB_DIR"
    ls -la "$DB_DIR"
    exit 1
fi

echo "Final permissions check:"
ls -la "$DATA_DIR"
ls -la "$DATA_DIR/database" 2>/dev/null || echo "Warning: database directory listing failed"

# Verify web root exists and is readable
if [ ! -d "/var/www/html" ]; then
    echo "ERROR: Web root /var/www/html does not exist!"
    exit 1
fi

if [ ! -f "/var/www/html/index.php" ]; then
    echo "WARNING: index.php not found in /var/www/html"
    echo "Contents of /var/www/html:"
    ls -la /var/www/html/ | head -20
fi

# Configure nginx port for Railway (PORT) or local (HTTP_WEB_PORT)
# Railway requires listening on 0.0.0.0:$PORT (see https://docs.railway.com/guides/public-networking)
NGINX_PORT=${PORT:-${HTTP_WEB_PORT:-80}}
if [ "$NGINX_PORT" != "80" ]; then
    echo "Configuring nginx to listen on 0.0.0.0:$NGINX_PORT (Railway/Cloud mode)"
    # Replace port in nginx config - ensure it listens on 0.0.0.0 (all interfaces)
    sed -i "s/listen 80;/listen 0.0.0.0:$NGINX_PORT;/" /etc/nginx/http.d/default.conf
    # Verify the change
    if grep -q "listen 0.0.0.0:$NGINX_PORT;" /etc/nginx/http.d/default.conf; then
        echo "✓ Nginx configured to listen on 0.0.0.0:$NGINX_PORT"
    else
        echo "ERROR: Failed to configure nginx port!"
        cat /etc/nginx/http.d/default.conf | grep listen
        exit 1
    fi
else
    echo "Using default port 80 on 0.0.0.0 (local mode)"
    # Ensure nginx listens on all interfaces even for default port
    sed -i "s/listen 80;/listen 0.0.0.0:80;/" /etc/nginx/http.d/default.conf
fi

# Test nginx configuration
echo "Testing nginx configuration..."
if nginx -t 2>&1; then
    echo "✓ Nginx configuration is valid"
else
    echo "ERROR: Nginx configuration is invalid!"
    exit 1
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