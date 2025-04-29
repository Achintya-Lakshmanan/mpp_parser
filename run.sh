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

# Check for Java
if ! command -v java &> /dev/null; then
  echo "Java not found. Attempting to use Nix-installed Java..."
  if [ -d "/nix/store" ]; then
    JAVA_PATH=$(find /nix/store -name "java" -type f -executable | grep -i "openjdk.*bin/java" | head -n 1)
    if [ -n "$JAVA_PATH" ]; then
      echo "Found Java at $JAVA_PATH"
      # Create a symbolic link to make Java available in PATH
      mkdir -p "$HOME/bin"
      ln -sf "$JAVA_PATH" "$HOME/bin/java"
      export PATH="$HOME/bin:$PATH"
    else
      echo "Error: Java not found in Nix store. Please install Java manually."
      exit 1
    fi
  else
    echo "Error: Java not found and Nix store not present. Please install Java manually."
    exit 1
  fi
fi

# Verify Java is working
java -version || {
  echo "Java is not working correctly. Please check your Java installation."
  exit 1
}

# Check if MPXJ jar exists and download if not
if [ ! -f "src/backend/lib/mpxj.jar" ]; then
  echo "Downloading MPXJ library..."
  curl -L "https://www.mpxj.org/mpxj-9.3.0.jar" -o "src/backend/lib/mpxj.jar" || {
    echo "Failed to download MPXJ library. Trying alternative download..."
    wget -O "src/backend/lib/mpxj.jar" "https://www.mpxj.org/mpxj-9.3.0.jar" || {
      echo "All download attempts for MPXJ library failed. Please download manually."
      exit 1
    }
  }
fi

# Check if POI jar exists and download if not
if [ ! -f "src/backend/lib/poi.jar" ]; then
  echo "Downloading Apache POI library..."
  curl -L "https://archive.apache.org/dist/poi/release/bin/poi-bin-5.2.3-20220909.zip" -o poi.zip || {
    echo "Failed to download POI. Trying alternative download method..."
    wget -O poi.zip "https://archive.apache.org/dist/poi/release/bin/poi-bin-5.2.3-20220909.zip" || {
      echo "All download attempts for POI library failed. Please download manually."
      exit 1
    }
  }
  
  unzip -j poi.zip "poi-bin-5.2.3/poi-5.2.3.jar" -d src/backend/lib/ || {
    echo "Failed to unzip POI jar. Please check if unzip is installed and the file is valid."
    exit 1
  }
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

# Create a minimal build directory if it doesn't exist
# This is needed for serve to work properly
if [ ! -d "build" ] || [ -z "$(ls -A build)" ]; then
  echo "Creating minimal build directory..."
  mkdir -p build
  cat > build/index.html << EOL
<!DOCTYPE html>
<html>
<head>
  <title>MPP Parser</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { color: #333; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>MPP Parser - Loading...</h1>
    <p>If this message persists, please check the console for errors.</p>
  </div>
</body>
</html>
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
  echo "Starting frontend server with API proxy..."
  BACKEND_PORT=$BACKEND_PORT NODE_ENV=production npx serve -s build -l $PORT
  
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