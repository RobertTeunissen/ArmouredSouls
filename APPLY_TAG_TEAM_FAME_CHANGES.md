# How to Apply Tag Team Fame Changes

## Overview
These changes implement damage-based fame awards for tag team matches and add per-robot stat tracking to battle records.

## Steps to Apply

### 1. Run Database Migration
The new migration adds per-robot damage and fame tracking fields to the battles table:

```bash
cd prototype/backend
npx prisma migrate deploy
```

Or for development:
```bash
npx prisma migrate dev
```

### 2. Regenerate Prisma Client
After the migration, regenerate the Prisma client to include the new fields:

```bash
npx prisma generate
```

### 3. Restart Backend Server
Restart your backend server to load the updated code:

```bash
npm run dev
```

## What Changed

### Database Schema
New fields added to `battles` table:
- `team1_active_damage_dealt`
- `team1_reserve_damage_dealt`
- `team2_active_damage_dealt`
- `team2_reserve_damage_dealt`
- `team1_active_fame_awarded`
- `team1_reserve_fame_awarded`
- `team2_active_fame_awarded`
- `team2_reserve_fame_awarded`

### Backend Code
1. **tagTeamBattleOrchestrator.ts**: 
   - Tracks damage and survival time per robot across all battle phases
   - Calculates contribution-based fame (damage × survival time multipliers)
   - Only awards fame to winning team robots
   - Saves per-robot stats to battle record

2. **matches.ts API**:
   - Battle log endpoint now returns per-robot damage and fame in tag team battles
   - Each robot object includes `damageDealt` and `fameAwarded` fields

### Frontend Impact
The battle log API now provides clean, separated data structures for different battle types:

**Tag Team Battle Response:**
```json
{
  "battleType": "tag_team",
  "tagTeam": {
    "team1": {
      "teamId": 1,
      "stableName": "Stable A",
      "activeRobot": {
        "id": 1,
        "name": "Robot A",
        "owner": "Player1",
        "damageDealt": 150,
        "fameAwarded": 15
      },
      "reserveRobot": {
        "id": 2,
        "name": "Robot B",
        "owner": "Player1",
        "damageDealt": 0,
        "fameAwarded": 10
      },
      "tagOutTime": 45.2
    },
    "team2": { ... }
  },
  "team1Summary": {
    "reward": 5000,
    "prestige": 32,
    "totalDamage": 150,
    "totalFame": 25
  },
  "team2Summary": {
    "reward": 1000,
    "prestige": 0,
    "totalDamage": 80,
    "totalFame": 0
  },
  "winner": "robot1"
}
```

**1v1 Battle Response:**
```json
{
  "battleType": "1v1",
  "robot1": {
    "id": 1,
    "name": "Robot A",
    "owner": "Player1",
    "damageDealt": 150,
    "fame": 15,
    "reward": 1000,
    "prestige": 5,
    "eloBefore": 1200,
    "eloAfter": 1215
  },
  "robot2": { ... },
  "winner": "robot1"
}
```

Key differences:
- Tag team: Per-robot stats in `tagTeam`, team aggregates in `teamXSummary`
- 1v1: All stats in `robot1`/`robot2`
- No confusing overlap between individual and team stats

## Testing

After applying changes, test:

1. **Execute a tag team battle** and verify:
   - Fame is awarded to winning team robots only
   - Losers get 0 fame
   - Console logs show per-robot fame awards

2. **Check battle log API** (`/api/matches/battles/:id/log`):
   - Verify per-robot damage and fame are displayed
   - Check that reserves who didn't fight show 0 damage but base fame (if winners)

3. **Verify database**:
   ```sql
   SELECT 
     id, 
     battle_type,
     team1_active_damage_dealt,
     team1_reserve_damage_dealt,
     team1_active_fame_awarded,
     team1_reserve_fame_awarded
   FROM battles 
   WHERE battle_type = 'tag_team' 
   ORDER BY id DESC 
   LIMIT 5;
   ```

## Rollback (if needed)

If you need to rollback:

```bash
cd prototype/backend
npx prisma migrate resolve --rolled-back 20260214120000_add_per_robot_tag_team_stats
```

Then manually remove the columns:
```sql
ALTER TABLE battles DROP COLUMN team1_active_damage_dealt;
ALTER TABLE battles DROP COLUMN team1_reserve_damage_dealt;
ALTER TABLE battles DROP COLUMN team2_active_damage_dealt;
ALTER TABLE battles DROP COLUMN team2_reserve_damage_dealt;
ALTER TABLE battles DROP COLUMN team1_active_fame_awarded;
ALTER TABLE battles DROP COLUMN team1_reserve_fame_awarded;
ALTER TABLE battles DROP COLUMN team2_active_fame_awarded;
ALTER TABLE battles DROP COLUMN team2_reserve_fame_awarded;
```
