# Leaderboards Stable Name Update

## Summary
Updated all three leaderboard endpoints to display stable names instead of usernames when available.

## Changes Made

### Backend - Leaderboards API (`backend/src/routes/leaderboards.ts`)

#### 1. Prestige Leaderboard (`GET /api/leaderboards/prestige`)
- Updated user query to include `stableName` field in the select
- Changed from using `include` to explicit `select` for better performance
- Updated response to use: `stableName: user.stableName || user.username`
- Removed TODO comment about adding stable name field

#### 2. Fame Leaderboard (`GET /api/leaderboards/fame`)
- Updated user select to include `stableName` field
- Updated response to use: `stableName: robot.user.stableName || robot.user.username`

#### 3. Total Losses Leaderboard (`GET /api/leaderboards/losses`)
- Updated user select to include `stableName` field
- Updated response to use: `stableName: robot.user.stableName || robot.user.username`

## Display Logic

All three leaderboards now use the same pattern:

```typescript
// For user-based leaderboards (Prestige)
stableName: user.stableName || user.username

// For robot-based leaderboards (Fame, Losses)
stableName: robot.user.stableName || robot.user.username
```

This ensures:
- If a user has set a stable name, it will be displayed
- If no stable name is set, the username is used as fallback
- No breaking changes to the API response structure

## Frontend

No frontend changes were needed because:
- The `PrestigeLeaderboardEntry` interface already had `stableName` field
- The frontend was already displaying `entry.stableName` (line 193 in LeaderboardsPrestigePage.tsx)
- The same applies to Fame and Losses leaderboards

## Testing

To verify the changes:

1. **Set a stable name** in your profile
2. **Check Prestige Leaderboard** - Your stable name should appear
3. **Check Fame Leaderboard** - Your stable name should appear next to your robots
4. **Check Total Losses Leaderboard** - Your stable name should appear next to your robots
5. **Users without stable names** - Should still see their username

## Affected Endpoints

- ✅ `GET /api/leaderboards/prestige` - Shows stable names for users
- ✅ `GET /api/leaderboards/fame` - Shows stable names for robot owners
- ✅ `GET /api/leaderboards/losses` - Shows stable names for robot owners

## Database Fields Used

- `User.stableName` - Optional stable name set by user
- `User.username` - Fallback when no stable name is set

## Consistency

All leaderboards now consistently display stable names, matching the behavior of:
- Dashboard header
- Hall of Records
- Profile page

This provides a unified experience across the entire application.
