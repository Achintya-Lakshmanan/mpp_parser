# Stage 1: Dependencies and Build
FROM node:18-alpine AS builder

WORKDIR /app

# Add build argument for API URL
ARG REACT_APP_API_URL=/api

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
# Use the build argument value
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV NODE_ENV=production

# Build the frontend application
RUN cd src && npm run build

# Prune frontend dev dependencies (optional, reduces image size)
RUN cd src && npm prune --production

# Create proper server.js file without escape characters
RUN printf '%s\n' \
'const express = require("express");' \
'const path = require("path");' \
'const fs = require("fs");' \
'const { createProxyMiddleware } = require("http-proxy-middleware");' \
'' \
'const app = express();' \
'const port = process.env.PORT || 3000;' \
'' \
'// Start backend server process' \
'const { spawn } = require("child_process");' \
'// Explicitly set backend to port 3001' \
'const backendProcess = spawn("node", ["src/backend/server.js"], {' \
'  env: { ...process.env, PORT: "3001", BACKEND_PORT: "3001" }' \
'});' \
'' \
'// Log backend port for debugging' \
'console.log("Starting backend server on port 3001");' \
'' \
'backendProcess.stdout.on("data", (data) => {' \
'  console.log(`Backend stdout: ${data}`);' \
'});' \
'' \
'backendProcess.stderr.on("data", (data) => {' \
'  console.error(`Backend stderr: ${data}`);' \
'});' \
'' \
'// Setup API proxy middleware - send API requests to backend server' \
'const backendUrl = "http://localhost:3001";' \
'console.log(`Proxying API requests to backend at: ${backendUrl}`);' \
'' \
'app.use("/api", createProxyMiddleware({' \
'  target: backendUrl,' \
'  changeOrigin: true,' \
'  pathRewrite: { "^/api": "" },' \
'  onProxyRes: function(proxyRes, req, res) {' \
'    proxyRes.headers["Access-Control-Allow-Origin"] = "*";' \
'    proxyRes.headers["Access-Control-Allow-Headers"] = "Origin, X-Requested-With, Content-Type, Accept";' \
'  }' \
'}));' \
'' \
'// Direct proxy for parse endpoint' \
'app.use("/parse", createProxyMiddleware({' \
'  target: backendUrl,' \
'  changeOrigin: true,' \
'  onProxyRes: function(proxyRes, req, res) {' \
'    proxyRes.headers["Access-Control-Allow-Origin"] = "*";' \
'    proxyRes.headers["Access-Control-Allow-Headers"] = "Origin, X-Requested-With, Content-Type, Accept";' \
'  }' \
'}));' \
'' \
'// Serve static files from React build' \
'app.use(express.static(path.join(__dirname, "src/build")));' \
'' \
'// All other routes serve the React app' \
'app.get("*", (req, res) => {' \
'  res.sendFile(path.join(__dirname, "src/build", "index.html"));' \
'});' \
'' \
'// Start frontend server on port 3000' \
'const frontendPort = 3000;' \
'app.listen(frontendPort, () => {' \
'  console.log(`Frontend server running on port ${frontendPort}`);' \
'  console.log(`Backend server should be running on port 3001`);' \
'});' \
'' \
'// Handle shutdown properly' \
'process.on("SIGTERM", () => {' \
'  console.log("SIGTERM received, shutting down gracefully");' \
'  backendProcess.kill();' \
'  process.exit(0);' \
'});' > /app/server.js

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
COPY --from=builder /app/src/public ./src/public/

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
ENV BACKEND_PORT=3001
ENV BACKEND_URL=http://localhost:3001

# Define the command to run the unified server
CMD ["node", "server.js"]

