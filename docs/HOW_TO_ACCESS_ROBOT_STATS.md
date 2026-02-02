# How to Access Robot Statistics in Admin Portal

## Quick Access Guide

The robot statistics feature is now accessible from the Admin Portal UI!

### Steps to Access:

1. **Start the Backend Server**
   ```bash
   cd prototype/backend
   npm run dev
   ```
   Backend will run on http://localhost:3001

2. **Start the Frontend Server**
   ```bash
   cd prototype/frontend
   npm run dev
   ```
   Frontend will run on http://localhost:5173

3. **Login as Admin**
   - Navigate to http://localhost:5173
   - Login with admin credentials:
     - Username: `admin`
     - Password: `adminpass`

4. **Access Admin Portal**
   - Click on "Admin" in the navigation menu
   - Or directly go to http://localhost:5173/admin

5. **Load Robot Statistics**
   - Scroll down to the "🤖 Robot Attribute Statistics" section
   - Click the "Load Statistics" button
   - Wait 1-3 seconds for statistics to load

## What You'll See

### Summary Dashboard
Shows overall statistics:
- Total Robots
- Robots with Battles
- Total Battles
- Overall Win Rate
- Average ELO

### Attribute Selector
Dropdown menu with all 23 robot attributes organized by category:
- **Combat Systems** (6 attributes)
- **Defensive Systems** (5 attributes)
- **Chassis & Mobility** (5 attributes)
- **AI Processing** (4 attributes)
- **Team Coordination** (3 attributes)

### For Each Selected Attribute:

1. **Statistical Analysis**
   - Mean, Median, Standard Deviation
   - Min, Max values
   - Q1, Q3 (quartiles)
   - IQR (Interquartile Range)
   - Lower/Upper Outlier Bounds

2. **Outlier Detection** (if any found)
   - Table showing robots with extreme values
   - Includes robot name, value, league, ELO, win rate
   - Color-coded in yellow for easy identification

3. **Win Rate Correlation**
   - 5 quintiles showing progression
   - Average attribute value per quintile
   - Average win rate per quintile
   - Visual progress bars
   - Sample size for each quintile

4. **League Comparison**
   - Attribute statistics for each league tier
   - Shows progression from Bronze → Champion
   - Displays robot count and average ELO per league

5. **Top 5 Performers**
   - Robots with highest values for selected attribute
   - Shows name, league, ELO, win rate
   - Color-coded in green

6. **Bottom 5 Performers**
   - Robots with lowest values for selected attribute
   - Shows name, league, ELO, win rate
   - Color-coded in red

## Use Cases

### Finding Overpowered Attributes
1. Select an attribute (e.g., "Combat Power")
2. Look at Win Rate Correlation section
3. If top quintile has >25% higher win rate than bottom quintile, attribute may be overpowered

### Detecting Exploits
1. Load statistics
2. Look at Outliers section across multiple attributes
3. If same robot appears as outlier in many attributes, investigate further

### Verifying League Balance
1. Select any attribute
2. Check League Comparison section
3. Each league should show clear progression (20-30% increase)
4. If adjacent leagues are too similar, rebalancing may be needed

### Debugging Robot Builds
1. Select specific attribute
2. View Top Performers to see successful builds
3. Compare with Bottom Performers
4. Identify patterns in successful configurations

## Refresh Statistics

Click the "Refresh Stats" button at any time to reload the latest data after:
- Running battle cycles
- Making balance changes
- Promoting/demoting robots
- After significant gameplay

## No Data Available?

If you see "No robots found" or empty statistics:
1. Make sure you have robots in the database
2. Run some battle cycles: POST /api/admin/cycles/bulk
3. Ensure robots have battle history (≥5 battles for win rate analysis)

## Location in UI

The Robot Statistics section is located in the Admin Portal page:
- Below the "Bulk Cycle Testing" section
- Above the "Battle Logs & Debugging" section
- Clearly marked with 🤖 emoji

## Screenshot Locations

When testing is complete, screenshots will show:
1. Initial state with "Load Statistics" button
2. Summary dashboard after loading
3. Attribute selection dropdown
4. Statistical analysis display
5. Outlier detection table
6. Win rate correlation with visual bars
7. League comparison table
8. Top/bottom performers lists

## API Endpoint

Behind the scenes, this UI calls:
```
GET /api/admin/stats/robots
Authorization: Bearer <admin-jwt-token>
```

The endpoint returns comprehensive JSON data that the UI transforms into the visual displays described above.

## Troubleshooting

**"Failed to fetch robot statistics"**
- Check that backend is running on port 3001
- Verify you're logged in as admin
- Check browser console for detailed error messages

**Stats take a long time to load**
- Normal for 500+ robots (1-3 seconds)
- For 1000+ robots, consider adding caching

**No outliers detected**
- This is normal if all robots have similar attribute values
- Run more battle cycles to generate variety
- Outliers only appear when values exceed IQR thresholds

---

**Status:** Ready to use!  
**Last Updated:** February 2, 2026
