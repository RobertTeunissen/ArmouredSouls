# Analytics API Usage Guide

## Stable Summary Endpoint

### Endpoint
```
GET /api/analytics/stable/:userId/summary
```

### Description
Returns income, expenses, and net profit for the last N cycles for a specific stable (user).

### Parameters

**Path Parameters:**
- `userId` (required): The user ID to get analytics for

**Query Parameters:**
- `lastNCycles` (optional): Number of cycles to analyze (default: 10, minimum: 1)

### Response Format

```json
{
  "userId": 1,
  "cycleRange": [8000, 8004],
  "totalIncome": 750,
  "totalExpenses": 100,
  "netProfit": 650,
  "cycles": [
    {
      "cycleNumber": 8000,
      "income": 150,
      "expenses": 20,
      "netProfit": 130,
      "breakdown": {
        "battleCredits": 0,
        "merchandising": 100,
        "streaming": 50,
        "repairCosts": 0,
        "operatingCosts": 20
      }
    },
    // ... more cycles
  ]
}
```

### Response Fields

- `userId`: The user ID requested
- `cycleRange`: Array with [startCycle, endCycle] indicating the range of cycles analyzed
- `totalIncome`: Sum of all income across all cycles
- `totalExpenses`: Sum of all expenses across all cycles
- `netProfit`: Total income minus total expenses
- `cycles`: Array of per-cycle data with:
  - `cycleNumber`: The cycle number
  - `income`: Total income for this cycle
  - `expenses`: Total expenses for this cycle
  - `netProfit`: Net profit for this cycle
  - `breakdown`: Detailed breakdown of income and expenses:
    - `battleCredits`: Credits earned from battles
    - `merchandising`: Income from merchandising facility
    - `streaming`: Income from streaming facility
    - `repairCosts`: Costs for robot repairs
    - `operatingCosts`: Facility operating costs

### Example Usage

**Get last 10 cycles (default):**
```bash
curl http://localhost:3001/api/analytics/stable/1/summary
```

**Get last 5 cycles:**
```bash
curl http://localhost:3001/api/analytics/stable/1/summary?lastNCycles=5
```

**Get last 20 cycles:**
```bash
curl http://localhost:3001/api/analytics/stable/1/summary?lastNCycles=20
```

### Error Responses

**400 Bad Request - Invalid userId:**
```json
{
  "error": "Invalid userId"
}
```

**400 Bad Request - Invalid lastNCycles:**
```json
{
  "error": "Invalid lastNCycles parameter"
}
```

**404 Not Found - No snapshots exist:**
```json
{
  "error": "No cycle snapshots found",
  "message": "No cycles have been completed yet"
}
```

**404 Not Found - No snapshots in range:**
```json
{
  "error": "No snapshots found",
  "message": "No snapshots found for cycles 100 to 110"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "message": "Error details..."
}
```

### Notes

- The endpoint queries pre-aggregated cycle snapshots for performance
- If a user had no activity in a cycle, that cycle will show zero values
- The cycle range is automatically calculated based on the latest available cycle
- All monetary values are in credits (the game's currency)
- The endpoint requires cycle snapshots to be created (happens automatically at cycle completion)

### Requirements Satisfied

This endpoint satisfies **Requirement 12.1**:
> WHEN requesting stable income summary, THE Analytics_Engine SHALL return total income, expenses, and net profit for specified cycles
