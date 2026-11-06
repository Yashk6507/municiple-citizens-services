#!/bin/bash

# Municipal Portal Verification Script
# This script checks if all required files and configurations are in place

echo "========================================"
echo "Municipal Portal - Setup Verification"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC} Node.js found: $(node --version)"
else
    echo -e "${RED}✗${NC} Node.js not found. Please install Node.js v14+"
    exit 1
fi

# Check npm
echo "Checking npm..."
if command -v npm &> /dev/null; then
    echo -e "${GREEN}✓${NC} npm found: $(npm --version)"
else
    echo -e "${RED}✗${NC} npm not found"
    exit 1
fi

# Check required files
echo ""
echo "Checking required files..."

FILES=(
    "server-new.js"
    "supabase.js"
    "supabase-setup.sql"
    ".env.example"
    "package.json"
    "README.md"
    "QUICKSTART.md"
    "public/index.html"
    "public/app.js"
    "public/styles.css"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file - MISSING"
    fi
done

# Check directories
echo ""
echo "Checking directories..."

DIRS=("uploads" "public" "node_modules")

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $dir/"
    else
        echo -e "${YELLOW}⚠${NC} $dir/ - Not found"
    fi
done

# Check .env file
echo ""
echo "Checking environment configuration..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"

    # Check if configured
    if grep -q "your-project.supabase.co" .env; then
        echo -e "${YELLOW}⚠${NC} .env file needs configuration (still has placeholder values)"
    else
        echo -e "${GREEN}✓${NC} .env appears to be configured"
    fi
else
    echo -e "${RED}✗${NC} .env file not found"
    echo -e "   Run: cp .env.example .env"
fi

# Check node_modules
echo ""
echo "Checking dependencies..."
if [ -d "node_modules" ]; then
    if [ -d "node_modules/@supabase" ]; then
        echo -e "${GREEN}✓${NC} Dependencies installed (Supabase found)"
    else
        echo -e "${YELLOW}⚠${NC} Dependencies may need updating"
        echo -e "   Run: npm install"
    fi
else
    echo -e "${RED}✗${NC} Dependencies not installed"
    echo -e "   Run: npm install"
fi

# Summary
echo ""
echo "========================================"
echo "Verification Summary"
echo "========================================"
echo ""

if [ -f ".env" ] && [ -d "node_modules/@supabase" ]; then
    echo -e "${GREEN}✓ Setup appears complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Edit .env with your Supabase credentials"
    echo "  2. Run SQL in supabase-setup.sql"
    echo "  3. Start server: npm start"
else
    echo -e "${YELLOW}⚠ Setup incomplete${NC}"
    echo ""
    echo "Required actions:"
    [ ! -f ".env" ] && echo "  - Create .env file: cp .env.example .env"
    [ ! -d "node_modules" ] && echo "  - Install dependencies: npm install"
    echo "  - Configure .env with Supabase credentials"
    echo "  - Run supabase-setup.sql in Supabase"
fi

echo ""
