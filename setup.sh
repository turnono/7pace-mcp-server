#!/bin/bash

# 7pace MCP Server Setup Script for Linux/macOS

echo "🚀 Setting up 7pace MCP Server..."

# Check Node.js installation
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js found: $NODE_VERSION"

# Install dependencies
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Build TypeScript
echo "Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build project"
    exit 1
fi

# Check if env.example exists and create .env if needed
if [ -f "env.example" ]; then
    if [ ! -f ".env" ]; then
        echo "Creating .env file from template..."
        cp env.example .env
        echo "📝 Please edit .env file with your actual 7pace token and organization"
    else
        echo "✅ .env file already exists"
    fi
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your 7pace credentials:"
echo "   - SEVENPACE_ORGANIZATION=labournet"
echo "   - SEVENPACE_TOKEN=your_token_here"
echo ""
echo "2. Get your 7pace API token:"
echo "   - Go to Azure DevOps → 7pace Timetracker"
echo "   - Settings → API & Reporting → Create New Token"
echo ""
echo "3. Test the server:"
echo "   npm start"
echo ""
echo "4. Add to Cursor MCP configuration:"
echo "   See cursor-mcp-config.json for example"

# Make the script executable
chmod +x setup.sh
