# Stage 1: Dependencies and Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files for root and frontend
COPY package.json package-lock.json* ./
COPY src/package.json src/package-lock.json* src/

# Install root production dependencies
RUN npm ci --omit=dev

# Install frontend dependencies (including devDependencies for build)
RUN cd src && npm ci

# Copy the rest of the source code
COPY . .

# Build the frontend application
RUN cd src && npm run build

# Prune frontend dev dependencies (optional, reduces image size)
RUN cd src && npm prune --production

# Stage 2: Production Image
FROM node:18-alpine

# Install Java JDK for the parser
RUN apk add --no-cache openjdk11-jdk

WORKDIR /app

# Copy necessary files from the builder stage
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/src/package.json /app/src/package-lock.json* ./src/
COPY --from=builder /app/src/node_modules ./src/node_modules/
COPY --from=builder /app/src/build ./src/build/
COPY --from=builder /app/src/backend ./src/backend/
COPY --from=builder /app/src/generators ./src/generators/
COPY --from=builder /app/src/utils ./src/utils/
COPY --from=builder /app/src/services ./src/services/
COPY --from=builder /app/src/config ./src/config/
COPY --from=builder /app/src/visuals ./src/visuals/
COPY --from=builder /app/config ./config/
COPY --from=builder /app/src/backend/lib ./src/backend/lib/
COPY --from=builder /app/src/backend/schemas ./src/backend/schemas/
COPY --from=builder /app/src/mock ./src/mock/

# Ensure backend files are directly under /app/src/backend
# (Adjust if server.js location differs)

# Create and set permissions for necessary directories
RUN mkdir -p /app/src/backend/uploads && chown -R node:node /app/src/backend/uploads
RUN mkdir -p /app/downloads && chown -R node:node /app/downloads
RUN mkdir -p /app/src/generator && chown -R node:node /app/src/generator

# Switch to non-root user
USER node

# Expose the application ports
EXPOSE 3000
EXPOSE 3001

# Define the command to run the backend server
# Uses the script defined in the root package.json
CMD ["node", "src/backend/server.js"]

