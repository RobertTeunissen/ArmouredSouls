# Final Standardized Logging Format

## CSV Format

All cycle logs now use pipe-separated format for BOTH the CSV structure AND the message content:

```
Timestamp | Level | Message
2026-02-18T10:00:00.000Z | INFO | [Battle] League: bronze | Titan (User 2) vs Destroyer (User 3) | Winner: Titan | Rewards: ₡9,000 / ₡1,500 | Prestige: +5 | Fame: +4 | Kill: Titan
```

## Battle Logging - Standardized Format

### League Battles (1 line per battle)
```
[Battle] League: bronze | Titan (User 2) vs Destroyer (User 3) | Winner: Titan | Rewards: ₡9,000 / ₡1,500 | Prestige: +5 | Fame: +4 | Kill: Titan
[Battle] League: silver | WimpBot 1 (User 8) vs WimpBot 2 (User 9) | Winner: Draw | Rewards: ₡3,000 / ₡3,000 | Prestige: +0 | Fame: +0
```

**Fields**:
- League type (bronze/silver/gold/platinum/diamond)
- Robot names with user IDs
- Winner (or "Draw")
- Rewards (winner / loser)
- Total prestige awarded
- Total fame awarded
- Kill info (only if opponent destroyed)

### Tournament Battles (1 line per battle)
```
[Battle] Tournament: Round 1 | Titan (User 2) vs Destroyer (User 3) | Winner: Titan | Rewards: ₡15,000 / ₡3,000 | Prestige: +10 | Fame: +8 | Kill: Titan
[Battle] Tournament: Round 2 | WimpBot 14 (User 21) vs Prestige Rusher (User 121) | Winner: Prestige Rusher | Rewards: ₡4,383 / ₡1,315 | Prestige: +3 | Fame: +20 | Kill: Prestige Rusher
```

**Fields**:
- Round number
- Robot names with user IDs
- Winner
- Rewards (winner / loser)
- Total prestige awarded
- Total fame awarded
- Kill info (only if opponent destroyed)

**Removed**:
- ❌ Individual prestige logs
- ❌ Individual credits logs
- ❌ Individual fame logs
- ❌ Individual kill logs
- ❌ Irrelevant "League: bronze" info (robot's league doesn't matter in tournaments)

## Financial Transactions

All use consistent pipe format:

```
[Weapon] User 2 | Purchased: Assault Rifle | Cost: ₡45,000 | Discount: 5% (base: ₡47,368) | Balance: ₡3,000,000 → ₡2,955,000
[Facility] User 2 | Purchased: Repair Bay | Level: 1 | Cost: ₡100,000 | Balance: ₡2,955,000 → ₡2,855,000
[Robot] User 2 | Created: "Titan" | Cost: ₡500,000 | Balance: ₡2,655,000 → ₡2,155,000
[AttributeUpgrade] User 2 | Robot 118 (Titan) | Attributes: 13 | Total Cost: ₡390,000 | Balance: ₡2,155,000 → ₡1,765,000
[AttributeUpgrade]   combatPower | 1→6 | ₡30,000
[RepairService] User 2 | Repaired: 1 robot(s) | Cost: ₡15,136 | Discount: 14%
[OperatingCosts] User 2 | Total: ₡2,000 | Facilities: repair_bay(L2): ₡1,000, roster_expansion(L1): ₡500
```

## Team Operations

```
[TagTeam] User 2 | Created team | Active: 118 (Titan) | Reserve: 119 (Destroyer)
[TagTeam] User 2 | Disbanded team | Team ID: 5
```

## End-of-Cycle Balances

```
[Admin] === End of Cycle 1 Balances ===
[Balance] User 1 | Stable: Admin | Balance: ₡3,000,000
[Balance] User 2 | Stable: Player1 | Balance: ₡16,000
[Admin] ===================================
```

## Key Improvements

1. ✅ **CSV uses pipes**: `Timestamp | Level | Message` instead of commas
2. ✅ **League info in battles**: Shows which league (bronze/silver/etc)
3. ✅ **Kill tracking**: Shows which robot got the kill (if any)
4. ✅ **Consolidated tournament logs**: 1 line instead of 5-6 lines
5. ✅ **Removed irrelevant info**: No "League: bronze" in tournament battles
6. ✅ **Consistent format**: All battles use same structure
7. ✅ **User IDs everywhere**: Easy to track which user owns which robot

## Parsing Examples

### Extract all battles
```bash
cat cycle_logs/cycle1.csv | grep "\[Battle\]"
```

### Extract league battles only
```bash
cat cycle_logs/cycle1.csv | grep "\[Battle\] League:"
```

### Extract tournament battles only
```bash
cat cycle_logs/cycle1.csv | grep "\[Battle\] Tournament:"
```

### Extract battles with kills
```bash
cat cycle_logs/cycle1.csv | grep "Kill:"
```

### Extract User 2's activities
```bash
cat cycle_logs/cycle1.csv | grep "User 2"
```

### Extract bronze league battles
```bash
cat cycle_logs/cycle1.csv | grep "League: bronze"
```

## Example Full Cycle Log

```
Timestamp | Level | Message
2026-02-18T10:00:00.000Z | INFO | [Facility] User 2 | Purchased: Repair Bay | Level: 1 | Cost: ₡100,000 | Balance: ₡3,000,000 → ₡2,900,000
2026-02-18T10:00:01.000Z | INFO | [Weapon] User 2 | Purchased: Assault Rifle | Cost: ₡188,000 | Balance: ₡2,900,000 → ₡2,712,000
2026-02-18T10:00:02.000Z | INFO | [Robot] User 2 | Created: "Titan" | Cost: ₡500,000 | Balance: ₡2,712,000 → ₡2,212,000
2026-02-18T10:00:03.000Z | INFO | [AttributeUpgrade] User 2 | Robot 118 (Titan) | Attributes: 13 | Total Cost: ₡390,000 | Balance: ₡2,212,000 → ₡1,822,000
2026-02-18T10:05:00.000Z | INFO | [TagTeam] User 2 | Created team | Active: 118 (Titan) | Reserve: 119 (Destroyer)
2026-02-18T10:10:00.000Z | INFO | [Battle] League: bronze | Titan (User 2) vs Destroyer (User 3) | Winner: Titan | Rewards: ₡9,000 / ₡1,500 | Prestige: +5 | Fame: +4 | Kill: Titan
2026-02-18T10:15:00.000Z | INFO | [Battle] Tournament: Round 1 | Titan (User 2) vs WimpBot (User 8) | Winner: Titan | Rewards: ₡15,000 / ₡3,000 | Prestige: +10 | Fame: +8 | Kill: Titan
2026-02-18T10:20:00.000Z | INFO | [RepairService] User 2 | Repaired: 1 robot(s) | Cost: ₡15,136 | Discount: 14%
2026-02-18T10:25:00.000Z | INFO | [OperatingCosts] User 2 | Total: ₡2,000 | Facilities: repair_bay(L1): ₡1,000, roster_expansion(L1): ₡500
2026-02-18T10:30:00.000Z | INFO | [Balance] User 2 | Stable: Player1 | Balance: ₡16,000
```

## Files Modified

1. ✅ `prototype/backend/src/utils/cycleLogger.ts` - CSV format uses pipes
2. ✅ `prototype/backend/src/services/battleOrchestrator.ts` - Added league type and kill info
3. ✅ `prototype/backend/src/services/tournamentBattleOrchestrator.ts` - Consolidated to 1 line, removed irrelevant info

All logging is now consistent, concise, and easy to parse!
