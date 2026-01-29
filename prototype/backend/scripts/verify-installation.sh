#!/bin/bash

# Armoured Souls - Installation Verification Script
# This script checks if your installation is working correctly
#
# Usage: Run this script from the prototype/backend directory:
#   cd prototype/backend
#   bash scripts/verify-installation.sh

# Note: We don't use "set -e" here to show all verification results
# even if some checks fail

echo "🔍 Armoured Souls Installation Verification"
echo "==========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check Node.js version
echo "📦 Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   Node.js: $NODE_VERSION"
    
    # Extract major version number (e.g., v20.20.0 -> 20)
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\)\..*/\1/')
    
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "   ${RED}✗ Node.js 18+ required${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "   ${GREEN}✓ Node.js version OK${NC}"
    fi
else
    echo -e "   ${RED}✗ Node.js not found${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check if node_modules exists
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo -e "   ${RED}✗ node_modules not found${NC}"
    echo "   Run: npm install"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}✓ node_modules exists${NC}"
fi
echo ""

# Check if Prisma Client is generated
echo "🔧 Checking Prisma Client..."
if [ ! -d "node_modules/.prisma/client" ] && [ ! -d "node_modules/@prisma/client" ]; then
    echo -e "   ${RED}✗ Prisma Client not generated${NC}"
    echo "   Run: npx prisma generate"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}✓ Prisma Client generated${NC}"
fi
echo ""

# Check if .env file exists
echo "⚙️  Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo -e "   ${YELLOW}⚠ .env file not found${NC}"
    echo "   Run: cp .env.example .env"
    echo "   Then edit .env with your database credentials"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}✓ .env file exists${NC}"
fi
echo ""

# Check DATABASE_URL in .env
echo "🗄️  Checking database configuration..."
if [ -f ".env" ] && grep -q "DATABASE_URL=" .env; then
    echo -e "   ${GREEN}✓ DATABASE_URL configured${NC}"
else
    echo -e "   ${RED}✗ DATABASE_URL not found in .env${NC}"
    echo "   Add DATABASE_URL to your .env file"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check if Docker is running (optional but recommended)
echo "🐳 Checking Docker..."
if command -v docker &> /dev/null; then
    if docker ps &> /dev/null; then
        echo -e "   ${GREEN}✓ Docker is running${NC}"
        
        # Check if database container is running
        if docker ps | grep -q "postgres"; then
            echo -e "   ${GREEN}✓ PostgreSQL container is running${NC}"
        else
            echo -e "   ${YELLOW}⚠ PostgreSQL container not found${NC}"
            echo "   From the prototype directory, run: docker compose up -d"
        fi
    else
        echo -e "   ${YELLOW}⚠ Docker is installed but not running${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠ Docker not found${NC}"
fi
echo ""

# Test database connection and schema validity
echo "🔌 Testing database connection and schema..."
if npx prisma validate &> /dev/null; then
    echo -e "   ${GREEN}✓ Database connection and schema are valid${NC}"
else
    echo -e "   ${YELLOW}⚠ Database may not be accessible or schema has errors${NC}"
    echo "   Make sure PostgreSQL is running and DATABASE_URL is correct"
    echo "   Run: npx prisma validate (for detailed error messages)"
fi
echo ""

echo "==========================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Installation verification complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: npm run dev"
    echo "  2. Open: http://localhost:3001"
    echo "  3. Test API: curl http://localhost:3001/api/health"
    exit 0
else
    echo -e "${RED}❌ Installation verification failed with $ERRORS error(s)${NC}"
    echo ""
    echo "Please fix the errors above before continuing."
    echo ""
    echo "For help, see docs/TROUBLESHOOTING.md in the repository root"
    exit 1
fi
