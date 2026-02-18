# At-Risk Users Implementation Summary

## What Was Built

Added a comprehensive feature to the Admin Portal that allows admins to:
1. See which users are at risk of bankruptcy (balance < ₡10,000)
2. Track how long each user has been at risk using audit log history
3. View detailed financial metrics and trends for each at-risk user

## Files Modified

### Backend
- **`prototype/backend/src/routes/admin.ts`**
  - Added new endpoint: `GET /api/admin/users/at-risk`
  - Queries users below bankruptcy threshold
  - Retrieves financial history from audit logs (last 30 cycles)
  - Calculates key metrics: cycles at risk, days of runway, net balance

### Frontend
- **`prototype/frontend/src/pages/AdminPage.tsx`**
  - Added TypeScript interfaces for at-risk user data
  - Added state management for at-risk users
  - Added `fetchAtRiskUsers()` function
  - Added comprehensive UI section in Dashboard tab showing:
    - Summary statistics
    - Detailed user table with financial metrics
    - Expandable balance history for each user
    - Color-coded risk indicators

## Key Features

### Backend API Response
```json
{
  "threshold": 10000,
  "currentCycle": 42,
  "totalAtRisk": 168,
  "users": [
    {
      "userId": 123,
      "username": "player1",
      "stableName": "Iron Warriors",
      "currentBalance": 8500,
      "totalRepairCost": 2000,
      "netBalance": 6500,
      "cyclesAtRisk": 5,
      "firstAtRiskCycle": 38,
      "daysOfRunway": 2,
      "robotCount": 3,
      "damagedRobots": 1,
      "balanceHistory": [...],
      "createdAt": "2026-01-15T08:30:00Z"
    }
  ]
}
```

### UI Features
- **Automatic Display**: Section appears when users are at risk
- **View Details Button**: Loads detailed at-risk user data
- **Summary Cards**: Shows total at risk, threshold, current cycle, percentage
- **User Table Columns**:
  - Stable name and username
  - Current balance (color-coded by severity)
  - Repair costs and damaged robot count
  - Net balance (balance - repair costs)
  - Days of runway (estimated days until bankruptcy)
  - Cycles at risk and when they first became at-risk
  - Robot count
  - Expandable balance history (last 10 cycles)

### Color Coding
- **Red**: Critical (balance < ₡5,000 or < 3 days runway)
- **Yellow**: Warning (balance < ₡10,000 or < 7 days runway)
- **Green**: Stable (> 7 days runway)

## How It Uses Audit Logs

The feature leverages the existing `AuditLog` table to track financial history:

1. Queries `daily_finances_processed` events for each at-risk user
2. Looks back up to 30 cycles
3. Extracts balance snapshots from event payloads
4. Calculates:
   - Average daily costs
   - Days of runway (balance / avg daily cost)
   - Consecutive cycles below threshold
   - First cycle when user became at-risk

## Testing

Both backend and frontend compile successfully:
- ✅ Backend TypeScript compilation passes
- ✅ Frontend diagnostics show no errors
- ✅ No breaking changes to existing functionality

## Usage

1. Start the application
2. Log in as an admin
3. Navigate to Admin Portal → Dashboard tab
4. If users are at risk, you'll see the warning in the Finances section
5. Click "View Details" to see the full at-risk users list
6. Click on balance history to see detailed financial trends

## Documentation

Created comprehensive documentation:
- **AT_RISK_USERS_FEATURE.md**: Complete feature documentation
- **IMPLEMENTATION_SUMMARY.md**: This file - implementation overview
