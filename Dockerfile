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

# Create server configuration file to handle API routing and frontend serving
RUN echo 'const express = require("express");                                                 \n\
const path = require("path");                                                                 \n\
const app = express();                                                                        \n\
                                                                                              \n\
// Get port from environment or use 3000                                                      \n\
const port = process.env.PORT || 3000;                                                        \n\
                                                                                              \n\
// Middleware to properly route API calls to the backend server                               \n\
app.use("/api", (req, res) => {                                                               \n\
  // Forward all API requests to the backend server running on port 3001                      \n\
  res.redirect(`http://localhost:3001${req.originalUrl}`);                                    \n\
});                                                                                           \n\
                                                                                              \n\
// Serve static files from build directory                                                    \n\
app.use(express.static(path.join(__dirname, "src/build")));                                   \n\
                                                                                              \n\
// All other routes serve the React app                                                       \n\
app.get("*", (req, res) => {                                                                  \n\
  res.sendFile(path.join(__dirname, "src/build", "index.html"));                              \n\
});                                                                                           \n\
                                                                                              \n\
// Start the frontend server                                                                  \n\
app.listen(port, () => {                                                                      \n\
  console.log(`Frontend server running on port ${port}`);                                     \n\
});                                                                                           \n\
' > /app/proxy-server.js

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
COPY --from=builder /app/proxy-server.js ./proxy-server.js

# Create startup script to handle backend configuration
RUN echo '#!/bin/sh\n\
# Ensure backend properly handles API requests\n\
echo "Starting server with API_URL=$API_URL"\n\
# Start backend on port 3001\n\
node src/backend/server.js &\n\
# Start frontend proxy on port 3000\n\
node proxy-server.js\n\
' > /app/start.sh && chmod +x /app/start.sh

# Create and set permissions for necessary directories
RUN mkdir -p /app/src/backend/uploads && chown -R node:node /app/src/backend/uploads
RUN mkdir -p /app/downloads && chown -R node:node /app/downloads
RUN mkdir -p /app/src/generator && chown -R node:node /app/src/generator

# Switch to non-root user
USER node

# Expose the application ports
EXPOSE 3000
EXPOSE 3001

# Environment variables for runtime
ENV NODE_ENV=production
ENV API_URL=/api

# Define the command to run the backend server using the startup script
CMD ["/app/start.sh"]

