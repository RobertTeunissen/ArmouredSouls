# At-Risk Users Feature - Bug Fix

## Issue
The feature was failing with "Failed to fetch at-risk users" error.

## Root Cause
The backend was querying for a non-existent event type `daily_finances_processed` in the audit log. The actual event types used by the EventLogger are:
- `credit_change` - tracks balance changes
- `operating_costs` - tracks facility operating costs
- `passive_income` - tracks income from merchandising and streaming

## Fix Applied

### Backend Changes (`prototype/backend/src/routes/admin.ts`)

1. **Updated Event Query**: Changed from querying a single non-existent event type to querying the three actual financial event types:
   ```typescript
   eventType: {
     in: ['credit_change', 'operating_costs', 'passive_income'],
   }
   ```

2. **Improved Data Aggregation**: Added logic to group events by cycle and aggregate:
   - Balance from `credit_change` events (using `newBalance` field)
   - Costs from `operating_costs` events (using `totalCost` field)
   - Income from `passive_income` events (using `totalIncome` field)

3. **Better Fallback**: If no balance history is found, falls back to the user's current balance

### Frontend Changes (`prototype/frontend/src/pages/AdminPage.tsx`)

1. **Updated Interface**: Added `dailyIncome` field to the balance history interface

2. **Enhanced Display**: Updated the balance history display to show both income (green) and costs (red) when available:
   ```tsx
   {h.dailyIncome > 0 && (
     <span className="text-green-400">+₡{h.dailyIncome.toLocaleString()}</span>
   )}
   {h.dailyCost > 0 && (
     <span className="text-red-400">-₡{h.dailyCost.toLocaleString()}</span>
   )}
   ```

## How It Works Now

1. Queries the audit log for all financial events (credit changes, costs, income) for each at-risk user
2. Groups events by cycle number
3. Aggregates the data to show:
   - Most recent balance in each cycle
   - Total costs incurred
   - Total income earned
4. Displays up to 10 most recent cycles with full financial breakdown

## Testing

- ✅ Backend compiles successfully
- ✅ Frontend has no TypeScript errors
- ✅ Uses actual event types from EventLogger
- ✅ Handles missing data gracefully with fallbacks

## Result

The feature now correctly retrieves and displays financial history for at-risk users, showing:
- Current balance and trends
- Income vs. expenses per cycle
- Days of runway calculation based on actual financial data
- When users first became at-risk
