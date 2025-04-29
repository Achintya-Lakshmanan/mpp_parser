#!/bin/bash

# Check if .env exists, if not create it
if [ ! -f ".env" ]; then
  echo "Creating .env file..."
  cat > .env << EOL
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
EOL
fi

# Make sure JDK is installed (for Replit)
if command -v java > /dev/null 2>&1; then
  echo "Java is installed:"
  java -version
else
  echo "Java is not installed. Please install JDK 11 or higher."
  exit 1
fi 