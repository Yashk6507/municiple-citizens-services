#!/bin/bash

# Municipal Portal Setup Script
# This script helps you set up the Supabase-powered municipal portal

echo "=========================================="
echo "Municipal Portal Setup"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v14 or higher."
    exit 1
fi

echo "✓ Node.js found: $(node --version)"

# Check if .env exists
if [ ! -f .env ]; then
    echo ""
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo ""
    echo "📝 IMPORTANT: Edit the .env file with your Supabase credentials before starting!"
    echo ""
    echo "You need to:"
    echo "  1. Create a Supabase account at https://supabase.com"
    echo "  2. Create a new project"
    echo "  3. Copy your SUPABASE_URL and API keys to .env"
    echo "  4. Run the SQL in supabase-setup.sql in your Supabase SQL Editor"
    echo ""
else
    echo "✓ .env file exists"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✓ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create uploads directory
if [ ! -d "uploads" ]; then
    mkdir uploads
    echo "✓ Created uploads directory"
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Edit .env with your Supabase credentials"
echo "  2. Run the SQL in supabase-setup.sql in Supabase"
echo "  3. Start the server: npm start"
echo ""
echo "After starting, visit: http://localhost:4000"
echo "Default admin: admin@municipal.local / Admin@123"
echo ""
