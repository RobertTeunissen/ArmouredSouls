#!/bin/bash

# Script to replace PrismaClient instantiation with singleton import
# This fixes the "too many database connections" error

echo "Fixing Prisma imports in service files..."

# Update service files
find src/services -name "*.ts" -type f -exec sed -i '' \
  -e 's/import { PrismaClient/import prisma from '\''..\/lib\/prisma'\'';\nimport { PrismaClient/g' \
  -e 's/^const prisma = new PrismaClient();$/\/\/ Using singleton prisma from ..\/lib\/prisma/g' \
  {} \;

# Update utils files
find src/utils -name "*.ts" -type f -exec sed -i '' \
  -e 's/import { PrismaClient/import prisma from '\''..\/lib\/prisma'\'';\nimport { PrismaClient/g' \
  -e 's/^const prisma = new PrismaClient();$/\/\/ Using singleton prisma from ..\/lib\/prisma/g' \
  {} \;

# Update remaining route files
for file in src/routes/tagTeams.ts src/routes/adminTournaments.ts src/routes/finances.ts src/routes/admin.ts; do
  if [ -f "$file" ]; then
    sed -i '' \
      -e 's/import { PrismaClient } from '\''@prisma\/client'\'';/import prisma from '\''..\/lib\/prisma'\'';/g' \
      -e 's/^const prisma = new PrismaClient();$/\/\/ Using singleton prisma from ..\/lib\/prisma/g' \
      "$file"
  fi
done

echo "Done! Please review the changes."
