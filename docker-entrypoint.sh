#!/bin/sh

# Start Node.js backend if server storage is enabled.
# Security review 2026-07-05: run the backend as the unprivileged `node` user
# (uid 1000) instead of root, so an RCE in the Node process does not get root in
# the container. We chown the storage dir first (as root, before dropping) so
# the switch works even when STORAGE_PATH is a bind mount whose ownership is set
# at runtime, not build time. nginx still starts as root to bind :80; its worker
# processes drop to the unprivileged `nginx` user per the base image's nginx.conf.
if [ "$ENABLE_SERVER_STORAGE" = "true" ]; then
    echo "Starting Axoview backend server..."
    STORAGE_DIR="${STORAGE_PATH:-/data/diagrams}"
    mkdir -p "$STORAGE_DIR"
    chown -R node:node "$STORAGE_DIR" 2>/dev/null || \
        echo "Warning: could not chown $STORAGE_DIR — backend may lack write access"
    cd /app/packages/axoview-backend
    su-exec node:node node server.js &
    echo "Backend server started (as user node)"
else
    echo "Server storage disabled, backend not started"
fi

echo "Starting nginx..."
nginx -g "daemon off;"
