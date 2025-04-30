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

# Make sure we have react-scripts in the src directory
if [ ! -d "src/node_modules/react-scripts" ]; then
  echo "Installing React dependencies..."
  cd src
  npm install react-scripts --save-dev
  cd ..
fi

# Create necessary directories
mkdir -p src/backend/lib
mkdir -p src/backend/uploads
mkdir -p src/generator
mkdir -p downloads
mkdir -p public

# Ensure we have the public directory set up
if [ ! -f "public/index.html" ]; then
  echo "Copying index.html to public directory..."
  cp src/public/index.html public/ 2>/dev/null || cp build/index.html public/ 2>/dev/null || echo "<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <meta name=\"theme-color\" content=\"#000000\" />
    <meta name=\"description\" content=\"MPP Parser - Convert Microsoft Project files to Power BI\" />
    <title>MPP Parser</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id=\"root\"></div>
  </body>
</html>" > public/index.html
fi

# Build the React app
if [ ! -d "build" ] || [ -z "$(ls -A build 2>/dev/null)" ]; then
  echo "Building React app..."
  npm run build
fi

# Check for Java - simplified approach
if ! command -v java &> /dev/null; then
  echo "Java not found. Checking Nix store..."
  JAVA_PATH=$(find /nix/store -name "java" -type f -executable | grep -i "openjdk.*bin/java" | head -n 1 || echo "")
  if [ -n "$JAVA_PATH" ]; then
    echo "Found Java at $JAVA_PATH"
    mkdir -p "$HOME/bin"
    ln -sf "$JAVA_PATH" "$HOME/bin/java"
    export PATH="$HOME/bin:$PATH"
  else
    echo "Java not found. Installing OpenJDK..."
    # Try to install Java using apt if available (for Replit)
    if command -v apt-get &> /dev/null; then
      apt-get update && apt-get install -y openjdk-11-jre-headless
    else
      echo "Failed to install Java. Please install manually."
      exit 1
    fi
  fi
fi

# Verify Java is working
if java -version &> /dev/null; then
  echo "Java is working"
else
  echo "Java is not working correctly. Continuing anyway..."
fi

# Check if MPXJ jar exists and download if not
if [ ! -f "src/backend/lib/mpxj.jar" ]; then
  echo "Downloading MPXJ library..."
  curl -L "https://www.mpxj.org/mpxj-9.3.0.jar" -o "src/backend/lib/mpxj.jar" || {
    echo "Failed to download MPXJ library. Trying wget..."
    wget -O "src/backend/lib/mpxj.jar" "https://www.mpxj.org/mpxj-9.3.0.jar" || {
      echo "Failed to download MPXJ JAR. The app may not work correctly."
    }
  }
fi

# Check if POI jar exists and download if not
if [ ! -f "src/backend/lib/poi.jar" ]; then
  echo "Downloading Apache POI library..."
  curl -L "https://archive.apache.org/dist/poi/release/bin/poi-bin-5.2.3-20220909.zip" -o poi.zip || {
    echo "Failed to download POI. Trying wget..."
    wget -O poi.zip "https://archive.apache.org/dist/poi/release/bin/poi-bin-5.2.3-20220909.zip" || {
      echo "Failed to download POI ZIP. The app may not work correctly."
    }
  }
  
  if [ -f "poi.zip" ]; then
    unzip -j poi.zip "poi-bin-5.2.3/poi-5.2.3.jar" -d src/backend/lib/ || {
      echo "Failed to unzip POI jar. The app may not work correctly."
    }
    if [ -f "src/backend/lib/poi-5.2.3.jar" ]; then
      mv src/backend/lib/poi-5.2.3.jar src/backend/lib/poi.jar
    fi
    rm -f poi.zip
  fi
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

# In Replit environment, we need a special setup
if [ -n "$REPL_ID" ]; then
  echo "Running on Replit..."
  
  # Get available port from Replit
  REPLIT_PORT=${PORT:-3000}
  echo "Replit PORT: $REPLIT_PORT"
  
  # For single-port Replit setup, run the backend server
  echo "Starting backend server..."
  # Don't use background process in Replit
  node src/backend/server.js
else
  # For local development, run both servers
  BACKEND_PORT=${PORT:-3001}
  FRONTEND_PORT=3000
  
  echo "Running in local development mode"
  echo "Starting backend server on port $BACKEND_PORT..."
  PORT=$BACKEND_PORT node src/backend/server.js &
  BACKEND_PID=$!
  
  # Wait for backend to start
  sleep 3
  
  # Start frontend server
  echo "Starting frontend server on port $FRONTEND_PORT..."
  PORT=$FRONTEND_PORT npx serve -s build --listen $FRONTEND_PORT
  cp -r src/build/ .
  # If frontend stops, kill the backend
  kill $BACKEND_PID
fi 