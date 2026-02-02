# Robot Statistics Feature

## Overview

The Admin Robot Statistics endpoint provides comprehensive analytics for debugging and balancing robot attributes. It helps administrators:

- Understand attribute distributions across the player base
- Identify robots with extreme (outlier) attribute values  
- Analyze how attributes correlate with win rates
- Compare attribute trends across different league tiers
- Find top and bottom performers for each attribute

## Quick Start

### 1. Prerequisites

- Backend server running (`npm run dev`)
- Admin user created (default: `admin` / `adminpass`)
- Some robots in the database with battle history

### 2. Basic Usage

#### Via Script

```bash
cd prototype/backend
npm run test:robot-stats
```

This will:
1. Login as admin
2. Fetch comprehensive robot statistics
3. Display formatted analysis in the terminal

#### Via API Client (Postman/cURL)

```bash
# Login as admin
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpass"}' \
  | jq -r '.token')

# Get robot statistics
curl http://localhost:3001/api/admin/stats/robots \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

## Response Structure

The endpoint returns seven main sections:

### 1. Summary
Overall system metrics:
- Total robots
- Robots with battle history
- Total battles
- Overall win rate
- Average ELO

### 2. Attribute Statistics
Statistical measures for all 23 robot attributes:
- Mean, Median, Standard Deviation
- Min, Max values
- Quartiles (Q1, Q3)
- Interquartile Range (IQR)
- Outlier bounds

### 3. Outliers
Robots with extreme attribute values using the IQR method:
- Values beyond Q1 - 1.5×IQR or Q3 + 1.5×IQR
- Up to 10 outliers per attribute
- Includes robot details (name, league, ELO, win rate)

### 4. Statistics by League
Attribute distributions broken down by league tier:
- Bronze, Silver, Gold, Platinum, Diamond, Champion
- Average attributes per league
- Helps verify league progression

### 5. Win Rate Analysis
Correlation between attribute values and win rates:
- Robots divided into 5 quintiles by attribute value
- Average win rate per quintile
- Identifies which attributes impact success

### 6. Top Performers
Top 5 robots for each attribute:
- Highest values
- Success metrics (league, ELO, win rate)

### 7. Bottom Performers
Bottom 5 robots for each attribute:
- Lowest values
- Performance metrics

## Use Cases

### Finding Overpowered Attributes

Look at **Win Rate Analysis**:

```json
{
  "combatPower": [
    { "quintile": 1, "avgWinRate": 35.2 },
    { "quintile": 2, "avgWinRate": 42.8 },
    { "quintile": 3, "avgWinRate": 48.5 },
    { "quintile": 4, "avgWinRate": 55.1 },
    { "quintile": 5, "avgWinRate": 68.9 }  // >25% increase = too strong
  ]
}
```

If Q5 win rate is >25% higher than Q1, the attribute may be overpowered.

### Detecting Exploits

Check **Outliers** across multiple attributes:

```json
{
  "outliers": {
    "combatPower": [
      { "id": 42, "name": "SuspiciousBot", "value": 48.5, ... }
    ],
    "targetingSystems": [
      { "id": 42, "name": "SuspiciousBot", "value": 47.2, ... }
    ]
  }
}
```

If the same robot appears as an outlier in many attributes, investigate their upgrade history.

### Verifying League Balance

Review **Statistics by League**:

```json
{
  "statsByLeague": {
    "bronze": { "attributes": { "combatPower": { "mean": 8.5 } } },
    "silver": { "attributes": { "combatPower": { "mean": 14.2 } } },
    "gold": { "attributes": { "combatPower": { "mean": 21.5 } } }
  }
}
```

Each league should show clear attribute progression (~20-30% increase).

## All 23 Attributes

The endpoint analyzes these attributes:

**Combat Systems (6)**:
- combatPower, targetingSystems, criticalSystems, penetration, weaponControl, attackSpeed

**Defensive Systems (5)**:
- armorPlating, shieldCapacity, evasionThrusters, damageDampeners, counterProtocols

**Chassis & Mobility (5)**:
- hullIntegrity, servoMotors, gyroStabilizers, hydraulicSystems, powerCore

**AI Processing (4)**:
- combatAlgorithms, threatAnalysis, adaptiveAI, logicCores

**Team Coordination (3)**:
- syncProtocols, supportSystems, formationTactics

## Performance Notes

- Expected response time: 1-3 seconds for 500 robots
- Uses single database query with efficient calculations
- Consider caching for very large datasets (>1000 robots)

## Documentation

For detailed documentation, see:
- [ADMIN_ROBOT_STATISTICS.md](/docs/ADMIN_ROBOT_STATISTICS.md) - Complete guide with workflows and examples

## Testing

The endpoint includes comprehensive test coverage:

```bash
npm test -- adminRobotStats.test.ts
```

Tests verify:
- Authentication and authorization
- Data structure and completeness
- Statistical calculations accuracy
- Outlier detection logic
- Win rate analysis
- League-based statistics

## Integration with Other Admin Tools

This endpoint complements existing admin features:

1. **Battle Debugging** (`GET /api/admin/battles/:id`)
   - Use stats to find outlier robots
   - Review their battle history in detail
   - Correlate attributes with battle outcomes

2. **Matchmaking Analysis** (`POST /api/admin/matchmaking/run`)
   - Understand attribute distributions
   - Verify matchmaking fairness
   - Identify underserved attribute ranges

3. **League Rebalancing** (`POST /api/admin/leagues/rebalance`)
   - Check league attribute progression
   - Adjust promotion/demotion criteria
   - Balance league difficulty curves

## Future Enhancements

Planned improvements:
- Historical trend analysis
- Automated balance recommendations
- Real-time dashboards with charts
- Export to CSV/JSON
- Scheduled automated reports

## Troubleshooting

**Empty response?**
- Need at least 5 robots in database
- Run `npm run prisma:seed` to generate test data

**No win rate analysis?**
- Requires robots with ≥5 battles
- Run bulk battle cycles: `POST /api/admin/cycles/bulk`

**Slow response?**
- Large dataset (>1000 robots)
- Consider adding caching layer
- Use during off-peak hours

## Example Output

```
=======================================================================
📊 ROBOT STATISTICS SUMMARY
=======================================================================

Total Robots: 150
Robots with Battles: 120
Total Battles: 1250
Overall Win Rate: 48.52%
Average ELO: 1245

=======================================================================
📈 ATTRIBUTE STATISTICS
=======================================================================

Top 5 Attributes (Combat Systems & Defense):
-----------------------------------------------------------------------
Attribute              Mean  Median  StdDev     Min     Max
-----------------------------------------------------------------------
combatPower           15.23   14.50    8.45    1.00   48.50
targetingSystems      18.45   17.20    9.12    1.00   45.30
hullIntegrity         16.78   15.50    7.89    1.00   42.10
armorPlating          14.92   14.00    8.23    1.00   39.80
evasionThrusters      13.56   12.80    7.45    1.00   38.20
```

---

**Status**: Production Ready  
**Last Updated**: February 2, 2026
