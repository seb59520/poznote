#!/bin/sh
# Health check script for Railway
# Checks if nginx and php-fpm are running

if ! pgrep nginx > /dev/null; then
    echo "ERROR: nginx is not running"
    exit 1
fi

if ! pgrep php-fpm > /dev/null; then
    echo "ERROR: php-fpm is not running"
    exit 1
fi

# Try to connect to nginx
NGINX_PORT=${PORT:-80}
if ! wget -q --spider http://localhost:$NGINX_PORT/ 2>/dev/null && ! curl -s -o /dev/null -w "%{http_code}" http://localhost:$NGINX_PORT/ | grep -q "200\|302\|301"; then
    echo "ERROR: nginx is not responding on port $NGINX_PORT"
    exit 1
fi

echo "OK: All services are running"
exit 0

