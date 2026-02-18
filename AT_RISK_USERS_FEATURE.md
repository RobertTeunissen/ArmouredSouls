# At-Risk Users Feature

## Overview
This feature allows admins to identify and monitor users who are at risk of bankruptcy, tracking their financial status over time using the audit log system.

## What "At Risk" Means
A user is considered "at risk" when their credit balance falls below **₡10,000** (the `BANKRUPTCY_RISK_THRESHOLD`). This threshold represents approximately 3 days of operating costs for an average stable.

## Features

### Backend API Endpoint
**GET** `/api/admin/users/at-risk`

Returns detailed information about users below the bankruptcy threshold:

```typescript
{
  threshold: 10000,
  currentCycle: 42,
  totalAtRisk: 168,
  users: [
    {
      userId: 123,
      username: "player1",
      stableName: "Iron Warriors",
      currentBalance: 8500,
      totalRepairCost: 2000,
      netBalance: 6500,
      cyclesAtRisk: 5,
      firstAtRiskCycle: 38,
      daysOfRunway: 2,
      robotCount: 3,
      damagedRobots: 1,
      balanceHistory: [
        {
          cycle: 42,
          timestamp: "2026-02-17T10:00:00Z",
          balance: 8500,
          dailyCost: 3200
        },
        // ... last 10 cycles
      ],
      createdAt: "2026-01-15T08:30:00Z"
    }
    // ... more users
  ],
  timestamp: "2026-02-17T12:00:00Z"
}
```

### Key Metrics

1. **Current Balance**: User's current credit balance
2. **Total Repair Cost**: Sum of all repair costs for damaged robots
3. **Net Balance**: Current balance minus repair costs (shows true available funds)
4. **Days of Runway**: Estimated days until bankruptcy based on average daily costs
5. **Cycles At Risk**: Number of consecutive cycles the user has been below threshold
6. **First At Risk Cycle**: The cycle when they first dropped below threshold
7. **Balance History**: Last 10 cycles of financial data from audit logs

### Frontend UI

Located in the Admin Dashboard tab, the at-risk users section appears when there are users below the threshold:

- **Summary Statistics**: Total at risk, threshold, current cycle, percentage of users
- **Detailed User Table**: Shows all at-risk users with sortable columns
- **Financial History**: Expandable details showing balance changes over the last 10 cycles
- **Color Coding**:
  - Red: Critical (balance < ₡5,000 or days of runway < 3)
  - Yellow: Warning (balance < ₡10,000 or days of runway < 7)
  - Green: Stable (days of runway > 7)

## How It Works

### Data Source
The feature uses the `AuditLog` table to track financial history:
- Looks for `daily_finances_processed` events
- Extracts balance snapshots from the last 30 cycles
- Calculates trends and determines how long users have been at risk

### Calculation Logic

1. **Identifying At-Risk Users**: Query users where `currency < BANKRUPTCY_RISK_THRESHOLD`
2. **Historical Analysis**: Retrieve audit log events for each user
3. **Trend Detection**: Count consecutive cycles below threshold
4. **Runway Calculation**: `daysOfRunway = currentBalance / averageDailyCost`

## Usage

### As an Admin

1. Navigate to the Admin Portal
2. Go to the Dashboard tab
3. If users are at risk, you'll see a warning in the Finances section
4. Click "View Details" to see the full at-risk users list
5. Review each user's:
   - Current financial status
   - Repair obligations
   - Historical balance trends
   - Days until potential bankruptcy

### Monitoring Recommendations

- **Critical (< 3 days runway)**: Immediate attention needed
- **Warning (3-7 days runway)**: Monitor closely
- **Stable (> 7 days runway)**: Routine monitoring

## Configuration

To change the bankruptcy threshold, modify the constant in `prototype/backend/src/routes/admin.ts`:

```typescript
const BANKRUPTCY_RISK_THRESHOLD = 10000; // Credits below which a user is considered at risk
```

## Future Enhancements

Potential improvements:
- Email notifications for users approaching bankruptcy
- Automated assistance programs (temporary credits, reduced costs)
- Predictive analytics to identify users likely to become at-risk
- Export functionality for financial reports
- Filtering and sorting options in the UI
- Charts showing balance trends over time
