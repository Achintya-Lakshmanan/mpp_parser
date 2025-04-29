#!/bin/bash

# Print commands for debugging
set -x

# Setup environment variables
./setup-env.sh

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Create necessary directories
mkdir -p src/backend/lib
mkdir -p src/backend/uploads
mkdir -p src/generator
mkdir -p downloads

# Check if MPXJ jar exists and download if not
if [ ! -f "src/backend/lib/mpxj.jar" ]; then
  echo "Downloading MPXJ library..."
  curl -L "https://www.mpxj.org/mpxj-9.3.0.jar" -o "src/backend/lib/mpxj.jar"
fi

# Check if POI jar exists and download if not
if [ ! -f "src/backend/lib/poi.jar" ]; then
  echo "Downloading Apache POI library..."
  curl -L "https://archive.apache.org/dist/poi/release/bin/poi-bin-5.2.3-20220909.zip" -o poi.zip
  unzip -j poi.zip "poi-bin-5.2.3/poi-5.2.3.jar" -d src/backend/lib/
  mv src/backend/lib/poi-5.2.3.jar src/backend/lib/poi.jar
  rm poi.zip
fi

# Make sure schemas directory exists
mkdir -p src/backend/schemas

# Create schema file if it doesn't exist
if [ ! -f "src/backend/schemas/project-schema.json" ]; then
  echo "Creating basic project schema file..."
  cat > src/backend/schemas/project-schema.json << EOL
{
  "type": "object",
  "properties": {
    "properties": {
      "type": "object"
    },
    "tasks": {
      "type": "array"
    },
    "resources": {
      "type": "array"
    },
    "assignments": {
      "type": "array"
    }
  },
  "required": ["properties", "tasks"]
}
EOL
fi

# Determine the port for the backend (Replit uses a specific port)
BACKEND_PORT=${PORT:-3001}
FRONTEND_PORT=3000

# Check if running on Replit
if [ -n "$REPL_ID" ]; then
  echo "Running on Replit..."
  
  # For Replit, we need to expose both servers on the same port using a proxy
  echo "Starting backend server on port $BACKEND_PORT..."
  BACKEND_PORT=$BACKEND_PORT node src/backend/server.js &
  BACKEND_PID=$!
  
  # Wait for backend to start
  sleep 3
  
  # Use Replit as proxy by serving static files and proxying API requests
  BACKEND_PORT=$BACKEND_PORT NODE_ENV=production npx serve -s build
  
  # If frontend stops, kill the backend
  kill $BACKEND_PID
else
  # For local development, run both servers
  echo "Starting backend server on port $BACKEND_PORT..."
  PORT=$BACKEND_PORT node src/backend/server.js &
  BACKEND_PID=$!
  
  # Wait for backend to start
  sleep 3
  
  # Start frontend server
  echo "Starting frontend server on port $FRONTEND_PORT..."
  PORT=$FRONTEND_PORT npx serve -s build
  
  # If frontend stops, kill the backend
  kill $BACKEND_PID
fi 