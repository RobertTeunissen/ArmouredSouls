# Admin Robot Statistics Guide

**Date**: February 2, 2026  
**Status**: Active  
**Purpose**: Guide for administrators to analyze robot attributes and identify outliers for debugging and balancing

---

## Overview

The new robot statistics endpoint provides comprehensive analytics for all 23 robot attributes, helping administrators:
- Understand attribute distributions across the player base
- Identify robots with extreme (outlier) attribute values
- Analyze how attributes correlate with win rates
- Compare attribute trends across different league tiers
- Find top and bottom performers for each attribute

---

## Endpoint

### GET /api/admin/stats/robots

**Authentication**: Required (Admin role)

**Description**: Returns comprehensive statistical analysis of all robots in the system.

**Request**:
```http
GET /api/admin/stats/robots
Authorization: Bearer <admin_token>
```

**Response Structure**:
```json
{
  "summary": { ... },           // Overall system statistics
  "attributeStats": { ... },    // Statistical measures for each attribute
  "outliers": { ... },          // Robots with extreme attribute values
  "statsByLeague": { ... },     // Attribute distributions by league tier
  "winRateAnalysis": { ... },   // Correlation between attributes and win rates
  "topPerformers": { ... },     // Top 5 robots per attribute
  "bottomPerformers": { ... },  // Bottom 5 robots per attribute
  "timestamp": "2026-02-02T08:00:00.000Z"
}
```

---

## Response Sections

### 1. Summary Statistics

Overall system metrics:

```json
{
  "summary": {
    "totalRobots": 150,              // Total robots (excluding bye robots)
    "robotsWithBattles": 120,        // Robots that have fought at least once
    "totalBattles": 1250,            // Total battles across all robots
    "overallWinRate": 48.5,          // System-wide win rate percentage
    "averageElo": 1245               // Average ELO rating
  }
}
```

**Use Cases**:
- Quick health check of the game ecosystem
- Verify sufficient battle activity
- Confirm balanced win rates (should be ~50%)

---

### 2. Attribute Statistics

Detailed statistical measures for each of the 23 robot attributes:

```json
{
  "attributeStats": {
    "combatPower": {
      "mean": 15.23,        // Average value across all robots
      "median": 14.50,      // Middle value (50th percentile)
      "stdDev": 8.45,       // Standard deviation (measure of spread)
      "min": 1.00,          // Minimum value
      "max": 48.50,         // Maximum value
      "q1": 8.25,           // First quartile (25th percentile)
      "q3": 22.75,          // Third quartile (75th percentile)
      "iqr": 14.50,         // Interquartile range (Q3 - Q1)
      "lowerBound": -13.50, // Lower outlier threshold (Q1 - 1.5*IQR)
      "upperBound": 44.50   // Upper outlier threshold (Q3 + 1.5*IQR)
    },
    "targetingSystems": { ... },
    // ... all 23 attributes
  }
}
```

**Attribute Categories**:

**Combat Systems (6 attributes)**:
- `combatPower` - Base damage multiplier
- `targetingSystems` - Hit chance, accuracy
- `criticalSystems` - Critical hit chance
- `penetration` - Bypasses armor/shields
- `weaponControl` - Weapon handling, damage multiplier
- `attackSpeed` - Cooldown reduction

**Defensive Systems (5 attributes)**:
- `armorPlating` - Physical damage reduction
- `shieldCapacity` - Max energy shield HP
- `evasionThrusters` - Dodge chance
- `damageDampeners` - Critical damage reduction
- `counterProtocols` - Counter-attack chance

**Chassis & Mobility (5 attributes)**:
- `hullIntegrity` - Max HP
- `servoMotors` - Movement speed, positioning
- `gyroStabilizers` - Balance, reaction time
- `hydraulicSystems` - Melee damage bonus
- `powerCore` - Energy shield regen rate

**AI Processing (4 attributes)**:
- `combatAlgorithms` - Decision quality
- `threatAnalysis` - Target priority
- `adaptiveAI` - Learning over time
- `logicCores` - Performance under pressure

**Team Coordination (3 attributes)**:
- `syncProtocols` - Team damage multipliers
- `supportSystems` - Buff adjacent allies
- `formationTactics` - Formation bonuses

**Use Cases**:
- Identify which attributes have high variance (stdDev) vs low variance
- Find attributes that are underutilized (low mean/median)
- Detect balance issues (e.g., one attribute much stronger than others)
- Plan rebalancing efforts based on distribution data

---

### 3. Outlier Detection

Robots with extreme attribute values, identified using the IQR (Interquartile Range) method:

```json
{
  "outliers": {
    "combatPower": [
      {
        "id": 42,
        "name": "OverpoweredBot",
        "value": 47.50,      // Attribute value
        "league": "champion",
        "elo": 1850,
        "winRate": 78.5      // Win percentage
      },
      {
        "id": 15,
        "name": "WeakBot",
        "value": 2.00,
        "league": "bronze",
        "elo": 950,
        "winRate": 15.2
      }
      // ... up to 10 outliers per attribute
    ],
    // Only attributes with outliers are included
  }
}
```

**Outlier Detection Method**:
- Uses IQR (Interquartile Range) method
- Lower bound: Q1 - 1.5 × IQR
- Upper bound: Q3 + 1.5 × IQR
- Values outside these bounds are considered outliers
- Top 10 outliers per attribute (sorted by distance from mean)

**Use Cases**:
- Find robots that may be exploiting game mechanics
- Identify bugs in attribute calculations
- Detect attribute upgrade anomalies
- Balance testing - see if outliers dominate their leagues

**Example Analysis**:
```
Outlier: "SuperBot" has combatPower: 47.50
- Upper bound: 44.50
- Distance from bound: 3.00
- League: Champion
- Win rate: 78.5%

Investigation:
1. Check upgrade history - legitimate progression?
2. Review battles - dominating opponents?
3. Consider cap adjustments if attribute too powerful
```

---

### 4. Statistics by League Tier

Attribute distributions broken down by league:

```json
{
  "statsByLeague": {
    "bronze": {
      "count": 45,          // Robots in this league
      "averageElo": 1050,   // Average ELO for the league
      "attributes": {
        "combatPower": {
          "mean": 8.50,
          "median": 8.00,
          "min": 1.00,
          "max": 15.00
        },
        // ... all 23 attributes
      }
    },
    "silver": { ... },
    "gold": { ... },
    "platinum": { ... },
    "diamond": { ... },
    "champion": { ... }
  }
}
```

**Use Cases**:
- Verify league progression is working (higher leagues should have higher attributes)
- Identify stagnant leagues (attributes too similar across tiers)
- Balance league difficulty curves
- Detect promotion/demotion issues

**Expected Pattern**:
```
Bronze:    Low attributes, learning players
Silver:    Slightly improved, active upgrading
Gold:      Moderate attributes, competitive play
Platinum:  High attributes, strategic builds
Diamond:   Very high attributes, min-maxing
Champion:  Elite attributes, near-perfect builds
```

**Red Flags**:
- Bronze league has higher average attributes than Silver
- No clear attribute progression between adjacent leagues
- Champion league has same attributes as Platinum

---

### 5. Win Rate Analysis

Correlation between attribute values and win rates, using quintile analysis:

```json
{
  "winRateAnalysis": {
    "combatPower": [
      {
        "quintile": 1,      // Bottom 20% of robots by this attribute
        "avgValue": 5.25,   // Average attribute value in quintile
        "avgWinRate": 35.2, // Average win rate for this group
        "sampleSize": 24    // Number of robots in quintile
      },
      {
        "quintile": 2,
        "avgValue": 10.50,
        "avgWinRate": 42.8,
        "sampleSize": 24
      },
      {
        "quintile": 3,
        "avgValue": 15.75,
        "avgWinRate": 48.5,
        "sampleSize": 24
      },
      {
        "quintile": 4,
        "avgValue": 22.30,
        "avgWinRate": 55.1,
        "sampleSize": 24
      },
      {
        "quintile": 5,      // Top 20% of robots by this attribute
        "avgValue": 35.80,
        "avgWinRate": 68.9,
        "sampleSize": 24
      }
    ],
    // ... all 23 attributes
  }
}
```

**Analysis Method**:
- Only includes robots with ≥5 battles (statistical significance)
- Robots sorted by attribute value
- Divided into 5 equal quintiles (20% each)
- Average win rate calculated per quintile

**Use Cases**:
- Identify which attributes most strongly correlate with success
- Find undervalued attributes (high quintile, low win rate increase)
- Detect overpowered attributes (steep win rate increase in top quintile)
- Guide player upgrade recommendations

**Interpreting Results**:

**Strong Correlation** (Good):
```
combatPower:
Q1: 35.2% win rate
Q2: 42.8% win rate
Q3: 48.5% win rate
Q4: 55.1% win rate
Q5: 68.9% win rate

→ Clear linear relationship
→ Attribute is impactful and balanced
```

**Weak Correlation** (Potential Issue):
```
syncProtocols:
Q1: 47.5% win rate
Q2: 48.2% win rate
Q3: 49.1% win rate
Q4: 49.8% win rate
Q5: 50.5% win rate

→ Minimal impact on wins
→ Attribute may be too weak or not working correctly
```

**Non-Linear Correlation** (Investigation Needed):
```
evasionThrusters:
Q1: 48.5% win rate
Q2: 52.1% win rate
Q3: 45.2% win rate (drop!)
Q4: 51.8% win rate
Q5: 49.5% win rate

→ Irregular pattern
→ Possible bug or interaction with other attributes
```

---

### 6. Top Performers

Top 5 robots for each attribute:

```json
{
  "topPerformers": {
    "combatPower": [
      {
        "id": 42,
        "name": "EliteWarrior",
        "value": 48.50,
        "league": "champion",
        "elo": 1850,
        "winRate": 78.5
      },
      // ... 4 more
    ],
    // ... all 23 attributes
  }
}
```

**Use Cases**:
- Identify player builds that maximize specific attributes
- Study successful robot configurations
- Recognize exceptional players
- Validate attribute caps are working

---

### 7. Bottom Performers

Bottom 5 robots for each attribute:

```json
{
  "bottomPerformers": {
    "combatPower": [
      {
        "id": 15,
        "name": "Rookie",
        "value": 1.00,
        "league": "bronze",
        "elo": 850,
        "winRate": 12.5
      },
      // ... 4 more
    ],
    // ... all 23 attributes
  }
}
```

**Use Cases**:
- Identify new or inactive players
- Find robots that need rebalancing
- Detect attribute calculation bugs (e.g., stuck at minimum value)
- Onboarding improvements - help struggling players

---

## Practical Debugging Workflows

### Workflow 1: Investigating Balance Complaints

**Scenario**: Players complain "Combat Power is too strong, nothing else matters"

**Steps**:
1. Check `winRateAnalysis.combatPower`:
   - Is there a steep win rate increase in Q5?
   - Compare to other attributes - is the slope much steeper?

2. Check `statsByLeague`:
   - Are champion league robots maxing out combatPower?
   - Are other attributes neglected?

3. Check `outliers.combatPower`:
   - Are high combatPower robots dominating?
   - What are their win rates?

4. **Decision**:
   - If combatPower shows 70%+ win rate in Q5 while others show 50-55%, it's overpowered
   - Consider reducing the impact multiplier in combat formulas
   - Add diminishing returns at high values

---

### Workflow 2: Finding Broken Attributes

**Scenario**: Suspicion that "evasionThrusters" isn't working

**Steps**:
1. Check `attributeStats.evasionThrusters`:
   - What's the distribution? (mean, median, stdDev)
   - Are players upgrading it?

2. Check `winRateAnalysis.evasionThrusters`:
   - Do higher values correlate with better win rates?
   - Is the progression logical (Q1 < Q2 < Q3 < Q4 < Q5)?

3. Check `topPerformers.evasionThrusters`:
   - Do high-evasion robots have good win rates?
   - Are they concentrated in high leagues?

4. **Decision**:
   - If win rate is flat across quintiles (47-50%), attribute has no impact
   - Check combat formulas in `combatSimulator.ts`
   - Verify evasion calculation is actually used

---

### Workflow 3: Detecting Exploits

**Scenario**: Rapid rise in league rankings by specific players

**Steps**:
1. Check `outliers` for all attributes:
   - Are specific robots showing as outliers in multiple attributes?
   - Are the values impossible to achieve through normal play?

2. Check `topPerformers` across attributes:
   - Is the same robot appearing in top 5 for many attributes?
   - Cross-reference with upgrade costs and player currency

3. Check `statsByLeague`:
   - Are bronze league robots showing champion-level attributes?
   - League mismatch indicates promotion/demotion bug or exploit

4. **Decision**:
   - Compare robot's upgrade history with attribute values
   - If mismatch found, investigate player's transaction log
   - Consider temporary suspension pending investigation

---

### Workflow 4: Balancing League Difficulty

**Scenario**: Planning league rebalancing

**Steps**:
1. Review `statsByLeague` for all leagues:
   - Calculate average of all attributes per league
   - Plot the progression curve

2. Identify gaps:
   - Bronze → Silver: Should see 20-30% attribute increase
   - Each subsequent tier: Should maintain similar gap

3. Check `attributeStats` overall distribution:
   - Compare league averages to overall mean/median
   - Ensure distribution is balanced (not all robots in one league)

4. **Decision**:
   - If gaps too small: Tighten promotion requirements
   - If gaps too large: Add intermediate leagues
   - If distribution skewed: Adjust matchmaking algorithm

---

## Integration with Existing Debugging

This statistics endpoint complements the existing admin tools:

### Combined with Battle Debugging
```
1. Use statistics to identify overpowered robots
2. Use GET /api/admin/battles to review their battle history
3. Use GET /api/admin/battles/:id to examine specific combat events
4. Correlate attribute values with battle outcomes
```

### Combined with Matchmaking Analysis
```
1. Use statistics to understand attribute distribution
2. Check if matchmaking is pairing similar-attribute robots
3. Identify if certain attribute ranges are underserved
4. Adjust matchmaking algorithm accordingly
```

---

## Performance Considerations

**Query Performance**:
- Endpoint queries all robots (potentially hundreds)
- Performs multiple statistical calculations
- Expected response time: 1-3 seconds for 500 robots

**Recommendations**:
- Use during off-peak hours for large datasets
- Consider caching results (refresh every 5-10 minutes)
- Add pagination if robot count exceeds 1000

---

## Future Enhancements

Planned improvements:

### Phase 1 (Current)
- [x] Basic statistical measures
- [x] Outlier detection
- [x] Win rate correlation
- [x] League-based analysis

### Phase 2 (Next)
- [ ] Historical trends (attribute changes over time)
- [ ] Player-level aggregation (stable statistics)
- [ ] Attribute combination analysis (which pairs are strongest)
- [ ] Automated balance recommendations

### Phase 3 (Future)
- [ ] Real-time dashboards with charts
- [ ] Export to CSV/JSON for external analysis
- [ ] Integration with BI tools (Grafana, etc.)
- [ ] Scheduled automated reports

---

## Troubleshooting

### Issue: Empty response or no outliers

**Cause**: Insufficient robot data in system

**Solution**: 
- Requires at least 5 robots for meaningful statistics
- Outliers only appear if values exceed IQR thresholds
- Run bulk cycles to generate more battle data

### Issue: Win rate analysis empty

**Cause**: Not enough robots with ≥5 battles

**Solution**:
- Endpoint requires robots to have at least 5 battles
- Run more battle cycles
- Lower threshold if needed for testing (modify endpoint code)

### Issue: Response too slow

**Cause**: Large number of robots (>1000)

**Solution**:
- Add caching layer (Redis recommended)
- Implement pagination
- Consider pre-calculating statistics on a schedule

---

## Example Usage

### cURL Example
```bash
# Get admin token
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpass"}' \
  | jq -r '.token')

# Get robot statistics
curl http://localhost:3001/api/admin/stats/robots \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

### Postman Example
```
GET http://localhost:3001/api/admin/stats/robots
Headers:
  Authorization: Bearer <your_admin_token>
```

### Frontend Integration
```typescript
// TypeScript/React example
const fetchRobotStats = async (adminToken: string) => {
  const response = await fetch('/api/admin/stats/robots', {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  
  const data = await response.json();
  
  // Identify overpowered attributes
  const overpowered = Object.entries(data.winRateAnalysis)
    .filter(([attr, quintiles]: [string, any[]]) => {
      const q1WinRate = quintiles[0].avgWinRate;
      const q5WinRate = quintiles[4].avgWinRate;
      return (q5WinRate - q1WinRate) > 25; // >25% win rate difference
    })
    .map(([attr]) => attr);
  
  console.log('Overpowered attributes:', overpowered);
};
```

---

## FAQ

**Q: How often should I check these statistics?**  
A: After major balance changes, weekly during active development, monthly in production.

**Q: What's a "normal" standard deviation for attributes?**  
A: Depends on game age. New games: 3-5, Established games: 8-15, Mature games: 15-25.

**Q: How do I know if an attribute is broken?**  
A: Check win rate analysis - if all quintiles show similar win rates (~47-53%), attribute has minimal impact.

**Q: Should all attributes have equal impact on win rates?**  
A: No. Combat attributes (combatPower, targetingSystems) should have higher correlation than support attributes (syncProtocols, formationTactics).

**Q: What's the ideal win rate progression across quintiles?**  
A: Gradual increase (35% → 42% → 50% → 58% → 65%) is ideal. Avoid steep jumps.

---

**Status**: Active  
**Maintained By**: Development Team  
**Last Updated**: February 2, 2026
