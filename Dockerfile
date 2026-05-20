# Use the official Node.js runtime as the base image
FROM node:22 AS build

# Set the working directory in the container
WORKDIR /app

# Copy package files for the monorepo
COPY package*.json ./
COPY packages/axoview-lib/package*.json ./packages/axoview-lib/
COPY packages/axoview-app/package*.json ./packages/axoview-app/

#Update NPM
RUN npm install -g npm@11.5.2

# Install dependencies for the entire workspace
RUN npm install

# Copy the entire monorepo code
COPY . .

# Build the library first, then the app
RUN npm run build:lib && npm run build:app

# Use Node with nginx for production
FROM node:22-alpine

# Install web server packages
RUN apk add --no-cache nginx openssl

# Copy backend code
COPY --from=build /app/packages/axoview-backend /app/packages/axoview-backend

# Copy the built React app to Nginx's web server directory
COPY --from=build /app/packages/axoview-app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create data directory for persistent storage
RUN mkdir -p /data/diagrams

# Expose ports
EXPOSE 80 3001

# Environment variables with defaults
ENV ENABLE_SERVER_STORAGE=true
ENV STORAGE_PATH=/data/diagrams
ENV BACKEND_PORT=3001

# Container health probe (ADR 0010 Decision 8). wget ships in node:22-alpine;
# /healthz returns 503 if STORAGE_PATH is unwritable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${BACKEND_PORT:-3001}/healthz || exit 1

# Start services
ENTRYPOINT ["/docker-entrypoint.sh"]
