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

# Set environment variables for frontend build
# This ensures the React app uses the right API URL in production
ENV REACT_APP_API_URL=/api
ENV NODE_ENV=production

# Build the frontend application
RUN cd src && npm run build

# Prune frontend dev dependencies (optional, reduces image size)
RUN cd src && npm prune --production

# Create server configuration file to handle both frontend and API
RUN echo 'const express = require("express");                                                 \n\
const path = require("path");                                                                 \n\
const fs = require("fs");                                                                     \n\
const { createProxyMiddleware } = require("http-proxy-middleware");                           \n\
                                                                                              \n\
const app = express();                                                                        \n\
const port = process.env.PORT || 3000;                                                        \n\
                                                                                              \n\
// Start backend server process                                                               \n\
const { spawn } = require("child_process");                                                   \n\
const backendProcess = spawn("node", ["src/backend/server.js"]);                              \n\
                                                                                              \n\
backendProcess.stdout.on("data", (data) => {                                                  \n\
  console.log(`Backend stdout: ${data}`);                                                     \n\
});                                                                                           \n\
                                                                                              \n\
backendProcess.stderr.on("data", (data) => {                                                  \n\
  console.error(`Backend stderr: ${data}`);                                                   \n\
});                                                                                           \n\
                                                                                              \n\
// Setup API proxy middleware - send API requests to backend server                           \n\
app.use("/api", createProxyMiddleware({                                                       \n\
  target: "http://localhost:3001",                                                            \n\
  changeOrigin: true,                                                                         \n\
}));                                                                                          \n\
                                                                                              \n\
// Serve static files from React build                                                        \n\
app.use(express.static(path.join(__dirname, "src/build")));                                   \n\
                                                                                              \n\
// All other routes serve the React app                                                       \n\
app.get("*", (req, res) => {                                                                  \n\
  res.sendFile(path.join(__dirname, "src/build", "index.html"));                              \n\
});                                                                                           \n\
                                                                                              \n\
// Start frontend server                                                                      \n\
app.listen(port, () => {                                                                      \n\
  console.log(`Main server running on port ${port}`);                                         \n\
});                                                                                           \n\
                                                                                              \n\
// Handle shutdown properly                                                                   \n\
process.on("SIGTERM", () => {                                                                 \n\
  console.log("SIGTERM received, shutting down gracefully");                                  \n\
  backendProcess.kill();                                                                      \n\
  process.exit(0);                                                                            \n\
});                                                                                           \n\
' > /app/server.js

# Stage 2: Production Image
FROM node:18-alpine

# Install Java JDK for the parser
RUN apk add --no-cache openjdk11-jdk

# Install http-proxy-middleware for the unified server
RUN npm install --global http-proxy-middleware

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
COPY --from=builder /app/server.js ./server.js

# Create and set permissions for necessary directories
RUN mkdir -p /app/src/backend/uploads && chown -R node:node /app/src/backend/uploads
RUN mkdir -p /app/downloads && chown -R node:node /app/downloads
RUN mkdir -p /app/src/generator && chown -R node:node /app/src/generator

# Switch to non-root user
USER node

# Expose only the main port that Azure will connect to
EXPOSE 3000

# Environment variables for runtime
ENV NODE_ENV=production
ENV API_URL=/api
ENV PORT=3000

# Define the command to run the unified server
CMD ["node", "server.js"]

