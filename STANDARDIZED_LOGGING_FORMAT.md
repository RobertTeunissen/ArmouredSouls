# Standardized Logging Format

## Overview

All logging now uses a consistent pipe-separated format for easy parsing and processing.

## Format Standard

```
[Category] Type | Field1: Value1 | Field2: Value2 | Field3: Value3
```

## Log Categories

### 1. Financial Transactions

#### Weapon Purchases
```
[Weapon] User 2 | Purchased: Assault Rifle | Cost: ₡45,000 | Discount: 5% (base: ₡47,368) | Balance: ₡3,000,000 → ₡2,955,000
```

#### Facility Purchases/Upgrades
```
[Facility] User 2 | Purchased: Repair Bay | Level: 1 | Cost: ₡100,000 | Balance: ₡2,955,000 → ₡2,855,000
[Facility] User 2 | Upgraded: Repair Bay | Level: 2 | Cost: ₡200,000 | Balance: ₡2,855,000 → ₡2,655,000
```

#### Robot Purchases
```
[Robot] User 2 | Created: "Titan" | Cost: ₡500,000 | Balance: ₡2,655,000 → ₡2,155,000
```

#### Attribute Upgrades
```
[AttributeUpgrade] User 2 | Robot 118 (Titan) | Attributes: 13 | Total Cost: ₡390,000 | Balance: ₡2,155,000 → ₡1,765,000
[AttributeUpgrade]   combatPower | 1→6 | ₡30,000
[AttributeUpgrade]   targetingSystems | 1→6 | ₡30,000
...
```

#### Repair Costs
```
[RepairService] User 2 | Repaired: 1 robot(s) | Cost: ₡15,136 | Discount: 14%
```

#### Operating Costs
```
[OperatingCosts] User 2 | Total: ₡2,000 | Facilities: repair_bay(L2): ₡1,000, roster_expansion(L1): ₡500
```

---

### 2. Battle Results

#### League Battles
```
[Battle] League | Titan (User 2) vs Destroyer (User 3) | Winner: Titan | Rewards: ₡9,000 / ₡1,500 | Prestige: +5 | Fame: +4
```

#### Tournament Battles
```
[Battle] Tournament | Titan vs Destroyer | Winner: Titan | Round: 2 | Rewards: ₡15,000 / ₡3,000
[Tournament] Prestige | User 2 | +10 | Round 2 | League: bronze
[Tournament] Credits | User 2 | +₡15,000 | Winner
[Tournament] Fame | Titan | +8 | HP: 85% | Round: 2
[Tournament] Kill | Titan | Destroyed opponent | Total kills: 3
```

---

### 3. Team Operations

#### Tag Team Creation
```
[TagTeam] User 2 | Created team | Active: 118 (Titan) | Reserve: 119 (Destroyer)
```

#### Tag Team Disbanding
```
[TagTeam] User 2 | Disbanded team | Team ID: 5
```

---

### 4. End-of-Cycle Summary

#### User Balances
```
[Admin] === End of Cycle 1 Balances ===
[Balance] User 1 | Stable: Admin | Balance: ₡3,000,000
[Balance] User 2 | Stable: Player1 | Balance: ₡16,000
[Balance] User 3 | Stable: Player2 | Balance: ₡2,500,000
[Admin] ===================================
```

---

## Parsing Examples

### Extract All Purchases
```bash
cat cycle_logs/cycle1.csv | grep -E "\[Weapon\]|\[Facility\]|\[Robot\]|\[AttributeUpgrade\]"
```

### Extract All Battles
```bash
cat cycle_logs/cycle1.csv | grep "\[Battle\]"
```

### Extract User 2's Transactions
```bash
cat cycle_logs/cycle1.csv | grep "User 2"
```

### Extract Balance Changes
```bash
cat cycle_logs/cycle1.csv | grep "Balance:"
```

### Extract Repair Costs
```bash
cat cycle_logs/cycle1.csv | grep "\[RepairService\]"
```

---

## Benefits

1. **Consistent Format**: All logs use pipes (|) as separators
2. **Easy Parsing**: Can split on pipes to extract specific fields
3. **Grep-Friendly**: Easy to filter by category, user, or action
4. **CSV Compatible**: Works well with CSV format
5. **Human Readable**: Still easy to read in terminal or text editor

---

## Processing in Excel/Google Sheets

1. Open the CSV file
2. Select the "Message" column
3. Use "Text to Columns" feature
4. Choose "Delimited" and select "Pipe" (|) as delimiter
5. Each field becomes its own column for easy filtering and analysis

---

## Example Cycle Log Output

```csv
Timestamp,Level,Message
2026-02-18T10:00:00.000Z,INFO,[Facility] User 2 | Purchased: Repair Bay | Level: 1 | Cost: ₡100,000 | Balance: ₡3,000,000 → ₡2,900,000
2026-02-18T10:00:01.000Z,INFO,[Weapon] User 2 | Purchased: Assault Rifle | Cost: ₡188,000 | Balance: ₡2,900,000 → ₡2,712,000
2026-02-18T10:00:02.000Z,INFO,[Robot] User 2 | Created: "Titan" | Cost: ₡500,000 | Balance: ₡2,712,000 → ₡2,212,000
2026-02-18T10:00:03.000Z,INFO,[AttributeUpgrade] User 2 | Robot 118 (Titan) | Attributes: 13 | Total Cost: ₡390,000 | Balance: ₡2,212,000 → ₡1,822,000
2026-02-18T10:00:03.100Z,INFO,[AttributeUpgrade]   combatPower | 1→6 | ₡30,000
2026-02-18T10:00:03.200Z,INFO,[AttributeUpgrade]   targetingSystems | 1→6 | ₡30,000
2026-02-18T10:05:00.000Z,INFO,[TagTeam] User 2 | Created team | Active: 118 (Titan) | Reserve: 119 (Destroyer)
2026-02-18T10:10:00.000Z,INFO,[Battle] League | Titan (User 2) vs Destroyer (User 3) | Winner: Titan | Rewards: ₡9,000 / ₡1,500 | Prestige: +5 | Fame: +4
2026-02-18T10:15:00.000Z,INFO,[RepairService] User 2 | Repaired: 1 robot(s) | Cost: ₡15,136 | Discount: 14%
2026-02-18T10:20:00.000Z,INFO,[OperatingCosts] User 2 | Total: ₡2,000 | Facilities: repair_bay(L1): ₡1,000, roster_expansion(L1): ₡500
2026-02-18T10:25:00.000Z,INFO,[Balance] User 2 | Stable: Player1 | Balance: ₡16,000
```

---

## Files Modified

1. ✅ `prototype/backend/src/routes/weaponInventory.ts`
2. ✅ `prototype/backend/src/routes/facility.ts`
3. ✅ `prototype/backend/src/routes/robots.ts`
4. ✅ `prototype/backend/src/routes/tagTeams.ts`
5. ✅ `prototype/backend/src/routes/admin.ts`
6. ✅ `prototype/backend/src/services/repairService.ts`
7. ✅ `prototype/backend/src/services/battleOrchestrator.ts`
8. ✅ `prototype/backend/src/services/tournamentBattleOrchestrator.ts`

All logging now uses consistent pipe-separated format for easy parsing and analysis!
