#!/bin/sh
set -e

echo "Poznote Migration Script - Checking for legacy permissions..."

DATA_DIR="/var/www/html/data"
DB_PATH="$DATA_DIR/database/poznote.db"

# Get current UID for www-data
WWW_DATA_UID=$(id -u www-data)

# Ensure data directory exists with correct permissions
echo "Creating data directories..."
echo "DATA_DIR: $DATA_DIR"
echo "Current user: $(whoami)"
echo "www-data UID: $WWW_DATA_UID"

# Create directories (will not fail if they exist)
mkdir -p "$DATA_DIR" 2>&1 || echo "Warning: mkdir $DATA_DIR failed"
mkdir -p "$DATA_DIR/database" 2>&1 || echo "Warning: mkdir database failed"
mkdir -p "$DATA_DIR/attachments" 2>&1 || echo "Warning: mkdir attachments failed"
mkdir -p "$DATA_DIR/entries" 2>&1 || echo "Warning: mkdir entries failed"

# Check current permissions
echo "Current permissions:"
ls -la "$DATA_DIR" 2>&1 || echo "Cannot list $DATA_DIR"

# Try to set ownership (may fail on Railway volumes, that's OK)
echo "Attempting to set ownership..."
if [ -d "$DATA_DIR" ] && [ "$(stat -c '%u' "$DATA_DIR" 2>/dev/null || stat -f '%u' "$DATA_DIR")" = "33" ] && [ "$WWW_DATA_UID" = "82" ]; then
    echo "Migrating from Debian (UID 33) to Alpine (UID 82) permissions..."
    chown -R 82:82 "$DATA_DIR" 2>&1 || echo "Warning: chown failed (may be normal on Railway)"
    echo "Permission migration complete"
elif [ "$(stat -c '%u' "$DATA_DIR" 2>/dev/null || stat -f '%u' "$DATA_DIR")" = "82" ]; then
    echo "Alpine permissions already correct (UID 82)"
else
    echo "Setting correct permissions..."
    chown -R www-data:www-data "$DATA_DIR" 2>&1 || echo "Warning: chown failed (may be normal on Railway volumes)"
fi

# Force permissions to be writable (this is critical for Railway volumes)
echo "Setting directory permissions to be writable..."
chmod -R 777 "$DATA_DIR" 2>&1 || echo "Warning: chmod failed"
chmod 777 "$DATA_DIR/database" 2>&1 || echo "Warning: chmod database failed"
chmod 777 "$DATA_DIR/attachments" 2>&1 || echo "Warning: chmod attachments failed"
chmod 777 "$DATA_DIR/entries" 2>&1 || echo "Warning: chmod entries failed"

# Verify permissions after setting
echo "Permissions after setting:"
ls -la "$DATA_DIR" 2>&1 || echo "Cannot list $DATA_DIR"
ls -la "$DATA_DIR/database" 2>&1 || echo "Cannot list database directory"

# Create database file if it doesn't exist and ensure it's writable
DB_DIR=$(dirname "$DB_PATH")
echo "Database directory: $DB_DIR"
echo "Database path: $DB_PATH"

# Ensure database directory is writable
if [ ! -w "$DB_DIR" ]; then
    echo "WARNING: Database directory is not writable, attempting to fix..."
    chmod 777 "$DB_DIR" 2>&1 || echo "Warning: chmod failed"
    # Try creating a test file
    if touch "$DB_DIR/.test_write" 2>/dev/null; then
        echo "✓ Can write to database directory"
        rm -f "$DB_DIR/.test_write"
    else
        echo "ERROR: Cannot write to database directory even after chmod!"
        echo "Directory info:"
        ls -la "$DB_DIR" 2>&1
        stat "$DB_DIR" 2>&1 || echo "stat failed"
    fi
else
    echo "✓ Database directory is writable"
fi

# Create database file if it doesn't exist
if [ ! -f "$DB_PATH" ]; then
    echo "Creating database file: $DB_PATH"
    if touch "$DB_PATH" 2>&1; then
        echo "✓ Database file created"
        chmod 666 "$DB_PATH" 2>&1 || echo "Warning: chmod database file failed"
        chown www-data:www-data "$DB_PATH" 2>&1 || echo "Warning: chown database file failed (may be normal)"
    else
        echo "ERROR: Failed to create database file!"
        echo "Parent directory permissions:"
        ls -la "$DB_DIR" 2>&1
    fi
else
    echo "Database file already exists: $DB_PATH"
    # Ensure existing database is writable
    chmod 666 "$DB_PATH" 2>&1 || echo "Warning: chmod existing database failed"
    chown www-data:www-data "$DB_PATH" 2>&1 || echo "Warning: chown existing database failed"
fi

# Final verification
echo "Final permissions check:"
echo "DATA_DIR:"
ls -la "$DATA_DIR" 2>&1
echo "Database directory:"
ls -la "$DB_DIR" 2>&1
if [ -f "$DB_PATH" ]; then
    echo "Database file:"
    ls -la "$DB_PATH" 2>&1
fi

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