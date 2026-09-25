#!/bin/sh

# Start the Node backend unconditionally, storage ON or OFF. With
# ENABLE_SERVER_STORAGE=false the backend still has work to do: `/api/config` is
# the app's boot probe and must answer `serverStorage:false` (ADR 0009 D2),
# `/healthz` is what the HEALTHCHECK polls (ADR 0010 Decision 8), and the
# published-link read and unpublish routes stay reachable (docs/deployment.md
# §D.1). Before ADR 0048 (2026-09-24) nothing listened on :3001 with storage OFF, so all
# three answered 502 through nginx and the container stayed `unhealthy` forever.
# server.js already refuses the storage routes with 503 when storage is off.
#
# Security review 2026-07-05: run the backend as the unprivileged `node` user
# (uid 1000) instead of root, so an RCE in the Node process does not get root in
# the container. We chown the storage dir first (as root, before dropping) so
# the switch works even when STORAGE_PATH is a bind mount whose ownership is set
# at runtime, not build time. The storage-off routes above still read that
# directory, so the mkdir/chown runs in both modes. nginx still starts as root
# to bind :80; its worker processes drop to the unprivileged `nginx` user per
# the base image's nginx.conf.
STORAGE_DIR="${STORAGE_PATH:-/data/diagrams}"
mkdir -p "$STORAGE_DIR"
chown -R node:node "$STORAGE_DIR" 2>/dev/null || \
    echo "Warning: could not chown $STORAGE_DIR — backend may lack write access"

if [ "$ENABLE_SERVER_STORAGE" = "true" ]; then
    echo "Server storage enabled ($STORAGE_DIR)"
else
    echo "Server storage disabled: the backend serves /api/config, /healthz and the published-link routes only"
fi

echo "Starting Axoview backend server..."
cd /app/packages/axoview-backend
su-exec node:node node server.js &
echo "Backend server started (as user node)"

echo "Starting nginx..."
nginx -g "daemon off;"
