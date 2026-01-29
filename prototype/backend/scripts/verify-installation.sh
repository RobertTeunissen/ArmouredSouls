#!/bin/bash

# Armoured Souls - Installation Verification Script
# This script checks if your installation is working correctly

set -e  # Exit on any error

echo "🔍 Armoured Souls Installation Verification"
echo "==========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "   Node.js: $NODE_VERSION"
if [[ "$NODE_VERSION" < "v18" ]]; then
    echo -e "   ${RED}✗ Node.js 18+ required${NC}"
    exit 1
else
    echo -e "   ${GREEN}✓ Node.js version OK${NC}"
fi
echo ""

# Check if node_modules exists
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo -e "   ${RED}✗ node_modules not found${NC}"
    echo "   Run: npm install"
    exit 1
else
    echo -e "   ${GREEN}✓ node_modules exists${NC}"
fi
echo ""

# Check if Prisma Client is generated
echo "🔧 Checking Prisma Client..."
if [ ! -d "node_modules/.prisma/client" ] && [ ! -d "node_modules/@prisma/client" ]; then
    echo -e "   ${RED}✗ Prisma Client not generated${NC}"
    echo "   Run: npx prisma generate"
    exit 1
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
    exit 1
else
    echo -e "   ${GREEN}✓ .env file exists${NC}"
fi
echo ""

# Check DATABASE_URL in .env
echo "🗄️  Checking database configuration..."
if ! grep -q "DATABASE_URL=" .env; then
    echo -e "   ${RED}✗ DATABASE_URL not found in .env${NC}"
    echo "   Add DATABASE_URL to your .env file"
    exit 1
else
    echo -e "   ${GREEN}✓ DATABASE_URL configured${NC}"
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
            echo "   Run: cd .. && docker compose up -d"
        fi
    else
        echo -e "   ${YELLOW}⚠ Docker is installed but not running${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠ Docker not found${NC}"
fi
echo ""

# Test database connection
echo "🔌 Testing database connection..."
if npx prisma db execute --stdin <<< "SELECT 1;" &> /dev/null; then
    echo -e "   ${GREEN}✓ Database connection successful${NC}"
else
    echo -e "   ${RED}✗ Cannot connect to database${NC}"
    echo "   Make sure PostgreSQL is running and DATABASE_URL is correct"
    exit 1
fi
echo ""

# Check schema validity
echo "📋 Validating Prisma schema..."
if npx prisma validate &> /dev/null; then
    echo -e "   ${GREEN}✓ Prisma schema is valid${NC}"
else
    echo -e "   ${RED}✗ Prisma schema has errors${NC}"
    echo "   Run: npx prisma validate"
    exit 1
fi
echo ""

echo "==========================================="
echo -e "${GREEN}✅ Installation verification complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run: npm run dev"
echo "  2. Open: http://localhost:3001"
echo "  3. Test API: curl http://localhost:3001/api/health"
echo ""
echo "For troubleshooting, see: ../../docs/TROUBLESHOOTING.md"
