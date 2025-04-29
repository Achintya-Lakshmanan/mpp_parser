#!/bin/bash

# Print commands for debugging
set -x

# Check if .env exists, if not create it
if [ ! -f ".env" ]; then
  echo "Creating .env file..."
  cat > .env << EOL
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
EOL
fi

# Print environment information
echo "System information:"
uname -a
echo "Node.js version:"
node --version || echo "Node.js not found"
echo "NPM version:"
npm --version || echo "NPM not found"

# Make sure JDK is installed
if command -v java > /dev/null 2>&1; then
  echo "Java is installed:"
  java -version
else
  echo "Java not directly accessible. We'll try to locate it in the Nix store during startup."
fi

# Check for Replit environment
if [ -n "$REPL_ID" ]; then
  echo "Running in Replit environment"
  echo "REPL_ID: $REPL_ID"
  echo "REPL_OWNER: $REPL_OWNER"
  echo "REPL_SLUG: $REPL_SLUG"
  
  # Create a .replit-ready file to indicate we've gone through setup
  touch .replit-ready
fi

echo "Environment setup complete." 