#!/bin/bash

# Script to update records.ts to use stable names

FILE="src/routes/records.ts"

# 1. Add helper function and userSelect constant after imports
sed -i '' '/^const router = express.Router();$/a\
\
// Helper to get display name (stableName or username fallback)\
const getUserDisplayName = (user: { username: string; stableName?: string | null }) => {\
  return user.stableName || user.username;\
};\
\
// User select for records (includes stableName)\
const userSelect = {\
  username: true,\
  stableName: true,\
};
' "$FILE"

# 2. Replace all user selects
sed -i '' 's/user: { select: { username: true } }/user: { select: userSelect }/g' "$FILE"

# 3. Replace all .user.username with getUserDisplayName(.user)
perl -i -pe 's/(\w+)\.user\.username/getUserDisplayName($1.user)/g' "$FILE"

echo "Updated $FILE with stable name support"
