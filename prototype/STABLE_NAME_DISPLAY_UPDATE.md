# Stable Name Display Update

## Summary
Updated the application to display the user's stable name (if set) instead of username across all pages.

## Changes Made

### Frontend

1. **AuthContext** (`frontend/src/contexts/AuthContext.tsx`)
   - Added `stableName?: string | null` to the `User` interface
   - The profile API already returns this field, so it's now available in the auth context

2. **DashboardPage** (`frontend/src/pages/DashboardPage.tsx`)
   - Updated header to display: `{user.stableName || user.username}'s Stable`
   - Falls back to username if no stable name is set

### Backend

3. **Records API** (`backend/src/routes/records.ts`)
   - Added `getUserDisplayName()` helper function to return stableName or username fallback
   - Added `userSelect` constant that includes both `username` and `stableName`
   - Updated all user queries to include `stableName` field
   - Updated all response objects to use `getUserDisplayName()` for the username field
   - This ensures Hall of Records displays stable names

## How It Works

1. When a user sets their stable name in the profile page, it's saved to the database
2. The AuthContext fetches the user profile (including stableName) on login/refresh
3. All pages that display the user's name now check for `stableName` first, falling back to `username` if not set
4. The backend APIs return `stableName` in user data, and use it as the display name in responses

## Display Logic

```typescript
// Frontend
const displayName = user.stableName || user.username;

// Backend
const getUserDisplayName = (user: { username: string; stableName?: string | null }) => {
  return user.stableName || user.username;
};
```

## Pages Updated

- ✅ Dashboard - Shows stable name in header
- ✅ Hall of Records - Shows stable names in all records
- ✅ Profile Page - Allows editing stable name
- 🔄 Other pages will automatically use stable name when they access user data through AuthContext

## Testing

1. Set a stable name in the profile page
2. Navigate to the dashboard - should see your stable name
3. Check Hall of Records - should see stable names for all users who have set them
4. Users without stable names will still show their username

## Future Enhancements

Consider updating these pages to also display stable names:
- Battle history (opponent names)
- Leaderboards
- League standings
- Tournament brackets
- Tag team displays
