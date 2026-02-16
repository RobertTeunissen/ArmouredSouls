# Robot Metrics API

## Overview

The Robot Metrics API provides a generalized endpoint for tracking any robot performance metric over time. This allows for flexible analytics and visualizations of robot performance across multiple dimensions.

## Endpoint

```
GET /api/analytics/robot/:robotId/metric/:metricName
```

## Supported Metrics

### Point-in-Time Metrics

These metrics represent a value at a specific point in time:

- **elo**: ELO rating progression
  - Tracks the robot's skill rating over time
  - Non-cumulative (each data point is the current ELO)

### Cumulative Metrics

These metrics accumulate over time:

- **fame**: Total fame earned
  - Cumulative fame points awarded from battles
  
- **damageDealt**: Total damage dealt to opponents
  - Cumulative damage inflicted on enemy robots
  
- **damageReceived**: Total damage received from opponents
  - Cumulative damage taken from enemy robots
  
- **wins**: Total wins
  - Count of battles won
  
- **losses**: Total losses
  - Count of battles lost
  
- **draws**: Total draws
  - Count of battles that ended in a draw
  
- **kills**: Total kills
  - Count of opponent robots destroyed (finalHP = 0)
  - Useful for tracking combat effectiveness
  
- **creditsEarned**: Total credits earned
  - Cumulative credits from battle rewards (winner + loser rewards)

## Query Parameters

- **cycleRange** (required): Cycle range as `[startCycle,endCycle]`
  - Example: `cycleRange=[1,10]`
  
- **includeMovingAverage** (optional): Whether to include 3-period moving averages
  - Default: `false`
  - Example: `includeMovingAverage=true`
  
- **includeTrendLine** (optional): Whether to include linear regression trend line
  - Default: `false`
  - Example: `includeTrendLine=true`

## Response Format

```json
{
  "robotId": 123,
  "metric": "kills",
  "cycleRange": [1, 10],
  "dataPoints": [
    {
      "cycleNumber": 1,
      "value": 5,
      "change": 5
    },
    {
      "cycleNumber": 2,
      "value": 12,
      "change": 7
    }
  ],
  "startValue": 0,
  "endValue": 12,
  "totalChange": 12,
  "averageChange": 6.0,
  "movingAverage": [5, 12, ...],
  "trendLine": {
    "slope": 3.5,
    "intercept": 1.5,
    "points": [
      { "cycleNumber": 1, "value": 5.0 },
      { "cycleNumber": 2, "value": 8.5 }
    ]
  }
}
```

## Example Requests

### Get ELO progression
```bash
GET /api/analytics/robot/123/metric/elo?cycleRange=[1,10]
```

### Get kills with moving average
```bash
GET /api/analytics/robot/123/metric/kills?cycleRange=[1,10]&includeMovingAverage=true
```

### Get damage dealt with trend line
```bash
GET /api/analytics/robot/123/metric/damageDealt?cycleRange=[1,10]&includeTrendLine=true
```

### Get wins with both moving average and trend line
```bash
GET /api/analytics/robot/123/metric/wins?cycleRange=[1,10]&includeMovingAverage=true&includeTrendLine=true
```

## Use Cases

### Combat Effectiveness
- Track **kills** to see how often a robot destroys opponents
- Compare **damageDealt** vs **damageReceived** to assess combat efficiency
- Monitor **wins** and **losses** for overall performance

### Skill Progression
- Track **elo** to see skill rating changes over time
- Use trend lines to identify improving or declining performance

### Economic Analysis
- Track **creditsEarned** to see income generation
- Compare with repair costs to calculate net profitability

### Fame and Prestige
- Track **fame** accumulation for prestige calculations
- Identify high-fame-earning robots for merchandising opportunities

## Error Responses

### 400 Bad Request
- Invalid robotId
- Invalid metric name
- Missing or invalid cycleRange
- Invalid cycle numbers (negative or startCycle > endCycle)

### 404 Not Found
- Robot does not exist

### 500 Internal Server Error
- Database or service errors

## Implementation Notes

- **ELO** is a point-in-time metric (tracks current value)
- All other metrics are **cumulative** (track total accumulated value)
- **Moving averages** use a 3-period simple moving average
- **Trend lines** use linear regression (least squares method)
- **Kills** are determined by opponent's finalHP = 0
- Data points are only created for cycles where the robot participated in battles
