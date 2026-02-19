# Product Requirements Document: Economy System

**Last Updated**: February 3, 2026  
**Status**: ✅ IMPLEMENTED (Backend + Frontend + Daily Financial System)  
**Owner**: Robert Teunissen  
**Epic**: Economy System Implementation

---

## Table of Contents

1. [Implementation Status](#implementation-status)
2. [Executive Summary](#executive-summary)
3. [Background & Context](#background--context)
4. [Economy Overview](#economy-overview)
5. [Cost Centers (What Costs Money)](#cost-centers-what-costs-money)
6. [Revenue Streams (How Stables Earn Money)](#revenue-streams-how-stables-earn-money)
7. [Prestige & Fame System](#prestige--fame-system)
8. [Daily Financial System](#daily-financial-system)
9. [Economic Balance & Progression](#economic-balance--progression)
10. [Implementation Recommendations](#implementation-recommendations)
11. [Success Metrics](#success-metrics)
12. [Appendices](#appendices)

---

## Implementation Status

### ✅ Phase 1: Backend Implementation (COMPLETE)
**Implementation Date**: February 3, 2026

**Core Components:**
- ✅ Economic calculation utilities (`economyCalculations.ts`)
- ✅ Financial API endpoints (`/api/finances/*`)
- ✅ Battle reward system integration
- ✅ Repair cost enhancements
- ✅ Comprehensive unit tests (27 tests passing)
- ✅ **NEW**: Daily financial processing system
- ✅ **NEW**: Reward calculation details in battle logs

**API Endpoints:**
- ✅ `GET /api/finances/summary` - Quick dashboard overview
- ✅ `GET /api/finances/daily` - Comprehensive financial report
- ✅ `GET /api/finances/operating-costs` - Detailed cost breakdown
- ✅ `GET /api/finances/revenue-streams` - Income sources
- ✅ `GET /api/finances/projections` - Forecasts & recommendations
- ✅ **NEW**: `POST /api/admin/daily-finances/process` - Process daily operating costs for all users

**Battle Rewards:**
- ✅ League-based rewards: Bronze (₡5-10K) → Champion (₡150-300K)
- ✅ Prestige multipliers: 5%-20% bonus on winnings
- ✅ Participation rewards: 30% of league base for all combatants
- ✅ **NEW**: Detailed reward breakdown shown in battle logs:
  - League base reward with min/max range
  - Prestige bonus percentage and amount
  - Participation reward amount
  - Winner and loser rewards separately

**Facility Discounts:**
- ✅ Medical Bay: Reduces critical damage multiplier (HP=0) by 10%-100%
- ✅ Repair Bay: Multi-robot discount formula (Level × (5 + Active Robots), capped at 90%)

**Daily Financial System:**
- ✅ Automatic operating cost deduction
- ✅ Bankruptcy detection
- ✅ Per-user financial summaries
- ✅ Integrated into bulk cycle controls

### Implementation Files

**Backend (5 files + 2 enhancements):**
1. `prototype/backend/src/utils/economyCalculations.ts` (620+ lines)
   - All economic formulas and calculations
   - Facility operating costs
   - Revenue streams (battle rewards, passive income)
   - Repair cost formulas
   - Financial health indicators
   - Daily financial processing functions:
     - `processDailyFinances(userId)` - Process single user
     - `processAllDailyFinances()` - Batch process all users
     - Deducts operating costs, detects bankruptcy

2. `prototype/backend/src/routes/finances.ts` (165 lines)
   - `GET /api/finances/summary` - Quick overview
   - `GET /api/finances/daily` - Full report
   - `GET /api/finances/operating-costs` - Cost breakdown
   - `GET /api/finances/revenue-streams` - Income sources
   - `GET /api/finances/projections` - Forecasts

3. `prototype/backend/src/services/battleOrchestrator.ts` (enhanced)
   - League-based battle rewards
   - Prestige multipliers (5%-20%)
   - Participation rewards (30% of base)
   - Detailed reward breakdown in battle logs:
     - Shows league base with min/max range
     - Displays prestige bonus percentage and amount
     - Breaks down winner/loser rewards separately

4. `prototype/backend/src/routes/admin.ts` (enhanced)
   - `POST /api/admin/daily-finances/process` endpoint
   - Integrated financial processing into bulk cycles
   - Shows costs deducted, users processed, bankruptcies

5. `prototype/backend/src/utils/robotCalculations.ts` (modified)
   - Medical Bay support for repair costs

6. `prototype/backend/tests/economyCalculations.test.ts` (215 lines, 27 tests ✅)

**Frontend (4 files + 1 enhanced):**
1. `prototype/frontend/src/utils/financialApi.ts` (200 lines)
   - TypeScript interfaces
   - API client functions
   - Helper functions (formatting, colors)

2. `prototype/frontend/src/components/FinancialSummary.tsx` (140 lines)
   - Dashboard widget
   - Shows: balance, daily net, prestige bonus
   - Financial warnings

3. `prototype/frontend/src/pages/FinancialReportPage.tsx` (280 lines)
   - Full financial report page
   - Revenue/expense breakdown
   - Operating costs by facility
   - Projections and recommendations

4. `prototype/frontend/src/pages/AdminPage.tsx` (enhanced)
   - Displays financial data in bulk cycle results
   - Shows costs deducted per cycle
   - Bankruptcy alerts highlighted in red

5. `prototype/frontend/src/App.tsx` (modified)
   - Added `/finances` route

### Key Features

**1. Financial Reward Details in Battle Logs**
Battle logs now include comprehensive reward breakdowns showing exactly how rewards are calculated:

**Example Battle Log:**
```
💰 Financial Rewards Summary
   Winner (RobotName): ₡12,750
      • League Base (gold): ₡30,000 (range: ₡20,000-₡40,000)
      • Prestige Bonus (10%): +₡3,000
      • Participation: ₡6,000
   Loser (OpponentName): ₡6,000
      • Participation: ₡6,000
```

**Features:**
- Shows league base reward with min/max range
- Displays prestige multiplier percentage and bonus amount
- Breaks down participation vs win rewards
- Separate display for winner and loser
- Special handling for draws

**2. Daily Financial System**
Automated daily financial processing that:
- Deducts operating costs from all user balances
- Tracks repair costs (for reference)
- Detects bankruptcy scenarios
- Provides detailed financial summaries

**New Functions:**
- `processDailyFinances(userId)` - Process one user
- `processAllDailyFinances()` - Process all users

**New Endpoint:**
- `POST /api/admin/daily-finances/process` - Trigger daily processing

**Integration:**
Integrated into bulk cycle flow for testing:
1. Repair robots (optional)
2. Run matchmaking
3. Execute battles
4. **Process daily finances** ← NEW
5. Rebalance leagues

**Example Cycle Output:**
```
Cycle 3:
- Repaired: 15 robots
- Matches: 42 created
- Battles: 42/42 successful
- Finances: ₡145,000 deducted
  • 10 users processed
  • ⚠️ 2 bankruptcies!
- Rebalancing: 5 promoted, 3 demoted
```

### ✅ Phase 2: Frontend Implementation (COMPLETE)
**Implementation Date**: February 3-4, 2026

**Components:**
- ✅ `src/utils/financialApi.ts` - API client with TypeScript interfaces
- ✅ `src/components/FinancialSummary.tsx` - Dashboard widget
- ✅ `src/pages/FinancialReportPage.tsx` - Full financial report page
- ✅ **NEW (Feb 4)**: Battle rewards display in admin battle details modal

**Features:**
- ✅ Financial summary widget on dashboard showing:
  - Current balance
  - Daily passive net income (income - operating costs)
  - Prestige and battle bonus percentage
  - Financial warnings (low balance, negative cash flow)
  - Link to full report
- ✅ Comprehensive financial report page with:
  - Financial health status (Excellent/Good/Stable/Warning/Critical)
  - Revenue breakdown (battle winnings, merchandising, streaming)
  - Expense breakdown (operating costs, repairs)
  - Net income and profit margin
  - Operating costs by facility
  - Weekly/monthly projections
  - AI-powered recommendations
- ✅ Real-time data from backend APIs
- ✅ Currency formatting with ₡ symbol
- ✅ Color-coded financial indicators
- ✅ **NEW (Feb 4)**: Admin controls for daily finances
  - Manual "Process Daily Finances" button
  - Shows users processed, costs deducted, bankruptcies
  - Checkbox to include/exclude in bulk cycles
- ✅ **NEW (Feb 4)**: Battle rewards display
  - Credits, prestige, and fame shown for each robot
  - Winner highlighted with green border
  - Loser shows credits only (no prestige/fame for losing)

### API Usage Examples

This section provides curl command examples and expected responses for the economy system's key API endpoints.

#### Process Daily Finances

Trigger daily financial processing for all users (admin endpoint).

**Request:**
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/admin/daily-finances/process
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "usersProcessed": 10,
    "totalCostsDeducted": 145000,
    "bankruptUsers": 2,
    "summaries": [
      {
        "userId": 1,
        "username": "player1",
        "startingBalance": 500000,
        "operatingCosts": {
          "total": 15000,
          "breakdown": [
            {
              "facilityType": "INCOME_GENERATOR",
              "level": 5,
              "cost": 5000
            },
            {
              "facilityType": "REPAIR_BAY",
              "level": 3,
              "cost": 3000
            }
          ]
        },
        "totalCosts": 15000,
        "endingBalance": 485000,
        "balanceChange": -15000,
        "isBankrupt": false,
        "canAffordCosts": true
      }
    ]
  }
}
```

**Description:**
- Processes daily operating costs for all users
- Deducts facility costs from user balances
- Detects bankruptcy scenarios (balance ≤ 0)
- Returns detailed per-user financial summaries
- Integrated into bulk cycle flow for testing

#### Get Financial Summary

Retrieve quick financial overview for dashboard display.

**Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/finances/summary
```

**Response:**
```json
{
  "currentBalance": 1904000,
  "prestige": 12000,
  "dailyOperatingCosts": 29000,
  "dailyPassiveIncome": 57000,
  "netPassiveIncome": 28000,
  "prestigeMultiplier": 1.10
}
```

**Description:**
- Provides quick snapshot of financial status
- Shows current balance and prestige level
- Calculates daily operating costs from all facilities
- Calculates daily passive income (merchandising + streaming)
- Computes net passive income (income - costs)
- Returns prestige multiplier for battle rewards

#### Get Daily Financial Report

Retrieve comprehensive financial report with all details.

**Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/finances/daily?battleWinnings=45000
```

**Query Parameters:**
- `battleWinnings` (optional): Battle earnings from last 7 days for accurate projections

**Response:**
```json
{
  "currentBalance": 1904000,
  "prestige": 12000,
  "prestigeMultiplier": 1.10,
  "revenueStreams": {
    "battleWinnings": 45000,
    "merchandising": {
      "daily": 32000,
      "weekly": 224000,
      "monthly": 960000
    },
    "streaming": {
      "daily": 25000,
      "weekly": 175000,
      "monthly": 750000
    },
    "totalDaily": 102000,
    "totalWeekly": 714000,
    "totalMonthly": 3060000
  },
  "operatingCosts": {
    "total": 29000,
    "breakdown": [
      {
        "facilityType": "INCOME_GENERATOR",
        "level": 5,
        "cost": 5000
      },
      {
        "facilityType": "REPAIR_BAY",
        "level": 3,
        "cost": 3000
      }
    ]
  },
  "netIncome": {
    "daily": 73000,
    "weekly": 511000,
    "monthly": 2190000
  },
  "financialHealth": {
    "status": "Excellent",
    "profitMargin": 71.6,
    "daysUntilBankruptcy": null
  },
  "projections": {
    "weekly": 511000,
    "monthly": 2190000,
    "balanceIn30Days": 4094000
  },
  "recommendations": [
    "Your stable is highly profitable. Consider upgrading facilities.",
    "Strong passive income streams. Merchandising and streaming are performing well."
  ]
}
```

**Description:**
- Complete financial report with all revenue and expense details
- Revenue streams broken down by source (battles, merchandising, streaming)
- Operating costs with per-facility breakdown
- Net income calculations (daily, weekly, monthly)
- Financial health status with profit margin
- Bankruptcy projection (days until funds depleted, if applicable)
- AI-powered recommendations based on financial status

#### Get Operating Costs Breakdown

Retrieve detailed breakdown of all operating costs.

**Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/finances/operating-costs
```

**Response:**
```json
{
  "total": 29000,
  "breakdown": [
    {
      "facilityType": "INCOME_GENERATOR",
      "level": 5,
      "cost": 5000,
      "description": "Generates passive income from merchandising and streaming"
    },
    {
      "facilityType": "REPAIR_BAY",
      "level": 3,
      "cost": 3000,
      "description": "Reduces repair costs by 15%"
    },
    {
      "facilityType": "TRAINING_FACILITY",
      "level": 4,
      "cost": 4000,
      "description": "Enables robot attribute training"
    }
  ]
}
```

**Description:**
- Lists all facilities with their operating costs
- Shows facility type, level, and daily cost
- Includes facility descriptions
- Total daily operating cost sum

#### Get Revenue Streams

Retrieve detailed breakdown of all revenue sources.

**Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/finances/revenue-streams
```

**Response:**
```json
{
  "merchandising": {
    "daily": 32000,
    "weekly": 224000,
    "monthly": 960000,
    "formula": "base_rate × (1 + prestige/10000)",
    "prestigeBonus": 1.20
  },
  "streaming": {
    "daily": 25000,
    "weekly": 175000,
    "monthly": 750000,
    "formula": "base_rate × (1 + battles/1000) × (1 + fame/5000)",
    "battlesBonus": 1.15,
    "fameBonus": 1.08
  },
  "totalPassiveDaily": 57000,
  "totalPassiveWeekly": 399000,
  "totalPassiveMonthly": 1710000
}
```

**Description:**
- Detailed breakdown of passive income sources
- Shows daily, weekly, and monthly projections
- Includes formulas used for calculations
- Shows bonus multipliers from prestige, battles, and fame
- Total passive income across all sources

#### Get Financial Projections

Retrieve financial forecasts and recommendations.

**Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/finances/projections
```

**Response:**
```json
{
  "weekly": {
    "revenue": 714000,
    "costs": 203000,
    "netIncome": 511000
  },
  "monthly": {
    "revenue": 3060000,
    "costs": 870000,
    "netIncome": 2190000
  },
  "balanceProjections": {
    "in7Days": 2415000,
    "in30Days": 4094000,
    "in90Days": 10474000
  },
  "recommendations": [
    "Your stable is highly profitable. Consider upgrading facilities.",
    "Strong passive income streams. Merchandising and streaming are performing well.",
    "You can afford to expand your roster or upgrade weapons."
  ]
}
```

**Description:**
- Financial projections for 7, 30, and 90 days
- Revenue, costs, and net income forecasts
- Projected balance at future dates
- AI-powered recommendations based on financial trajectory
- Helps with strategic planning and investment decisions

### ❌ Phase 3: Advanced Features (NOT STARTED)
- ❌ Historical financial tracking
- ❌ Economic alerts and notifications
- ❌ Tutorial/onboarding system
- ❌ Budget planning tools

### Implementation History

This section tracks the chronological evolution of the economy system implementation.

#### Phase 1: Backend Implementation (February 3, 2026)

**Core Components Implemented:**
- Economic calculation utilities (`economyCalculations.ts`)
- Financial API endpoints (`/api/finances/*`)
- Battle reward system with league-based rewards
- Repair cost system with Medical Bay support
- Comprehensive unit tests (27 tests passing)
- Daily financial processing system
- Reward calculation details in battle logs

**Files Created/Modified:**
- `prototype/backend/src/utils/economyCalculations.ts` (620+ lines)
- `prototype/backend/src/routes/finances.ts` (165 lines)
- `prototype/backend/src/services/battleOrchestrator.ts` (enhanced)
- `prototype/backend/src/routes/admin.ts` (enhanced)
- `prototype/backend/tests/economyCalculations.test.ts` (215 lines, 27 tests)

#### Phase 2: Frontend Implementation (February 4, 2026)

**Core Components Implemented:**
- Financial API utilities (`financialApi.ts`)
- FinancialSummary dashboard widget
- FinancialReportPage for comprehensive reporting
- Battle rewards display in admin modal
- Daily finances manual control button
- Bulk cycle checkbox for daily finances integration

**Files Created/Modified:**
- `prototype/frontend/src/utils/financialApi.ts` (200 lines)
- `prototype/frontend/src/components/FinancialSummary.tsx` (140 lines)
- `prototype/frontend/src/pages/FinancialReportPage.tsx` (280 lines)
- `prototype/frontend/src/pages/AdminPage.tsx` (enhanced)
- `prototype/frontend/src/App.tsx` (modified)

#### Key Milestones

- ✅ Complete backend economy calculation system
- ✅ Full financial reporting API
- ✅ Frontend dashboard integration
- ✅ Daily financial processing automation
- ✅ Battle reward system with prestige multipliers
- ✅ Comprehensive testing coverage

#### Future Enhancements

- Historical financial tracking
- Economic alerts and notifications
- Tutorial/onboarding system
- Budget planning tools

---

## Executive Summary

This PRD defines the complete economy system for Armoured Souls, covering all cost centers (what costs money), revenue streams (how stables earn money), and the daily financial reporting system. The economy system creates strategic depth by requiring players to balance investments, operating costs, and revenue generation while managing their stable and robot roster.

**Success Criteria**: Players understand all cost centers and revenue streams, can make informed economic decisions, and receive clear daily financial reports showing their stable's economic health.

---

## Table of Contents

1. [Implementation Status](#implementation-status)
   - [Phase 1: Backend Implementation](#-phase-1-backend-implementation-complete)
   - [Implementation Files](#implementation-files)
   - [Key Features](#key-features)
   - [API Usage Examples](#api-usage-examples)
   - [Phase 2: Frontend Implementation](#-phase-2-frontend-implementation-complete)
   - [Phase 3: Advanced Features](#-phase-3-advanced-features-not-started)
   - [Implementation History](#implementation-history)
2. [Executive Summary](#executive-summary)
3. [Background & Context](#background--context)
4. [Economy Overview](#economy-overview)
5. [Cost Centers (What Costs Money)](#cost-centers-what-costs-money)
6. [Revenue Streams (How Stables Earn Money)](#revenue-streams-how-stables-earn-money)
7. [Prestige & Fame System](#prestige--fame-system)
8. [Daily Financial System](#daily-financial-system)
9. [Economic Balance & Progression](#economic-balance--progression)
10. [Implementation Recommendations](#implementation-recommendations)
11. [Success Metrics](#success-metrics)
12. [Appendices](#appendices)

---

## Background & Context

### Current State

**✅ IMPLEMENTED (Backend - February 3-4, 2026):**
- ✅ Currency system (Credits - ₡) defined in ROBOT_ATTRIBUTES.md
- ✅ Complete facility system with costs in STABLE_SYSTEM.md
- ✅ Weapon catalog with prices in WEAPONS_AND_LOADOUT.md
- ✅ Robot attribute upgrade costs in ROBOT_ATTRIBUTES.md
- ✅ Repair cost formulas with Medical Bay support
- ✅ Database schema for all economic tracking (DATABASE_SCHEMA.md)
- ✅ **Economic calculation utilities** (`prototype/backend/src/utils/economyCalculations.ts`)
  - Facility operating costs (all 14 facilities)
  - Revenue calculations (battle rewards, merchandising, streaming)
  - Repair costs with facility discounts
  - Financial health indicators
- ✅ **Financial API endpoints** (`prototype/backend/src/routes/finances.ts`)
  - `GET /api/finances/summary` - Quick dashboard overview
  - `GET /api/finances/daily` - Comprehensive financial report
  - `GET /api/finances/operating-costs` - Cost breakdown
  - `GET /api/finances/revenue-streams` - Income sources
  - `GET /api/finances/projections` - Forecasts & recommendations
- ✅ **Battle reward system** - League-based rewards with prestige multipliers
  - Bronze: ₡5-10K → Champion: ₡150-300K
  - Prestige multipliers: 5%-20% bonus
  - Participation rewards: 30% of league base
  - **NEW (Feb 4)**: Rewards tracked in database and displayed in admin
- ✅ **Fame system** - Performance-based fame awards
  - Perfect victory (100% HP): 2x multiplier
  - Dominating victory (>80% HP): 1.5x multiplier
  - Comeback victory (<20% HP): 1.25x multiplier
  - Fame tiers: Unknown, Known, Famous, Renowned, Legendary, Mythical
- ✅ **Comprehensive unit tests** - 27 tests covering all economic formulas

**✅ IMPLEMENTED (Frontend - February 3-4, 2026):**
- ✅ **Financial API utilities** (`prototype/frontend/src/utils/financialApi.ts`)
- ✅ **FinancialSummary component** - Dashboard widget
- ✅ **FinancialReportPage** - Full financial report page
- ✅ **NEW (Feb 4)**: Battle rewards display in admin modal
- ✅ **NEW (Feb 4)**: Daily finances manual control button
- ✅ **NEW (Feb 4)**: Bulk cycle checkbox for daily finances
- ✅ Daily financial reporting UI implementation
- ✅ Economic dashboard showing trends and projections

**❌ NOT YET STARTED:**
- ❌ Tutorial/onboarding explaining economic systems
- ❌ Economic alerts (low funds, unprofitable operations, etc.)
- ❌ Historical tracking of financial performance

### Design References

- **[PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)**: Complete prestige and fame system specification (earning, benefits)
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)**: Facility costs, economic formulas, daily income/expense examples
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)**: Upgrade costs, repair formulas, currency definition, and fame tracking
- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**: Weapon prices and crafting costs
- **[GAME_DESIGN.md](GAME_DESIGN.md)**: Overall economic philosophy and progression
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**: Data model for tracking resources
- **[PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md)**: Weapon economy, 23 starting weapons.

---

## Economy Overview

### Currency System

**Primary Currency: Credits (₡)**
- Symbol: ₡ (Costa Rican colón symbol, chosen for robotic/technical aesthetic)
- Starting balance: **₡3,000,000** per player (increased Feb 8, 2026 - see [OPTION_C_IMPLEMENTATION.md](../OPTION_C_IMPLEMENTATION.md))
- Precision: Whole numbers only (no decimals)
- Range: 0 to 999,999,999,999 (database supports up to ~2 billion)

**Secondary Resource: Prestige (Stable-Level)**
- **See [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)**
- Not a spendable currency - acts as unlock threshold
- Earned through victories, achievements, milestones, tournaments
- Never decreases (only increases)
- Used to unlock facility levels and high-tier content
- Scales merchandising income
- Provides battle winnings multiplier

**Tertiary Resource: Fame (Robot-Level)**
- **See [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)**
- Individual robot reputation (separate from stable prestige)
- Earned through individual robot victories with performance bonuses
- Tracked per robot, aggregated for stable-level calculations
- Used in streaming revenue calculations (aggregate)
- Displayed for competitive rankings

### Economic Philosophy

1. **Multiple Paths to Success**: Players can focus on quality (one powerful robot), quantity (multiple robots), or specialization (weapon trading, specific tournaments, 2v2 or other team battles)
2. **Meaningful Choices**: Every purchase should have trade-offs and alternatives
3. **Sustainable Operations**: Players should be able to run profitable stables with proper management
4. **Risk/Reward Balance**: Higher risks (low yield threshold, aggressive facilities) offer higher rewards
5. **Long-Term Planning**: Facility investments pay off over time, encouraging strategic thinking

---

## Cost Centers (What Costs Money)

All costs are paid in Credits (₡). This section consolidates every way players spend money.

### 1. Robot Acquisition & Upgrades

#### Robot Frame Purchase
- **Cost**: ₡500,000 per robot (bare metal chassis)
- **Includes**: Robot with all 23 attributes at level 1
- **Starting HP**: Full health (max HP determined by Hull Integrity attribute)
- **Starting Shields**: Full shields (max determined by Shield Capacity attribute)
- **One-time cost**: No recurring fees for owning robot

**Formula**:
```
robot_purchase_cost = 500,000 Credits
```

#### Attribute Upgrades
- **Formula**: `(current_level + 1) × 1,500` Credits per level (increased Feb 8, 2026)
- **Range**: Level 1 → 50
- **23 Attributes Total** (see ROBOT_ATTRIBUTES.md for complete list)

**Examples**:
- Level 1→2: ₡2,000
- Level 2→3: ₡3,000
- Level 10→11: ₡11,000
- Level 49→50: ₡50,000

**Total Cost to Max One Attribute** (1→50):
```
sum = Σ(n+1) × 1,000 for n=1 to 49
    = (2 + 3 + 4 + ... + 50) × 1,000
    = 1,274 × 1,000
    = ₡1,274,000
```

**Total Cost to Max All 23 Attributes** (all 1→50):
```
total_max_cost = 23 × 1,274,000 = ₡29,302,000
```

**Facility Discount: Training Facility**
- Provides 5% to 50% discount based on level (see section 2 below)
- Discount applies to base upgrade cost before calculation
- Formula with discount:
  ```
  discount = training_facility_level × 5  // 0% to 50%
  upgrade_cost = (current_level + 1) × 1,500 × (1 - discount/100)  // Updated Feb 8, 2026
  ```

**Training Facility ROI Analysis**:

*Upgrading from level 1→10 (hitting first cap) for all 23 attributes:*
- Cost per attribute (1→10): (2+3+4+5+6+7+8+9+10+11) × ₡1,000 = ₡54,000
- Total for all 23 attributes: 23 × ₡54,000 = **₡1,242,000**

*With Training Facility Level 1 (5% discount):*
- Training Facility cost: ₡300,000
- Cost per attribute (1→10) with discount: ₡54,000 × 0.95 = ₡51,300
- Total for all 23 attributes: 23 × ₡51,300 = ₡1,179,900
- **Savings**: ₡1,242,000 - ₡1,179,900 = ₡62,100
- **Net cost with facility**: ₡300,000 + ₡1,179,900 = ₡1,479,900
- **vs without facility**: ₡1,242,000

**Conclusion**: Training Facility Level 1 is NOT cost-effective for early game (1→10 upgrades). It only becomes valuable when upgrading to higher levels or when upgrading multiple robots. 
**Recommendation**: Prioritize attribute upgrades first, purchase Training Facility later when preparing for level 15+ upgrades or when managing 2+ robots.

### 2. Facility Purchases & Upgrades

**14 Facility Types**, most with **10 upgrade levels** (Level 0 = not purchased, Levels 1-10 = upgraded). Some levels require prestige thresholds (Roster Expansion is the only facility with 9 levels. 

**Purchase Costs Summary** (Level 1 costs for each facility):

| Facility | Level 1 Cost | Operating Cost/Day |
|----------|-------------|-------------------|
| 1. Repair Bay | ₡200,000 | ₡1,000 |
| 2. Training Facility | ₡300,000 | ₡1,500 |
| 3. Weapons Workshop | ₡250,000 | ₡1,000 |
| 4. Research Lab | ₡400,000 | ₡2,000 |
| 5. Medical Bay | ₡350,000 | ₡2,000 |
| 6. Roster Expansion | ₡300,000 | ₡500/slot |
| 7. Storage Facility | ₡150,000 | ₡500 |
| 8. Coaching Staff | ₡500,000 | ₡3,000 when active |
| 9. Booking Office | ₡500,000 | ₡0 (generates prestige) |
| 10. Combat Training Academy | ₡400,000 | ₡800 |
| 11. Defense Training Academy | ₡400,000 | ₡800 |
| 12. Mobility Training Academy | ₡400,000 | ₡800 |
| 13. AI Training Academy | ₡500,000 | ₡1,000 |
| 14. Income Generator | ₡800,000 | ₡1,000 |
| 15. Streaming Studio | ₡100,000 | ₡100 |

**Total Cost to Purchase All Facilities (Level 1)**: ₡5,550,000

**Upgrade Cost Scaling**:
- Most facilities: Cost increases by ~₡200K-₡400K per level
- Higher levels (7-10) often have prestige requirements
- Total cost to max one facility: ~₡2M-₡5M (varies by facility)

**Streaming Studio Facility** (NEW):

The Streaming Studio is a new facility that increases streaming revenue earned per battle. Unlike the old system where streaming was gated behind Income Generator Level 3+, the Streaming Studio provides a direct multiplier to per-battle streaming income.

**Costs and Benefits**:
- **Level 1 Cost**: ₡100,000
- **Upgrade Formula**: (N + 1) × ₡100,000 per level
  - Level 1→2: ₡200,000
  - Level 2→3: ₡300,000
  - Level 9→10: ₡1,000,000
- **Total Cost (Level 0→10)**: ₡5,500,000

**Operating Costs**:
- **Formula**: level × ₡100 per day
  - Level 1: ₡100/day
  - Level 5: ₡500/day
  - Level 10: ₡1,000/day

**Prestige Requirements**:
- Levels 1-3: No prestige required
- Level 4: 1,000 prestige
- Level 5: 2,500 prestige
- Level 6: 5,000 prestige
- Level 7: 10,000 prestige
- Level 8: 15,000 prestige
- Level 9: 25,000 prestige
- Level 10: 50,000 prestige

**Revenue Multiplier**:
- **Formula**: studio_multiplier = 1 + (level × 0.1)
  - Level 0: 1.0× (no bonus)
  - Level 1: 1.1× (+10%)
  - Level 5: 1.5× (+50%)
  - Level 10: 2.0× (+100%, doubles base streaming revenue)

**ROI Analysis**:
*Scenario: Mid-game robot (500 battles, 2,500 fame)*
- Base streaming per battle (no studio): ₡1,000 × 1.5 × 1.5 = ₡2,250
- With Studio Level 1: ₡2,250 × 1.1 = ₡2,475 (+₡225 per battle)
- Studio Level 1 cost: ₡100,000
- Operating cost: ₡100/day = ₡700/week
- Net gain per battle: ₡225
- Battles to break even: ₡100,000 / ₡225 = 445 battles
- At 7 battles/week: **64 weeks to break even**

*Scenario: Veteran robot (1,000 battles, 5,000 fame)*
- Base streaming per battle (no studio): ₡1,000 × 2.0 × 2.0 = ₡4,000
- With Studio Level 5: ₡4,000 × 1.5 = ₡6,000 (+₡2,000 per battle)
- Studio Level 1-5 total cost: ₡1,500,000
- Operating cost: ₡500/day = ₡3,500/week
- Net gain per battle: ₡2,000
- Weekly gain: (7 × ₡2,000) - ₡3,500 = ₡10,500/week
- Weeks to break even: ₡1,500,000 / ₡10,500 = **143 weeks**

*Scenario: Multiple active robots (3 robots, 7 battles each/week = 21 total)*
- Average streaming per battle with Studio Level 5: ₡6,000
- Weekly gain: (21 × ₡2,000) - ₡3,500 = ₡38,500/week
- Weeks to break even: ₡1,500,000 / ₡38,500 = **39 weeks**

**Conclusion**: Streaming Studio provides better ROI with:
- Multiple active robots (more battles per week)
- Higher robot stats (battles and fame increase base streaming)
- Long-term investment horizon (payback period is 6-12+ months)

**See [STABLE_SYSTEM.md](STABLE_SYSTEM.md#facility-system) for complete facility details, level costs, and benefits.**

### 3. Weapon Purchases

**Phase 1 Implemented Weapons** (23 total):

> **For complete weapon catalog, pricing, and methodology**: See **[PRD_WEAPON_ECONOMY_OVERHAUL.md](PRD_WEAPON_ECONOMY_OVERHAUL.md)** - the authoritative document for weapon economy system (implemented in `prototype/backend/prisma/seed.ts`).

**Weapon Pricing Methodology**:

All weapons use an exponential pricing formula based on attribute bonuses and DPS (Damage Per Second):

1. **Base Price**: ₡50,000 (Practice Sword baseline)
2. **Exponential Scaling**: Higher attribute bonuses cost progressively more per point
3. **DPS Premium**: Weapons with high damage and low cooldown cost more
4. **No Special Properties**: All special properties removed (not implemented in combat system)

**Weapon Price Range**: ₡50,000 (Practice Sword) to ₡600,000+ (Elite two-handed weapons)

**Key Weapon Categories**:
- **Budget One-Handed** (₡50K-₡150K): Practice Sword, Combat Knife, Machine Gun, Laser Rifle, Shock Baton
- **Mid-Tier One-Handed** (₡150K-₡250K): Power Sword, Plasma Blade, Gatling Gun
- **Premium One-Handed** (₡250K-₡400K): Disruptor Beam, Ion Blade
- **Shields** (₡100K-₡300K): Combat Shield, Energy Shield, Fortress Shield
- **Two-Handed** (₡150K-₡600K): Shotgun, Hammer, Railgun, Plasma Cannon, Ion Beam, Devastator Cannon

**Weapons vs Academy Investment**:
- **Academy** (₡400K-₡500K): Unlocks attribute cap 10→15 for 5-6 attributes in category
  - Allows +5 levels per attribute = potential +25-30 total attribute points across category
  - Permanent benefit, applies to all current and future robots
  - Has daily operating costs (₡800-₡1,000/day)
- **Premium Weapon** (₡300K-₡400K): Provides immediate +15-20 attribute points
  - Immediate benefit, can be swapped between robots
  - No operating cost
  - Can be sold or traded (future feature)

**Strategy Comparison**:
- **Early Game**: Budget weapons (₡50K-₡150K) provide power spike with low upfront cost
- **Mid Game**: Mix of mid-tier weapons (₡150K-₡250K) and first academy
- **Late Game**: Premium weapons (₡300K+) and multiple academies for attribute cap increases
- **Optimal**: Balanced portfolio - weapons for immediate power, academies for long-term scaling

**Loadout Strategy Examples**:
- **Dual Wield** (e.g., 2× Gatling Guns = 2×₡200K = ₡400K): High DPS, strong offense
- **Single Two-Handed** (e.g., Plasma Cannon = ₡400K): Balanced stats, high burst damage
- **Weapon + Shield** (e.g., Power Sword ₡200K + Energy Shield ₡200K = ₡400K): Balanced offense + defense

**Weapon Ownership**:
- Weapons are purchased and placed in stable's weapon storage
- Each purchase creates separate inventory item (can own multiple copies)
- Weapon can only be equipped to one robot at a time
- To use same weapon on multiple robots, purchase multiple copies

**Storage Limits**:
- Default capacity: 5 weapons (Storage Facility Level 0)
- Maximum capacity: 55 weapons (Storage Facility Level 10)
- Storage includes both equipped and unequipped weapons

**Facility Discount: Weapons Workshop**
- Provides 5% to 50% discount based on level
- Formula:
  ```
  discount = weapons_workshop_level × 5  // 0% to 50%
  weapon_cost = base_price × (1 - discount/100)
  ```

**Examples**:
- Plasma Cannon (₡300,000) with Workshop Level 5:
  - Discount: 25%
  - Final cost: ₡300,000 × 0.75 = ₡225,000
 
--> This is not up to date. Refer to PRD_WEAPON_ECONOMY_OVERHAUL.md for up to date information. This PRD has been implemented.

### 4. Weapon Crafting (Unlockable)

**Requirements**:
- Weapons Workshop Level 3+ (unlocks weapon modifications)
- Weapons Workshop Level 6+ (unlocks custom weapon design)
- Weapons Workshop Level 10 (unlocks legendary weapon crafting)
- 10+ battles with similar weapon types
- Minimum 5,000 prestige

**Crafting Costs** (Aligned with catalog weapon pricing):
- Base weapon template: ₡50,000
- Attribute bonus allocation: ₡15,000-₡20,000 per +1 attribute point
- Maximum attribute point budget: 20 points for Level 6, 25 points for Level 10
- Special properties: **Future feature** (not yet implemented in battle system)

**Example Custom Weapon** (Workshop Level 6):
- Base template: ₡50,000
- +15 attribute points: 15 × ₡17,000 = ₡255,000
- **Total**: ₡305,000 (comparable to Plasma Cannon at ₡300,000)

**Example Legendary Weapon** (Workshop Level 10):
- Base template: ₡50,000
- +25 attribute points: 25 × ₡17,000 = ₡425,000
- **Total**: ₡475,000 (premium tier, beyond catalog weapons)

**Note**: Custom weapons use the same pricing formula as catalog weapons. The 11 catalog weapons serve as reference examples that could be crafted using this system. Special properties (e.g., "ignores armor", "shield drain") will be added in future phases when implemented in the battle system. 

### 5. Repair Costs

**Base Formula**:
```
base_repair = (sum_of_all_23_attributes × 100)
damage_percentage = damage_taken / max_hp

// Apply multiplier based on condition
if robot_destroyed (HP = 0):
    multiplier = 2.0
elif robot_heavily_damaged (HP < 10%):
    multiplier = 1.5
else:
    multiplier = 1.0

repair_cost_before_discounts = base_repair × damage_percentage × multiplier
```

**Facility Discounts**:

1. **Repair Bay** (all repairs):
   - Discount: Multi-robot formula (Level 1-10 with 0-10 robots)
   - Formula: `discount = repair_bay_level × (5 + active_robot_count)`, capped at 90%
   - **Single Robot Examples**:
     - Level 1: 5% discount (1 × (5 + 0))
     - Level 5: 25% discount (5 × (5 + 0))
     - Level 10: 50% discount (10 × (5 + 0))
   - **Multi-Robot Examples**:
     - Level 1 + 4 robots: 9% discount (1 × (5 + 4))
     - Level 3 + 2 robots: 21% discount (3 × (5 + 2))
     - Level 5 + 7 robots: 60% discount (5 × (5 + 7))
     - Level 6 + 10 robots: 90% discount (6 × (5 + 10), capped)
     - Level 10 + 10 robots: 90% discount (10 × (5 + 10) = 150%, capped at 90%)

2. **Medical Bay** (critical damage only, HP = 0):
   - Reduces critical damage multiplier (2.0x) by 10%-100%
   - Formula: `effective_multiplier = 2.0 × (1 - medical_bay_level × 0.1)`
   - Level 10: Eliminates critical damage penalty entirely

**Repair Bay ROI Analysis with Multi-Robot Discount**:
- Average robot (230 total attributes): Base repair cost = ₡23,000
- Average damage per battle: 40-60% HP (₡9,200-₡13,800 repair cost)

**Single Robot Scenario**:
- **Repair Bay Level 1** (₡200K, 5% discount):
  - Saves ₡460-₡690 per battle
  - Payback: 290-435 battles
  - At 7 battles/week: **41-62 weeks** to break even
  - **Conclusion**: Poor ROI for single robot

**Multi-Robot Scenario (3 robots)**:
- **Repair Bay Level 1** (₡200K, 8% discount with 3 robots):
  - Saves ₡736-₡1,104 per battle per robot
  - With 3 robots (21 battles/week total): Saves ₡15,456-₡23,184/week
  - Payback: **9-13 weeks** to break even
  - **Conclusion**: Excellent ROI with multiple robots

**Multi-Robot Scenario (10 robots)**:
- **Repair Bay Level 6** (₡1.2M total, 90% discount with 10 robots):
  - Saves ₡8,280-₡12,420 per battle per robot
  - With 10 robots (70 battles/week total): Saves ₡579,600-₡869,400/week
  - Payback: **1-2 weeks** to break even
  - **Conclusion**: Exceptional ROI with large roster, reaches 90% cap

**90% Discount Cap Warning**:
Once you reach 90% discount, further Repair Bay or Roster Expansion investment provides no additional repair cost benefit. Plan your investments carefully to avoid wasting credits.

**Cap Scenarios - When Further Investment Provides No Benefit**:

| Repair Bay Level | Robot Count | Discount Calculation | Actual Discount | Further Investment Benefit |
|------------------|-------------|----------------------|-----------------|---------------------------|
| 6 | 10 | 6 × (5 + 10) = 90% | 90% | ❌ None - cap reached |
| 7 | 10 | 7 × (5 + 10) = 105% | 90% (capped) | ❌ None - already at cap |
| 10 | 10 | 10 × (5 + 10) = 150% | 90% (capped) | ❌ None - already at cap |
| 9 | 9 | 9 × (5 + 9) = 126% | 90% (capped) | ❌ None - already at cap |
| 10 | 8 | 10 × (5 + 8) = 130% | 90% (capped) | ❌ None - already at cap |

**Optimal Investment Strategies**:
- **10 robots**: Stop at Repair Bay Level 6 (saves ₡4.5M on Levels 7-10)
- **9 robots**: Stop at Repair Bay Level 7 (saves ₡3M on Levels 8-10)
- **8 robots**: Stop at Repair Bay Level 8 (saves ₡1.5M on Levels 9-10)
- **7 robots**: Stop at Repair Bay Level 9 (saves ₡500K on Level 10)
- **6 robots or fewer**: Level 10 Repair Bay provides 65-75% discount (not capped)

**Example Waste Scenario**:
- Player has 10 robots and Repair Bay Level 6 (90% discount)
- Upgrading to Level 7 costs ₡1,500,000
- New discount: 7 × (5 + 10) = 105% → still 90% (capped)
- **Result**: ₡1,500,000 wasted with zero benefit

**Recommendation**: Check your current discount before upgrading. If you're at or near 90%, invest credits elsewhere (weapons, attributes, other facilities).

**Conclusion**: Repair Bay provides exceptional value with multiple robots. The multi-robot discount makes it one of the most valuable facilities for players with large rosters, but be mindful of the 90% cap to avoid wasted investments.

**Final Repair Cost Formula**:
```
// Step 1: Calculate base repair with multiplier
base_repair = sum_of_attributes × 100
repair_before_discounts = base_repair × damage_percentage × condition_multiplier

// Step 2: Apply Medical Bay if critical damage
if HP = 0 AND medical_bay_level > 0:
    medical_reduction = medical_bay_level × 0.1
    effective_multiplier = 2.0 × (1 - medical_reduction)
    repair_before_discounts = base_repair × damage_percentage × effective_multiplier

// Step 3: Apply Repair Bay multi-robot discount
raw_discount = repair_bay_level × (5 + active_robot_count)
repair_bay_discount = Math.min(raw_discount, 90) / 100  // Cap at 90%
final_repair_cost = repair_before_discounts × (1 - repair_bay_discount)
```

**Example (Single Robot)**:
- Robot with 230 total attributes (sum of all 23)
- Started battle with 100 HP
- Took 100 damage during battle (reduced to 0 HP = destroyed)
- Repair Bay Level 5, Medical Bay Level 3, 1 robot (active_robot_count = 0)

```
base_repair = 230 × 100 = ₡23,000
damage_percentage = 100/100 = 1.0  // 100% damage (complete destruction)

// Critical damage multiplier with Medical Bay
medical_reduction = 3 × 0.1 = 0.3
effective_multiplier = 2.0 × (1 - 0.3) = 1.4

repair_before_discount = 23,000 × 1.0 × 1.4 = ₡32,200

// Repair Bay multi-robot discount
raw_discount = 5 × (5 + 0) = 25%
repair_bay_discount = Math.min(25, 90) / 100 = 0.25
final_repair_cost = 32,200 × (1 - 0.25) = ₡24,150
```

**Example (Multiple Robots)**:
- Same robot with 230 total attributes
- Same damage scenario (destroyed, 0 HP)
- Repair Bay Level 5, Medical Bay Level 3, 7 robots total (active_robot_count = 7)

```
base_repair = 230 × 100 = ₡23,000
damage_percentage = 1.0
effective_multiplier = 1.4 (with Medical Bay Level 3)

repair_before_discount = 23,000 × 1.0 × 1.4 = ₡32,200

// Repair Bay multi-robot discount
raw_discount = 5 × (5 + 7) = 60%
repair_bay_discount = Math.min(60, 90) / 100 = 0.60
final_repair_cost = 32,200 × (1 - 0.60) = ₡12,880

// Savings vs single robot: ₡24,150 - ₡12,880 = ₡11,270 (47% additional savings)
```

**Repair Timing**:
- Repairs must be paid between battles to restore robot to full HP
- Robot cannot participate in next battle until repaired
- HP does NOT regenerate automatically (must pay repair cost)
- Energy shields regenerate automatically between battles (no cost)

### 6. Operating Costs (Daily Recurring)

**Facility Operating Costs**:
Each facility has daily operating cost that scales with level.

**Formula** (varies by facility):
```
// Most facilities:
operating_cost = base_cost + (additional_cost × level)

// Examples:
Repair Bay: ₡1,000 + (₡500 × level)
Training Facility: ₡1,500 + (₡750 × level)
Research Lab: ₡2,000 + (₡1,000 × level)
```

**Special Cases**:
- **Roster Expansion**: ₡500/day per robot slot beyond first (first slot is free)
  - Level 0: 1 robot slot (free, ₡0/day operating cost)
  - Level 1: 2 robot slots (₡500/day total - ₡500 for the 2nd slot)
  - Level 2: 3 robot slots (₡1,000/day total - ₡500 each for 2nd and 3rd slots)
  - Formula: `operating_cost = (current_roster_size - 1) × ₡500/day`
- **Coaching Staff**: ₡3,000/day when coach is active (only if Coaching Staff facility purchased)
- **Booking Office**: ₡0/day (generates prestige instead)

**Typical Daily Operating Costs by Game Stage**:
- **Early Game** (1 robot, 1-2 facilities): ₡2,500-₡5,000/day
- **Mid Game** (3-4 robots, 4-6 facilities): ₡15,000-₡25,000/day
- **Late Game** (6-10 robots, 10+ facilities): ₡40,000-₡60,000/day

**Note**: Early game players should prioritize attribute upgrades over multiple facilities. With only 1 robot, Storage Facility and Roster Expansion provide no benefit. **Recommended early facilities**: Repair Bay (long-term savings) and optionally one Academy (if pushing past level 10 cap). 

### 7. Coach Switching Cost

- **One-time cost**: ₡100,000 to switch active coach
- Only applies if Coaching Staff facility is purchased
- Coach daily operating cost: ₡3,000/day while active

### 8. Total Startup Costs

**Player Behavior Reality**: Most players will spend nearly all starting credits to maximize immediate robot power, keeping only minimal buffer (₡10K-₡50K) for first repairs. The game should accommodate this behavior.

**Minimum Viable Stable** (₡1,950,000 spent, ₡50K buffer):
- 1 Robot: ₡500,000
- 1 Budget weapon (e.g., Practice Sword or Machine Gun): ₡50,000-₡100,000
- Repair Bay Level 1: ₡200,000
- Basic attribute upgrades (100 levels @ avg ₡550): ~₡55,000
- One Academy Level 1 (e.g., Combat Training): ₡400,000
- Additional attribute upgrades (100 levels): ~₡650,000
- **Buffer**: ₡50,000 (1-2 repairs)

**Balanced Startup** (₡1,970,000 spent, ₡30K buffer - recommended):
- 1 Robot: ₡500,000
- 1 Mid-tier weapon (e.g., Power Sword): ₡200,000
- Repair Bay Level 1: ₡200,000
- Training Facility Level 1: ₡300,000
- Attribute upgrades focused on key stats (150 levels): ~₡770,000
- **Buffer**: ₡30,000 (1 repair)

**Aggressive Startup** (₡1,985,000 spent, ₡15K buffer - risky):
- 2 Robots: ₡1,000,000
- 2 Budget weapons (e.g., 2× Machine Guns): ₡200,000
- Repair Bay Level 1: ₡200,000
- Split attribute upgrades (100 levels total): ~₡585,000
- **Buffer**: ₡15,000 (emergency only)

**Power Maximizer** (₡1,995,000 spent, ₡5K buffer - very risky):
- 1 Robot: ₡500,000
- 1 Premium weapon (e.g., Plasma Cannon): ₡400,000
- Repair Bay Level 1: ₡200,000
- Heavy attribute investment (200 levels): ~₡895,000
- **Buffer**: ₡5,000 (forced to win first battle or bankrupt)

**Economic Safeguards Needed**:
1. **Low balance warnings**: Alert when balance < ₡100K (before battle matchmaking)
2. **Battle entry check**: Require minimum balance equal to estimated repair cost (prevent bankruptcy from battle)
3. **Emergency credit line**: Allow players to take small loan (₡50K-₡100K) at 20% interest if they fall below ₡10K
4. **First battle protection**: First 5 battles have reduced repair costs (50% discount) to prevent early bankruptcy

**Design Note**: The ₡2M starting balance intentionally forces players to make strategic trade-offs. They cannot afford everything - they must choose between:
- More robots vs. better weapons vs. facilities vs. attribute upgrades
- Immediate power vs. long-term infrastructure
- Offense-focused vs. balanced builds 

---

## Revenue Streams (How Stables Earn Money)

All revenue is earned in Credits (₡). This section consolidates every way players earn money.

### 1. Battle Winnings

**Victory Rewards by League**:

| League | Win Reward Range | Prestige per Win |
|--------|-----------------|------------------|
| Bronze | ₡5,000 - ₡10,000 | +5 |
| Silver | ₡10,000 - ₡20,000 | +10 | +10 |
| Gold | ₡20,000 - ₡40,000 | +20 | +20 |
| Platinum | ₡40,000 - ₡80,000 | +30 | +30 |
| Diamond | ₡80,000 - ₡150,000 | +50 | +50 |
| Champion | ₡150,000 - ₡300,000 | +75 | +75 |

**Fame vs Prestige**:
- **Fame**: Robot-level reputation (individual robot stat)
- **Prestige**: Stable-level reputation (account-wide stat)
- Both earned from victories but tracked separately
- Fame used for robot rankings; Prestige unlocks stable content

**Battle Reward Formula**:
```
// Winner reward - base determined by league tier
winner_base_reward = league_base + (ELO_difference_bonus)

// ELO difference bonus (for winners only)
if opponent_ELO > your_ELO:
    ELO_bonus = (opponent_ELO - your_ELO) / 20  // Upset bonus
else:
    ELO_bonus = 0

// Final winner reward (before prestige multiplier)
winner_reward = min(winner_base_reward + ELO_bonus, league_max)

// Participation reward (both winner and loser receive this)
participation_reward = league_base × 0.3  // 30% of league base

// Example: Bronze league (₡5K-₡10K range)
// Winner: Your ELO: 1150, Opponent ELO: 1250
// winner_base = ₡5,000
// ELO_bonus = (1250-1150)/20 = ₡5,000
// winner_reward = min(₡10,000, ₡10,000) = ₡10,000 (max for Bronze)
// participation = ₡5,000 × 0.3 = ₡1,500
// WINNER TOTAL = ₡10,000 + ₡1,500 = ₡11,500

// Loser: Same battle
// loser_reward = ₡0 (no win bonus)
// participation = ₡1,500
// LOSER TOTAL = ₡1,500
```

**Participation Award System**:
- **Amount**: 30% of league base reward (both winner and loser)
- **Purpose**: Offset repair costs, especially for losers who take more damage
- **Balance**: Ensures losing players still earn some credits to cover basic repairs

**League-Specific Participation Rewards**:
- Bronze league: ₡1,500 (30% of ₡5,000 base)
- Silver league: ₡3,000 (30% of ₡10,000 base)
- Gold league: ₡6,000 (30% of ₡20,000 base)
- Platinum league: ₡12,000 (30% of ₡40,000 base)
- Diamond league: ₡24,000 (30% of ₡80,000 base)
- Champion league: ₡45,000 (30% of ₡150,000 base)

**Economic Impact with Participation Awards**:
- **Winner** (Bronze): ₡7,500 win reward + ₡1,500 participation = ₡9,000 total
- **Loser** (Bronze): ₡0 win reward + ₡1,500 participation = ₡1,500 total
- **At 50% win rate** (3.5 wins, 3.5 losses per week):
  - Income: (3.5 × ₡9,000) + (3.5 × ₡1,500) = ₡31,500 + ₡5,250 = ₡36,750/week
  - Repair costs (winner damage ~₡5K, loser damage ~₡12K): 
    - Winners: 3.5 × ₡5,000 = ₡17,500
    - Losers: 3.5 × ₡12,000 = ₡42,000
    - Total: ₡59,500/week
  - **Net**: ₡36,750 - ₡59,500 = -₡22,750/week shortfall
  
**Repair Cost Adjustment Needed**:
To achieve sustainability at 50% win rate with participation awards:
- Target: Income (₡36,750) should cover 90% of repair costs
- Target repair costs: ₡40,833/week (₡36,750 / 0.9)
- Current repair costs: ₡59,500/week
- **Required reduction**: 31% lower repair costs

**Recommended Solution**:
1. **Add participation awards** (implemented above): +₡10,500/week income boost
2. **Reduce base repair formula**: `(total_attributes × 75)` instead of `(total_attributes × 100)` = 25% cost reduction
3. **New repair costs**: ₡44,625/week (₡59,500 × 0.75)
4. **New economics**: ₡36,750 income covers 82% of ₡44,625 repairs
5. **Gap**: ₡7,875/week deficit - covered by facility income streams (merchandising, streaming) or reduced operating costs 

### 2. Prestige Bonuses (Battle Multiplier)

> **For complete prestige earning mechanics**, see [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)

Higher stable prestige increases battle winnings:

| Prestige Threshold | Battle Winnings Bonus |
|-------------------|---------------------|
| 5,000+ | +5% |
| 10,000+ | +10% |
| 25,000+ | +15% |
| 50,000+ | +20% |

**Bonus Application**: Prestige bonus multiplies the base battle reward **AFTER** ELO calculation, extending beyond the league reward range.

**Prestige Accumulation Timeline**:
- Starting prestige: 0
- Bronze wins (+5 prestige each): 1,000 wins needed for 5,000 prestige threshold
- Average player (50% win rate, 7 battles/week): 3.5 wins/week = ~285 weeks (5.5 years)
- **More realistic**: Mix of leagues + achievements + tournaments
  - Bronze: 100 wins = +500 prestige
  - Silver: 100 wins = +1,000 prestige  
  - Gold: 50 wins = +1,000 prestige
  - Achievements: ~1,000 prestige
  - Tournaments: ~500 prestige
  - **Total to 5,000**: ~6-12 months of regular play

**"Win More" Concern**: 
- Yes, prestige rewards successful players with better rewards
- Counterbalance: ELO matchmaking ensures ~50% win rate long-term
- Benefit: Rewards player loyalty and continued engagement
- Alternative: Prestige could reduce operating costs instead of increasing income

**Formula**:
```
prestige_multiplier = 1.0

if prestige >= 50000:
    prestige_multiplier = 1.20
elif prestige >= 25000:
    prestige_multiplier = 1.15
elif prestige >= 10000:
    prestige_multiplier = 1.10
elif prestige >= 5000:
    prestige_multiplier = 1.05

final_battle_reward = base_reward × prestige_multiplier
```

**Example**:
- Bronze league win: ₡7,500 base (midpoint of ₡5K-₡10K range)
- Prestige: 12,000
- Multiplier: +10%
- Final reward: ₡7,500 × 1.10 = ₡8,250
- **Note**: Base reward midpoint is determined by ELO matchup. Closer matches → higher base (closer to ₡10K). Mismatched opponents → lower base (closer to ₡5K).

### 3. Merchandising Income (Income Generator Facility)

> **For complete prestige earning and benefits**, see [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)

**Requirements**:
- Income Generator Level 1+ (unlocks merchandising)

**Note**: The Income Generator facility no longer provides streaming revenue. Streaming revenue is now awarded per battle to all players. See "Streaming Revenue (Per-Battle)" section above and the Streaming Studio facility for details.

**Base Income by Level**:
- Level 1: ₡5,000/day
- Level 2: ₡8,000/day
- Level 4: ₡12,000/day
- Level 6: ₡18,000/day
- Level 8: ₡25,000/day
- Level 10: ₡35,000/day

**Scaling Formula**:
```
base_merchandising = income_generator_base_rate  // Based on level
prestige_multiplier = 1 + (stable_prestige / 10000)

merchandising_income = base_merchandising × prestige_multiplier
```

**Design Rationale**: Merchandising scales with **stable prestige** (not individual robot fame) because it represents the stable's overall brand value and reputation. Higher prestige stables can charge more for merchandise and attract more fans.

**Examples**:
*Early Game (Low Prestige):*
- Income Generator Level 1: ₡5,000/day base
- Stable prestige: 1,000
- Prestige multiplier: 1 + (1000/10000) = 1.1
- Daily income: ₡5,000 × 1.1 = ₡5,500/day
- Operating cost: ₡1,000/day
- **Net**: ₡4,500/day

*Mid Game (Moderate Prestige):*
- Income Generator Level 4: ₡12,000/day base
- Stable prestige: 15,000
- Prestige multiplier: 1 + (15000/10000) = 2.5
- Daily income: ₡12,000 × 2.5 = ₡30,000/day
- Operating cost: ₡3,000/day
- **Net**: ₡27,000/day

*Late Game (High Prestige):*
- Income Generator Level 10: ₡35,000/day base
- Stable prestige: 50,000
- Prestige multiplier: 1 + (50000/10000) = 6.0
- Daily income: ₡35,000 × 6.0 = ₡210,000/day
- Operating cost: ₡5,500/day
- **Net**: ₡204,500/day

**Operating Cost**: ₡1,000/day at Level 1, +₡500/day per level

**Design Note**: Prestige-based scaling rewards long-term player engagement and success across all robots in the stable.

### 4. Streaming Revenue (Per-Battle)

> **For complete fame earning and benefits**, see [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)

**Requirements**:
- None (available to all players from first battle)
- Optional: Streaming Studio facility (Levels 1-10) increases revenue per battle

**Per-Battle Streaming Formula**:
```
base_streaming = 1,000  // Fixed base rate per battle
battle_multiplier = 1 + (robot_battles / 1000)  // Individual robot's battle count
fame_multiplier = 1 + (robot_fame / 5000)  // Individual robot's fame
studio_multiplier = 1 + (streaming_studio_level × 0.1)  // Facility bonus (0-10)

streaming_revenue = base_streaming × battle_multiplier × fame_multiplier × studio_multiplier
```

**Design Rationale**: Streaming revenue is now awarded **per battle** rather than as daily passive income. This democratizes streaming income by making it available to all players immediately, and rewards active participation. Each robot earns streaming revenue based on their individual battle count and fame, scaled by the stable's Streaming Studio facility.

**Key Changes from Old System**:
- ✅ **No facility requirement**: All players earn streaming revenue from first battle
- ✅ **Per-battle award**: Revenue earned after each battle completion (1v1, Tag Team, Tournament)
- ✅ **Individual robot stats**: Uses individual robot's battles and fame (not aggregate)
- ✅ **New facility**: Streaming Studio (replaces Income Generator Level 3+ requirement)
- ✅ **Both participants earn**: Winner and loser both receive streaming revenue
- ❌ **No revenue for byes**: Bye matches do not award streaming revenue

**Examples**:
*New Robot (first battle):*
- Base: ₡1,000
- Battles: 0 → battle_multiplier = 1.0
- Fame: 0 → fame_multiplier = 1.0
- No Streaming Studio → studio_multiplier = 1.0
- **Streaming revenue**: ₡1,000 × 1.0 × 1.0 × 1.0 = **₡1,000**

*Experienced Robot (mid game):*
- Base: ₡1,000
- Battles: 500 → battle_multiplier = 1 + (500/1000) = 1.5
- Fame: 2,500 → fame_multiplier = 1 + (2500/5000) = 1.5
- Streaming Studio Level 5 → studio_multiplier = 1 + (5 × 0.1) = 1.5
- **Streaming revenue**: ₡1,000 × 1.5 × 1.5 × 1.5 = **₡3,375 per battle**

*Veteran Robot (late game):*
- Base: ₡1,000
- Battles: 1,000 → battle_multiplier = 1 + (1000/1000) = 2.0
- Fame: 5,000 → fame_multiplier = 1 + (5000/5000) = 2.0
- Streaming Studio Level 10 → studio_multiplier = 1 + (10 × 0.1) = 2.0
- **Streaming revenue**: ₡1,000 × 2.0 × 2.0 × 2.0 = **₡8,000 per battle**

*Legendary Robot (maximum):*
- Base: ₡1,000
- Battles: 5,000 → battle_multiplier = 1 + (5000/1000) = 6.0
- Fame: 25,000 → fame_multiplier = 1 + (25000/5000) = 6.0
- Streaming Studio Level 10 → studio_multiplier = 2.0
- **Streaming revenue**: ₡1,000 × 6.0 × 6.0 × 2.0 = **₡72,000 per battle**

**Tag Team Streaming Revenue**:
For Tag Team matches, streaming revenue is calculated using the **highest battle count** and **highest fame** from each team:
```
// Team 1 calculation
team1_max_battles = max(robot1_battles, robot2_battles)
team1_max_fame = max(robot1_fame, robot2_fame)
team1_battle_multiplier = 1 + (team1_max_battles / 1000)
team1_fame_multiplier = 1 + (team1_max_fame / 5000)
team1_streaming = 1,000 × team1_battle_multiplier × team1_fame_multiplier × studio_multiplier

// Team 2 calculated separately with their own max values
// Each stable receives one payment per team (not per robot)
```

**Weekly Income Comparison** (7 battles/week):
- New robot (0 battles, 0 fame, no studio): 7 × ₡1,000 = **₡7,000/week**
- Mid-game robot (500 battles, 2,500 fame, Studio L5): 7 × ₡3,375 = **₡23,625/week**
- Veteran robot (1,000 battles, 5,000 fame, Studio L10): 7 × ₡8,000 = **₡56,000/week**

**Design Note**: Per-battle streaming rewards active participation and scales naturally with robot experience. Multi-robot strategies benefit from more total battles (more opportunities to earn), while single-robot strategies benefit from higher individual robot stats. 

### 5. Tournament Winnings

**Status**: Tournament system not yet fully defined. Specifications below are preliminary and subject to change during tournament feature implementation.

**Tournament Types and Rewards** (preliminary):

| Tournament Type | Credits Prize | Prestige Bonus |
|----------------|--------------|----------------|
| Local | ₡50,000 - ₡100,000 | +100 |
| Regional | ₡150,000 - ₡300,000 | +250 |
| National | ₡400,000 - ₡800,000 | +500 |
| International | ₡1,000,000 - ₡2,000,000 | +1,000 |
| World Championship | ₡3,000,000 - ₡5,000,000 | +2,500 |

**Tournament Access**:
- Unlocked via Booking Office facility levels
- Higher levels provide access to higher-tier tournaments
- Booking Office also provides tournament reward bonuses (+10% to +40% at high levels)

### 6. Achievement Rewards

**Status**: Achievement system not yet fully defined. Specifications below are preliminary examples and subject to change during achievement feature implementation.

**Milestone Examples** (preliminary):
- First robot to ELO 1500: ₡50,000 + 50 prestige
- First robot to ELO 1800: ₡100,000 + 100 prestige
- First robot to ELO 2000: ₡200,000 + 200 prestige
- 100 total wins: ₡75,000 + 50 prestige
- 500 total wins: ₡300,000 + 250 prestige
- 1,000 total wins: ₡750,000 + 500 prestige

**Design Note**: Achievement rewards are one-time bonuses that encourage progression and provide economic boosts at key milestones.

---

## Prestige & Fame System

> **For complete prestige and fame system specification**: See **[PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)** - the authoritative document for earning mechanics, benefits, and implementation status.

This section provides a brief summary for economic context. For detailed implementation, see the PRD above.

### Fame (Robot-Level Reputation)

**Definition**: Individual robot reputation earned from victories and performance.

**Earning Fame**:
- Win in Bronze league: +5 fame
- Win in Silver league: +10 fame
- Win in Gold league: +20 fame
- Win in Platinum league: +30 fame
- Win in Diamond league: +50 fame
- Win in Champion league: +75 fame

**Fame Uses**:
- Contributes to streaming revenue (aggregate across all robots)
- Displayed on robot profile for competitive rankings
- Used in matchmaking considerations
- Trophy/leaderboard display

**Note**: Fame is tracked per robot and aggregated for stable-level calculations (e.g., streaming revenue).

### Prestige (Stable-Level Reputation)

**Definition**: Account-wide reputation representing overall stable success and history. Prestige is **never spent** - only checked as unlock threshold.

**Earning Prestige - Battle Performance** (per win):
- Win in Bronze league: +5 prestige
- Win in Silver league: +10 prestige
- Win in Gold league: +20 prestige
- Win in Platinum league: +30 prestige
- Win in Diamond league: +50 prestige
- Win in Champion league: +75 prestige

**Earning Prestige - Tournament Performance**:
- Local tournament win: +100 prestige
- Regional tournament win: +250 prestige
- National tournament win: +500 prestige
- International tournament win: +1,000 prestige
- World Championship win: +2,500 prestige

**Earning Prestige - Milestones**:
- First robot to ELO 1500: +50 prestige
- First robot to ELO 1800: +100 prestige
- First robot to ELO 2000: +200 prestige
- 100 total wins (across all robots): +50 prestige
- 500 total wins: +250 prestige
- 1,000 total wins: +500 prestige

### Prestige Benefits

**1. Facility Level Unlocks**:
Prestige unlocks higher facility levels (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md) for complete list). Examples:
- Repair Bay Level 4: Requires 1,000 prestige
- Repair Bay Level 7: Requires 5,000 prestige
- Repair Bay Level 9: Requires 10,000 prestige
- Research Lab Level 9: Requires 15,000 prestige
- Booking Office Level 7: Requires 25,000 prestige

**2. Income Multipliers**:
- **Battle Winnings**: +5% to +20% (see Prestige Bonuses section above)
- **Merchandising**: Scales with prestige (see Merchandising Income section above)

**3. Content Access**:
- Tournament access via Booking Office facility
- Exclusive cosmetic options at high prestige levels
- Special challenges and events

### Prestige Accumulation Timeline

**Realistic Path to Key Thresholds**:

**5,000 Prestige** (~6-12 months):
- Bronze/Silver: 100 wins = +500-1,000 prestige
- Gold: 50 wins = +1,000 prestige
- Achievements: First milestones = +500-1,000 prestige
- Tournaments: 5-10 local/regional = +500-2,500 prestige

**10,000 Prestige** (~12-18 months):
- Continued league wins in Gold/Platinum
- Multiple tournament victories
- Major win milestones (500 total wins)
- High ELO achievements

**25,000 Prestige** (~2-3 years):
- Advanced league performance (Platinum/Diamond)
- National/International tournaments
- 1,000+ total wins
- Multiple high-ELO robots

**50,000 Prestige** (~3-5 years):
- Champion league performance
- World Championship participation
- Complete stable mastery

### 7. Potential Future Revenue Streams

**Not Yet Implemented** (for future phases):
- **Trading Commission**: Earn ₡ from weapon/robot sales on marketplace
- **Sponsorship Deals**: High-prestige stables attract sponsors for daily income
- **Arena Attendance**: Popular robots earn gate revenue from spectators
- **Championship Bonuses**: End-of-season rewards based on league placement
- **Daily Login Bonuses**: Small Credits bonus for consecutive daily logins

---

## Daily Financial System

### Daily Report Structure

Players receive a **daily financial report** showing all income and expenses. This can be presented:
1. **After each battle session** (MVP implementation)
2. **Once per real-world day** (when daily cycles are implemented)
3. **On-demand via Dashboard** (accessible anytime)

### Report Format

```
═══════════════════════════════════════
         DAILY STABLE REPORT
         [Date: February 2, 2026]
═══════════════════════════════════════

REVENUE STREAMS:
  Battle Winnings:         ₡45,000
  Prestige Bonus (10%):    ₡4,500
  Streaming (per battle):  ₡27,000 (from 7 battles)
  Merchandising:           ₡30,000
  ─────────────────────────────────
  Total Revenue:           ₡106,500

OPERATING COSTS:
  Repair Bay (Lvl 5):      ₡3,500
  Training Facility (Lvl 4): ₡4,500
  Weapons Workshop (Lvl 3): ₡2,000
  Research Lab (Lvl 2):    ₡3,000
  Medical Bay (Lvl 2):     ₡3,000
  Roster Expansion (4):    ₡1,500
  Coaching Staff (active): ₡3,000
  Combat Academy (Lvl 3):  ₡1,600
  Defense Academy (Lvl 2): ₡1,200
  Mobility Academy (Lvl 2): ₡1,200
  AI Academy (Lvl 1):      ₡1,000
  Income Generator (Lvl 5): ₡3,500
  Streaming Studio (Lvl 5): ₡500
  ─────────────────────────────────
  Total Operating Costs:   ₡29,500

REPAIRS:
  Robot "Thunder":         ₡8,500
  Robot "Blitz":           ₡12,000
  ─────────────────────────────────
  Total Repair Costs:      ₡20,500

═══════════════════════════════════════
NET INCOME:                ₡56,500
CURRENT BALANCE:           ₡1,904,000
═══════════════════════════════════════

Financial Health: Excellent ✅
Daily profit margin: 53%
Days until bankruptcy (if income stops): 67 days
```

**Per-Robot Revenue/Expense Tracking** (Advanced):

For multi-robot stables, the financial report should support per-robot breakdown:

```
═══════════════════════════════════════
    PER-ROBOT FINANCIAL BREAKDOWN
═══════════════════════════════════════

ROBOT "THUNDER":
  Battle Winnings:         ₡25,000
  Streaming (500 battles): ₡12,000 (from 4 battles)
  Merchandising (fame 5K): ₡8,000
  ─────────────────────────────────
  Robot Revenue:           ₡45,000
  
  Repair Costs:            ₡8,500
  Allocated Facilities*:   ₡5,900
  ─────────────────────────────────
  Robot Net:               ₡30,600 ✅
  
ROBOT "BLITZ":
  Battle Winnings:         ₡20,000
  Streaming (300 battles): ₡7,040 (from 3 battles)
  Merchandising (fame 3K): ₡6,400
  ─────────────────────────────────
  Robot Revenue:           ₡33,440
  
  Repair Costs:            ₡12,000
  Allocated Facilities*:   ₡5,900
  ─────────────────────────────────
  Robot Net:               ₡15,540 ✅
  
*Facilities costs split evenly across robots
═══════════════════════════════════════
```

**User Spending Breakdown** (Separate Section):

Track voluntary spending (investments vs operating costs):

```
WEEKLY SPENDING SUMMARY:
  Attribute Upgrades:      ₡45,000
  New Weapons Purchased:   ₡180,000
  Facility Upgrades:       ₡400,000
  New Robot Created:       ₡0
  ─────────────────────────────────
  Total Investments:       ₡625,000
```

This helps players understand where they're allocating resources for growth vs maintenance costs.

### Financial Health Indicators

**Status Levels**:
- **Excellent** (✅): Net positive income, balance > ₡1M
- **Good** (✅): Net positive income, balance ₡500K-₡1M
- **Stable** (⚠️): Break-even or slight profit, balance ₡100K-₡500K
- **Warning** (⚠️): Net negative income, balance ₡50K-₡100K
- **Critical** (❌): Heavy losses, balance < ₡50K

**Metrics to Display**:
1. **Net Income**: Total revenue - total costs
2. **Profit Margin**: (Net income / Total revenue) × 100%
3. **Days to Bankruptcy**: Current balance / daily costs (if income stops)
4. **Revenue Breakdown**: Percentage of income from each source
5. **Cost Breakdown**: Percentage of expenses by category

### Economic Alerts

**Alert Types**:
1. **Low Balance Warning**: Balance < ₡100,000
2. **Negative Cash Flow**: Daily costs exceed daily income
3. **Unprofitable Facilities**: Operating costs > benefits (e.g., coach cost exceeds value)
4. **High Repair Costs**: Repairs exceed 50% of daily income
5. **Investment Opportunities**: Can afford beneficial facility upgrades

**Example Alert**:
```
⚠️ ECONOMIC ALERT: Low Balance Warning
Current balance: ₡85,000
Estimated daily costs: ₡29,000
You have approximately 3 days of operating costs remaining.

Recommendations:
- Win more battles to increase income
- Consider disabling expensive coach (₡3,000/day)
- Repair only critical robots
- Upgrade Income Generator for passive income
```

### Dashboard Presentation

**Stable Dashboard** should include:
1. **Current Balance** (large, prominent display)
2. **Daily Income Summary** (collapsed by default, expandable)
3. **Net Income Trend** (7-day or 30-day chart)
4. **Financial Health Status** (icon + label)
5. **Quick Actions**: "View Full Report", "Economic Projections"

**Economic Dashboard Page** (separate page):
1. **Detailed Financial Report** (current day)
2. **Historical Data** (charts showing income/expense trends)
3. **Revenue Stream Analysis** (pie chart of income sources)
4. **Cost Center Analysis** (pie chart of expense categories)
5. **Projections** (estimated income/costs for next 7/30 days)
6. **Break-Even Analysis** (what income is needed to cover costs)
7. **Investment ROI Calculator** (facility upgrade payoff time)

---

## Economic Balance & Progression

### Early Game Economics (Days 1-30)

**Starting Budget**: ₡3,000,000 (increased Feb 8, 2026 - see [OPTION_C_IMPLEMENTATION.md](../OPTION_C_IMPLEMENTATION.md))

**Recommended Spending**:
- 1 Robot: ₡500,000
- 1 Good weapon: ₡150,000-₡300,000
- Repair Bay Level 1: ₡200,000
- Training Facility Level 1: ₡300,000 (optional but recommended)
- Attribute upgrades: ₡300,000-₡500,000
- Reserve for operations: ₡500,000

**Income Sources**:
- Bronze/Silver league battles: ₡5,000-₡15,000 per win
- Per-battle streaming: ₡1,000-₡1,500 per battle (new robot, no Streaming Studio)
- **Battle frequency**: 1 battle per robot per day (7 battles/week)
- Expected wins at 50% win rate: 3.5 wins/week
- Weekly battle income: 3.5 × ₡8,000 avg = ₡28,000/week
- Weekly streaming income: 7 × ₡1,000 = ₡7,000/week
- **Total weekly income**: ₡35,000/week (₡5,000/day)

**Operating Costs**:
- Repair Bay Level 1: ₡1,000/day
- Repairs (7 battles at avg ₡3,500): ₡24,500/week (₡3,500/day)
- **Daily total**: ~₡4,500/day

**Net Result**: Positive cash flow with 50% win rate (~₡3,500/week surplus)

**Balance Verification** (50% win rate profitability):
- Daily income: ₡5,000 (₡4K battles + ₡1K streaming)
- Daily costs: ₡4,500 (₡1K facility + ₡3.5K repairs)
- **Surplus**: +₡500/day (+₡3,500/week)
- **Coverage**: 111% (exceeds target 90%)

**Note**: Per-battle streaming revenue improves early game sustainability by providing guaranteed income regardless of win/loss outcome. 

### Mid Game Economics (Days 30-120)

**Typical Balance**: ₡3M-₡8M accumulated

**Investment Strategy**:
- Expand to 3-4 robots: ₡1,500,000-₡2,000,000
- Upgrade key facilities to Level 3-5: ₡2,000,000-₡4,000,000
- Purchase premium weapons: ₡800,000-₡1,500,000
- Unlock Income Generator: ₡800,000 (provides merchandising passive income)
- Optional: Streaming Studio Level 1-3: ₡600,000 (boosts per-battle streaming)

**Income Sources**:
- Gold/Platinum league battles: ₡20,000-₡60,000 per win
- Per-battle streaming: ₡2,000-₡4,000 per battle (experienced robots, Studio Level 3)
- Merchandising income: ₡10,000-₡25,000/day (from Income Generator)
- Tournament winnings: ₡50,000-₡300,000 (occasional)
- **Total**: ₡40,000-₡80,000/day

**Operating Costs**:
- Facilities: ₡15,000-₡25,000/day
- Repairs: ₡10,000-₡30,000 per battle
- Daily total: ~₡20,000-₡40,000/day

**Net Result**: Profitable operations, can save for major upgrades

### Late Game Economics (Days 120+)

**Typical Balance**: ₡10M-₡50M accumulated

**Investment Strategy**:
- Max out critical facilities: ₡10,000,000-₡20,000,000
- 6-10 robot roster: ₡3,000,000-₡5,000,000
- Premium weapon collection: ₡3,000,000-₡5,000,000
- Custom weapon crafting: ₡1,000,000-₡3,000,000 per weapon
- Streaming Studio Level 10: ₡5,500,000 (doubles per-battle streaming)
- Prestige-locked content: Access to highest tournaments

**Income Sources**:
- Diamond/Champion league battles: ₡80,000-₡250,000 per win
- High-prestige multiplier: +15-20% on all winnings
- Per-battle streaming: ₡6,000-₡12,000 per battle (veteran robots, Studio Level 10)
- Merchandising income: ₡40,000-₡80,000/day (from Income Generator)
- Tournament winnings: ₡500,000-₡2,000,000 (weekly)
- **Total**: ₡150,000-₡400,000/day

**Operating Costs**:
- Facilities: ₡40,000-₡60,000/day
- Repairs: ₡20,000-₡50,000 per battle
- Daily total: ~₡50,000-₡80,000/day

**Net Result**: Highly profitable, focus on optimization and prestige

### Facility Investment ROI

**Payback Period Examples** (Revised with correct battle frequency):

1. **Repair Bay Level 1** (₡200,000):
   > **For complete repair cost formulas, facility discounts, and ROI analysis**: See **Section 5 "Repair Costs"** in the Cost Centers section above. Includes detailed payback calculations for single and multi-robot scenarios, Medical Bay integration, and worked examples.
  
2. **Training Facility Level 1** (₡300,000):
   - Saves 5% on upgrades (varies: ₡2K-₡50K saved depending on level)
   - Example: Upgrading 1→10 saves ₡2,700 per attribute (₡54K × 5%)
   - For 23 attributes (1→10): Saves ₡62,100
   - **Payback**: Would need to upgrade ~5 robots from 1→10
   - **Best for**: Players planning multiple robots or high-level upgrades (15-50)
   - **Early game**: Not cost-effective (as calculated in section 1)
   
3. **Income Generator Level 1** (₡800,000):
   - **Merchandising**: ₡5,000/day base - ₡1,000 operating cost = ₡4,000 net/day
   - Scales with prestige: At 10K prestige → ₡5,000 × 2.0 = ₡10,000/day (₡9,000 net)
   - **Base payback**: 200 days (with no prestige scaling)
   - **Realistic payback** (moderate prestige): 89-100 days
   - **With high prestige** (50K): 40-50 days
   - **Note**: Income Generator no longer provides streaming revenue (now per-battle)
   - **Combined assessment**: Strong mid-game investment, scales well with prestige
   - **Recommendation**: Purchase when prestige reaches 5,000-10,000 range

4. **Streaming Studio Level 1** (₡100,000):
   - Provides +10% to per-battle streaming revenue
   - Example: Robot earning ₡2,000/battle → +₡200/battle
   - At 7 battles/week: +₡1,400/week gain
   - Operating cost: ₡100/day = ₡700/week
   - Net weekly gain: ₡700/week
   - **Payback**: ₡100,000 / ₡700 = 143 weeks
   - **Better with**: Multiple robots (more battles/week) or higher robot stats
   - **Recommendation**: Mid-to-late game investment after Income Generator
   
5. **Weapons Workshop Level 1** (₡250,000):
   - Saves 5% on weapons (₡5K-₡20K per weapon)
   - Average weapon cost: ₡200K → saves ₡10K per purchase
   - Payback: **25 weapon purchases**
   - **Multi-robot context**: 3 robots × 2 weapons = 6 weapons minimum
   - With loadout changes/testing: 10-15 weapons over time
   - **Payback timeline**: **2-3 years** for typical player
   - **Conclusion**: Low priority unless frequently experimenting with weapons or running 4+ robots

**General Rule**: 
- **Discount facilities** require high usage frequency or multiple robots to justify
- **Income facilities** scale with stable prestige and robot activity (battles/fame aggregates)
- **Academy facilities** provide immediate benefit (cap unlock) beyond long-term savings

**Early Game Priority**:
1. **Repair Bay** - Only if planning 2+ robots soon
2. **One Academy** - Only if stuck at level 10 cap in key attributes
3. **Skip Income Generator** - Requires prestige to be effective
4. **Focus on robot power first** - Attributes and weapons

---

## Implementation Recommendations

### Phase 1: Core Economic Tracking 

**Priority**: High  

1. **Backend Implementation**:
   - Track all costs and revenue in database
   - Calculate daily operating costs based on facilities
   - Generate daily financial report data structure
   - Store historical financial data (daily snapshots)

2. **API Endpoints**:
   ```
   GET /api/stable/:userId/finances/daily - Get today's financial report
   GET /api/stable/:userId/finances/history - Get historical data
   GET /api/stable/:userId/finances/summary - Get quick summary
   ```

3. **Frontend Components**:
   - `FinancialReport` component (daily report display)
   - `FinancialHealthBadge` component (status indicator)
   - Integrate into Stable Dashboard

4. **User Education**:
   - Tooltip on each revenue/cost line item
   - Link to documentation for complex formulas
   - "What is this?" helper text

### Phase 2: Economic Dashboard 

**Priority**: Medium  

1. **Analytics & Visualization**:
   - Historical trend charts (Chart.js or Recharts)
   - Revenue stream breakdown (pie charts)
   - Cost center breakdown (pie charts)
   - Net income trend line (7-day, 30-day, all-time)

2. **Projections & Forecasting**:
   - Calculate future income based on current stats
   - Project facility upgrade payoff times
   - "What-if" scenarios (e.g., "If I buy this facility...")

3. **Alerts & Notifications**:
   - Low balance warnings
   - Negative cash flow alerts
   - Investment opportunity notifications

### Phase 3: Advanced Features 

**Priority**: Low  

1. **Budget Planning**:
   - Set budgets for repairs, upgrades, weapons
   - Track spending against budget
   - Alerts when exceeding budget

2. **Financial Goals**:
   - Set savings targets (e.g., "Save ₡5M for facility")
   - Track progress toward goal
   - Recommend actions to reach goal faster

3. **Economic Leaderboards**:
   - Richest stables
   - Most profitable stables
   - Highest daily income

4. **Trading System** (major feature):
   - Buy/sell robots and weapons between players
   - Marketplace with dynamic pricing
   - Commission fees on transactions

---

## Success Metrics

### Player Understanding (Qualitative)

**Goal**: 90% of players understand basic economy

**Metrics**:
- % of players who view daily financial report
- % of players who make facility purchases
- Player survey: "Do you understand where your money comes from/goes?"
- Tutorial completion rate for economy section

### Economic Health (Quantitative)

**Goal**: Majority of active players maintain positive cash flow

**Metrics**:
- % of players with positive net income (target: >70%)
- % of players with balance > ₡100,000 (target: >80%)
- Average balance by activity level (daily/weekly/monthly players)
- % of players who go bankrupt (target: <5%)

### Engagement Metrics

**Goal**: Economy drives strategic decision-making

**Metrics**:
- Facility upgrade rate (target: 1-2 upgrades per week per player)
- Average number of facilities owned (target: 4-6 by day 30)
- Weapon purchase rate (target: 1-2 per week)
- Repair decision patterns (Do players use yield threshold strategically?)

### Balance Metrics

**Goal**: All revenue streams contribute meaningfully

**Metrics**:
- Revenue breakdown: Battle winnings vs passive income (target: 60/40 split)
- % of players using Income Generator (target: >60% by day 60)
- Average daily income by game stage (early/mid/late)
- Facility ROI analysis (which facilities are most popular?)

---

## Appendices

### Appendix A: Complete Cost Formula Summary

```javascript
// Robot purchase
robot_cost = 500000;

// Attribute upgrade (Updated Feb 8, 2026)
upgrade_cost = (current_level + 1) * 1500 * (1 - training_facility_discount);

// Weapon purchase
weapon_cost = base_price * (1 - weapons_workshop_discount);

// Facility purchase
facility_cost = [defined per facility level];

// Repair cost
base_repair = sum_of_attributes * 100;
damage_pct = damage_taken / max_hp;
condition_multiplier = (hp === 0) ? 2.0 : (hp < max_hp * 0.1) ? 1.5 : 1.0;

// Apply Medical Bay to critical multiplier
if (hp === 0 && medical_bay_level > 0) {
    medical_reduction = medical_bay_level * 0.1;
    condition_multiplier = 2.0 * (1 - medical_reduction);
}

repair_before_discount = base_repair * damage_pct * condition_multiplier;

// Apply Repair Bay discount
repair_bay_discount = repair_bay_level * 0.05;
final_repair = repair_before_discount * (1 - repair_bay_discount);

// Daily operating costs
daily_operating = sum_of_facility_operating_costs;
```

### Appendix B: Complete Revenue Formula Summary

```javascript
// Battle winnings
base_reward = [defined by league tier, 5000-300000];
prestige_multiplier = (prestige >= 50000) ? 1.20 : 
                      (prestige >= 25000) ? 1.15 :
                      (prestige >= 10000) ? 1.10 :
                      (prestige >= 5000) ? 1.05 : 1.0;
battle_reward = base_reward * prestige_multiplier;

// Merchandising income
base_merchandising = [defined by Income Generator level];
prestige_mult = 1 + (prestige / 10000);
merchandising_daily = base_merchandising * prestige_mult;

// Streaming income
base_streaming = [defined by Income Generator level];
battle_mult = 1 + (total_battles / 1000);
fame_mult = 1 + (total_fame / 5000);
streaming_daily = base_streaming * battle_mult * fame_mult;

// Total daily revenue
total_revenue = battle_winnings + merchandising_daily + streaming_daily + achievements;
```

### Appendix C: Glossary

- **Credits (₡)**: Primary currency, used for all purchases
- **Prestige**: Secondary resource, unlocks content, never spent
- **Stable**: Player's account/collection of robots
- **Facility**: Upgradeable building providing benefits
- **Operating Cost**: Daily recurring cost to maintain facilities
- **Net Income**: Total revenue minus total costs
- **Profit Margin**: Percentage of revenue that is profit
- **ROI (Return on Investment)**: Time to recoup facility purchase cost
- **Yield Threshold**: HP% where robot surrenders (affects repair costs)
- **Critical Damage**: Robot destroyed (HP = 0), 2x repair multiplier

---

## See Also

- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)** - Complete facility system, prestige, daily income examples
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)** - Attribute upgrade costs, repair formulas
- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)** - Weapon catalog with prices
- **[GAME_DESIGN.md](GAME_DESIGN.md)** - Overall game design philosophy
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Data model for economic tracking
- **[PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)**: Complete prestige and fame system specification (earning, benefits)

---

**This economy system provides:**
- ✅ Clear cost structure for all player actions
- ✅ Multiple revenue streams (active and passive)
- ✅ Daily financial reporting for transparency
- ✅ Strategic depth through facility investments
- ✅ Risk/reward balance (yield thresholds, aggressive expansion)
- ✅ Long-term progression goals (facility maxing, prestige unlocks)
- ✅ Economic sustainability (players can operate profitably)
- ✅ Meaningful choices (which facilities to prioritize)
