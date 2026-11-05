# ==============================================================================
# Stage 1: Build & Dependencies
# ==============================================================================
FROM node:20-bookworm-slim AS build

# Install build tools required for native C++ npm packages (e.g. bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# ==============================================================================
# Stage 2: Hardened Production Runtime
# ==============================================================================
FROM node:20-bookworm-slim AS production

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install curl (for healthcheck) and dumb-init (for proper PID 1 signal forwarding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production node_modules from build stage with node ownership
COPY --from=build --chown=node:node /app/node_modules ./node_modules

# Copy application source code
COPY --chown=node:node . .

# Copy and set executable permissions for entrypoint script
COPY --chown=node:node docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Run as non-privileged node user (UID 1000)
USER node

# Expose internal application port
EXPOSE 3000

# Container healthcheck: ping the local express server
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# dumb-init ensures SIGTERM/SIGINT are handled cleanly when stopping containers
ENTRYPOINT ["/usr/bin/dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "server.js"]
