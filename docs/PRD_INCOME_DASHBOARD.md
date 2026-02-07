# Product Requirements Document: Income Dashboard (Stable Financial Report)

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: 1.0  
**Date**: February 7, 2026  
**Author**: GitHub Copilot  
**Status**: Draft - Awaiting Implementation

---

## Version History
- v1.0 - Initial draft by GitHub Copilot

---

## Executive Summary

The Income Dashboard (also known as Stable Financial Report or Daily Stable Report) is a comprehensive financial tracking and reporting system that provides players with detailed insights into their stable's economic performance. This PRD addresses current terminology inconsistencies, missing features, and navigation issues, while aligning with the design vision outlined in PRD_ECONOMY_SYSTEM.md.

**Key Goals:**
- Establish consistent terminology across the application
- Implement complete financial reporting with per-robot breakdown
- Fix navigation inconsistencies (route mismatch between `/income` placeholder and `/finances` actual route)
- Align implementation with the "Daily Stable Report" design from PRD_ECONOMY_SYSTEM.md
- Provide actionable insights and recommendations for economic decision-making
- Create a scalable foundation for future advanced analytics features

---

## Current State Analysis

### Terminology Confusion

**Problem**: Three different names are used for the same feature across the codebase:

| Location | Name Used | Status |
|----------|-----------|--------|
| Navigation Menu (`Navigation.tsx` line 67) | "Income Dashboard" | ❌ Placeholder - route not implemented |
| App Routes (`App.tsx` line 133) | "Financial Report" (via `/finances` route) | ✅ Implemented |
| PRD_ECONOMY_SYSTEM.md | "Daily Stable Report" | 📋 Design specification |
| Current Page (`FinancialReportPage.tsx` line 88) | "Financial Report" | ✅ Implemented |

**Impact**: Confusion for developers and future players, broken navigation links, inconsistent documentation.

### Route Mismatch

**Current State**:
- Navigation menu shows **"Income Dashboard"** linking to `/income` (not implemented)
- Actual route is **`/finances`** which renders `FinancialReportPage`
- Only accessible via Dashboard's FinancialSummary component link

**Problem**: Clicking "Income Dashboard" in the navigation menu results in a 404 or unimplemented page error.

### Current Implementation Strengths

The existing `/finances` route (`FinancialReportPage.tsx`) provides:

✅ **Financial Health Overview**: Color-coded status (Excellent/Good/Stable/Warning/Critical)  
✅ **Current Balance**: Prominent display of user's credits  
✅ **Revenue Breakdown**: Battle winnings, prestige bonus, merchandising, streaming  
✅ **Expense Breakdown**: Operating costs and repairs  
✅ **Net Income Calculation**: Total revenue minus expenses  
✅ **Profit Margin**: Percentage-based profitability metric  
✅ **Days to Bankruptcy**: Financial runway indicator  
✅ **Operating Costs Breakdown**: Per-facility cost listing  
✅ **Financial Projections**: Weekly and monthly forecasts  
✅ **AI-Powered Recommendations**: Actionable suggestions based on financial health  
✅ **Professional UI**: Tailwind-styled, responsive design  
✅ **API Integration**: Real-time data from backend `/api/finances/*` endpoints

### Current Implementation Gaps

❌ **Per-Robot Financial Breakdown**: No individual robot revenue/expense tracking  
❌ **Incomplete Data Processing**: Only current balance processed, other fields may be incomplete  
❌ **Daily Stable Report Format**: Current UI doesn't match the "Daily Stable Report" design from PRD_ECONOMY_SYSTEM.md  
❌ **User Spending Breakdown**: No tracking of voluntary investments (attribute upgrades, weapon purchases, facility upgrades)  
❌ **Historical Trends**: No charts or graphs showing income/expense over time  
❌ **Revenue Source Analysis**: No pie charts or visual breakdowns of income sources  
❌ **Economic Alerts**: No proactive warnings for low balance, negative cash flow, or investment opportunities  
❌ **Investment ROI Calculator**: No tool to estimate facility upgrade payoff time  
❌ **Break-Even Analysis**: No calculation of minimum income needed to cover costs  
❌ **Navigation Consistency**: Not accessible from nav menu, only from dashboard

---

## Terminology Resolution & Naming Convention

### Recommended Name: **"Income Dashboard"**

**Rationale**:
1. **Player-Facing Clarity**: "Income" is more intuitive than "Financial Report" or "Stable Report"
2. **Navigation Consistency**: Already used in the navigation menu placeholder
3. **Purpose-Driven**: Emphasizes the primary function (tracking income and finances)
4. **Industry Standard**: Common term in simulation/management games

### Secondary Name: **"Stable Financial Report"** (Technical/Internal)

**Usage**: Documentation, backend APIs, database tables

### Deprecated Names

| Name | Status | Migration |
|------|--------|-----------|
| "Financial Report" | Deprecated | Update page title, route name |
| "Daily Stable Report" | Internal/Design Spec | Use for report format specification |

### Implementation Changes Required

1. **Navigation Menu**: Keep "Income Dashboard" label, fix route to `/income` (create redirect from `/finances`)
2. **Page Title**: Update `FinancialReportPage.tsx` title from "Financial Report" to "Income Dashboard"
3. **Route Path**: Primary route `/income`, maintain `/finances` as redirect for backwards compatibility
4. **Documentation**: Update all references in docs to "Income Dashboard" or "Stable Financial Report"
5. **API Endpoints**: Keep existing `/api/finances/*` endpoints (no change needed - internal naming is fine)

---

## Proposed Income Dashboard Structure

### Tab-Based Layout (Recommended)

```
╔════════════════════════════════════════════════════════════════╗
║ INCOME DASHBOARD                           [Refresh] [Export]  ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║ [Overview] [Per-Robot] [Investments] [Projections] [Alerts]   ║
║ ─────────                                                      ║
║                                                                ║
║  ... tab content ...                                           ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

### Tab 1: Overview (Default View)

**Purpose**: At-a-glance financial health and daily summary

**Content**:
- **Financial Health Status**
  - Large, color-coded indicator (Excellent ✅ / Good ✅ / Stable ⚠️ / Warning ⚠️ / Critical ❌)
  - Current balance (prominent display)
  - Financial health description and guidance

- **Daily Stable Report** (mimics PRD_ECONOMY_SYSTEM.md format)
  ```
  ═══════════════════════════════════════
           DAILY STABLE REPORT
           [Date: February 7, 2026]
  ═══════════════════════════════════════
  
  REVENUE STREAMS:
    Battle Winnings:         ₡45,000
    Prestige Bonus (10%):    ₡4,500
    Merchandising:           ₡30,000
    Streaming:               ₡27,000
    ─────────────────────────────────
    Total Revenue:           ₡106,500
  
  OPERATING COSTS:
    Repair Bay (Lvl 5):      ₡3,500
    Training Facility (Lvl 4): ₡4,500
    [... all facilities ...]
    ─────────────────────────────────
    Total Operating Costs:   ₡29,000
  
  REPAIRS:
    Robot "Thunder":         ₡8,500
    Robot "Blitz":           ₡12,000
    ─────────────────────────────────
    Total Repair Costs:      ₡20,500
  
  ═══════════════════════════════════════
  NET INCOME:                ₡57,000
  CURRENT BALANCE:           ₡1,904,000
  ═══════════════════════════════════════
  
  Financial Health: Excellent ✅
  Daily profit margin: 54%
  Days until bankruptcy: 67 days
  ```

- **Quick Metrics Cards** (3 columns)
  - Total Revenue (green highlight)
  - Total Expenses (red highlight)
  - Net Income (green/red based on positive/negative)

- **Revenue Pie Chart** (visual breakdown)
  - Battle Winnings
  - Prestige Bonus
  - Merchandising
  - Streaming
  - Other

- **Expense Pie Chart** (visual breakdown)
  - Operating Costs (by facility type)
  - Repairs (aggregate)

### Tab 2: Per-Robot Breakdown

**Purpose**: Individual robot financial performance tracking

**Content**:
- **Robot Financial Cards** (one per robot)
  ```
  ╔═══════════════════════════════════════╗
  ║ ROBOT "THUNDER"                       ║
  ║ League: Gold Tier 2 | ELO: 1,645      ║
  ╠═══════════════════════════════════════╣
  ║ REVENUE:                              ║
  ║   Battle Winnings:     ₡25,000        ║
  ║   Merchandising:       ₡8,000         ║
  ║   Streaming:           ₡12,000        ║
  ║   ─────────────────────────────       ║
  ║   Robot Revenue:       ₡45,000        ║
  ║                                       ║
  ║ COSTS:                                ║
  ║   Repair Costs:        ₡8,500         ║
  ║   Allocated Facilities*: ₡5,800       ║
  ║   ─────────────────────────────       ║
  ║   Robot Costs:         ₡14,300        ║
  ║                                       ║
  ║ ═══════════════════════════════════   ║
  ║ NET INCOME:            ₡30,700 ✅     ║
  ║ ROI:                   68.2%          ║
  ╚═══════════════════════════════════════╝
  
  *Facilities costs split evenly across active robots
  ```

- **Performance Metrics**
  - Win rate (%)
  - Average earnings per battle
  - Total battles fought (this cycle)
  - Fame contribution to streaming
  - Repair cost percentage (repairs / revenue)

- **Robot Ranking** (by profitability)
  - List robots from most profitable to least profitable
  - Highlight robots in negative territory (losses)

- **Recommendation Engine** (per robot)
  - "Thunder is highly profitable - consider entering tournaments"
  - "Blitz has high repair costs - visit Medical Bay for discounts"
  - "Nova has low battle frequency - increase training to maximize streaming revenue"

### Tab 3: Investments & Spending

**Purpose**: Track voluntary spending vs passive costs

**Content**:
- **Weekly Spending Summary**
  ```
  INVESTMENT BREAKDOWN (Last 7 Days):
    Attribute Upgrades:      ₡45,000
    New Weapons Purchased:   ₡180,000
    Facility Upgrades:       ₡400,000
    New Robot Created:       ₡0
    ─────────────────────────────────
    Total Investments:       ₡625,000
  ```

- **Investment vs Operating Costs Chart**
  - Bar chart comparing voluntary investments to passive operating costs
  - Shows spending trends over time

- **Facility Upgrade ROI Calculator**
  - Input: Facility type and desired level
  - Output: 
    - Upgrade cost
    - Daily cost increase
    - Daily benefit increase
    - Break-even time (days to recover investment)
    - Net benefit over 30/90 days

  **Example**:
  ```
  INCOME GENERATOR UPGRADE
  Current: Level 5 → Target: Level 6
  
  Upgrade Cost:              ₡800,000
  Daily Cost Increase:       ₡500 (₡3,500 → ₡4,000)
  Daily Benefit Increase:    ₡6,000 (₡12,000 → ₡18,000)
  Net Daily Gain:            ₡5,500
  
  Break-Even Time:           145 days (~5 months)
  30-Day Net:                -₡635,000 (investment period)
  90-Day Net:                ₡95,000 (profit phase)
  
  Recommendation: ✅ Worth it if prestige ≥ 5,000
  ```

- **Recent Transactions Log**
  - Last 10 purchases (weapons, facility upgrades, attribute upgrades)
  - Sortable by date, amount, type

### Tab 4: Projections & Trends

**Purpose**: Historical data and future forecasts

**Content**:
- **Income Trend Chart** (7-day, 30-day, 90-day toggles)
  - Line graph showing daily revenue over time
  - Color-coded sections: Battle winnings (green), Passive income (blue)

- **Expense Trend Chart**
  - Line graph showing daily expenses over time
  - Color-coded sections: Operating costs (orange), Repairs (red)

- **Net Income Trend Chart**
  - Combined graph showing revenue minus expenses
  - Positive/negative fill colors
  - Break-even line at ₡0

- **Financial Projections**
  - **Weekly Projection**: Expected income/costs for next 7 days
  - **Monthly Projection**: Expected income/costs for next 30 days
  - **Best Case Scenario**: If win rate increases by 10%
  - **Worst Case Scenario**: If win rate decreases by 10%

- **Economic Milestones**
  - "At current rate, you'll reach ₡2M balance in 23 days"
  - "At current expenses, you can sustain ₡500K facility upgrade"
  - "Income Generator Level 6 is affordable in 45 days with current savings rate"

### Tab 5: Alerts & Recommendations

**Purpose**: Proactive economic guidance and warnings

**Content**:
- **Active Economic Alerts**
  
  **Alert Types**:
  1. **Low Balance Warning** (❌ Critical)
     - Trigger: Balance < ₡100,000
     - Message: "Low balance warning. You have approximately X days of operating costs remaining."
  
  2. **Negative Cash Flow** (⚠️ Warning)
     - Trigger: Daily costs > daily income
     - Message: "Your daily expenses exceed your income. Consider disabling expensive facilities or winning more battles."
  
  3. **Unprofitable Facilities** (⚠️ Warning)
     - Trigger: Facility operating cost > benefit (e.g., coach cost exceeds training value)
     - Message: "Coaching Staff (₡3,000/day) may not be providing sufficient value. Consider disabling until you have more robots."
  
  4. **High Repair Costs** (⚠️ Warning)
     - Trigger: Repairs > 50% of daily income
     - Message: "Repair costs are consuming 65% of your income. Consider upgrading Medical Bay or avoiding risky battles."
  
  5. **Investment Opportunity** (✅ Info)
     - Trigger: Can afford beneficial facility upgrade with positive ROI
     - Message: "You can afford Income Generator Level 6 (₡800K). ROI break-even in 145 days with ₡5,500/day net gain."
  
  6. **Prestige Threshold Reached** (🎉 Achievement)
     - Trigger: Accumulated prestige unlocks new facility levels
     - Message: "Congratulations! You've reached 5,000 prestige. Income Generator Level 6 is now unlocked."

- **AI-Powered Recommendations** (from existing API)
  - Ranked by priority (Critical → High → Medium → Low)
  - Actionable suggestions with links to relevant pages
  - Examples:
    - "Win more battles to increase income" → Link to Battle History
    - "Upgrade Income Generator for passive income" → Link to Facilities
    - "Repair only critical robots" → Link to Robots page with filter for damaged robots

- **Economic Health Score** (0-100)
  - Calculated based on multiple factors:
    - Balance / daily costs ratio (40%)
    - Profit margin (30%)
    - Revenue diversity (20%)
    - Investment activity (10%)
  - Visual gauge/meter showing score
  - Comparison to average players (if leaderboards exist)

---

## Proposed UX Improvements (Prioritized)

### Phase 1: Navigation & Terminology Fixes (Week 1)

**Goal**: Fix immediate navigation issues and establish consistent naming

**Tasks**:
- [x] Update Navigation menu: "Income Dashboard" label, route to `/income`
- [ ] Create route `/income` in `App.tsx` that renders `FinancialReportPage`
- [ ] Add redirect from `/finances` to `/income` for backwards compatibility
- [ ] Update page title in `FinancialReportPage.tsx`: "Financial Report" → "Income Dashboard"
- [ ] Update FinancialSummary component link: `/finances` → `/income`
- [ ] Add `/income` to `implementedPages` Set in `Navigation.tsx`
- [ ] Update all documentation references to use "Income Dashboard" terminology

**Risk**: Low - mostly frontend routing and text changes

### Phase 2: Complete Daily Stable Report Implementation (Week 2)

**Goal**: Implement the full "Daily Stable Report" format from PRD_ECONOMY_SYSTEM.md

**Tasks**:
- [ ] Redesign Overview tab to match Daily Stable Report format (ASCII-style box with sections)
- [ ] Ensure all revenue streams are calculated and displayed:
  - Battle Winnings (from battles)
  - Prestige Bonus (percentage calculation)
  - Merchandising (Income Generator facility)
  - Streaming (Income Generator facility)
- [ ] Ensure all operating costs are listed by facility
- [ ] Add repair costs breakdown by robot
- [ ] Calculate and display financial health indicators:
  - Net Income
  - Current Balance
  - Financial Health Status
  - Profit Margin
  - Days to Bankruptcy
- [ ] Add revenue and expense pie charts

**Risk**: Medium - requires backend API enhancements to provide complete data

### Phase 3: Per-Robot Financial Breakdown (Week 3)

**Goal**: Enable individual robot financial tracking

**Tasks**:
- [ ] Create "Per-Robot" tab in Income Dashboard
- [ ] Backend: Add `/api/finances/per-robot` endpoint
  - Calculate revenue per robot (battle winnings, merchandising contribution, streaming contribution)
  - Allocate facility costs evenly across active robots
  - Calculate repair costs per robot
  - Calculate net income and ROI per robot
- [ ] Frontend: Create robot financial cards showing revenue, costs, net income
- [ ] Add robot performance metrics (win rate, avg earnings per battle)
- [ ] Implement robot profitability ranking
- [ ] Add per-robot recommendations based on financial performance

**Risk**: Medium - requires new backend calculations and data aggregation

### Phase 4: Investments & Spending Tracking (Week 4)

**Goal**: Track voluntary spending vs passive costs

**Tasks**:
- [ ] Backend: Track user spending in database
  - Log attribute upgrades, weapon purchases, facility upgrades, robot creation
  - Create `/api/finances/investments` endpoint
- [ ] Frontend: Create "Investments" tab
- [ ] Display weekly spending summary
- [ ] Add investment vs operating costs chart
- [ ] Implement facility upgrade ROI calculator
  - Input fields for facility type and target level
  - Calculate upgrade cost, daily cost increase, daily benefit increase
  - Calculate break-even time and net benefit over time periods
- [ ] Add recent transactions log with sorting/filtering

**Risk**: High - requires database schema changes and transaction logging

### Phase 5: Projections & Trends (Week 5)

**Goal**: Add historical data and future forecasts

**Tasks**:
- [ ] Backend: Store daily financial snapshots in database
  - Create `DailyFinancialSnapshot` model
  - Capture revenue, expenses, balance at end of each day
  - Create `/api/finances/history` endpoint
- [ ] Frontend: Create "Projections" tab
- [ ] Add income trend chart (7/30/90-day views)
- [ ] Add expense trend chart
- [ ] Add net income trend chart with positive/negative fill
- [ ] Implement financial projections (weekly, monthly, best/worst case)
- [ ] Add economic milestone predictions

**Risk**: High - requires database schema changes and historical data storage

### Phase 6: Alerts & Recommendations (Week 6)

**Goal**: Proactive economic guidance

**Tasks**:
- [ ] Backend: Create alert detection system
  - Check for low balance, negative cash flow, unprofitable facilities, high repair costs
  - Create `/api/finances/alerts` endpoint
- [ ] Frontend: Create "Alerts" tab
- [ ] Display active economic alerts with priority levels
- [ ] Show AI-powered recommendations (already exists, move to this tab)
- [ ] Implement economic health score (0-100)
- [ ] Add visual gauge/meter for health score
- [ ] Add actionable links from alerts to relevant pages

**Risk**: Medium - requires backend alert logic and frontend UI

---

## Implementation Plan

### Phase 1: Quick Wins (Week 1)
**Goal**: Fix navigation and terminology issues

**Deliverables**:
- ✅ Navigation menu works correctly
- ✅ Consistent "Income Dashboard" naming across app
- ✅ Route `/income` implemented with backwards-compatible `/finances` redirect

**Success Criteria**:
- Clicking "Income Dashboard" in nav menu navigates to correct page
- All documentation uses "Income Dashboard" terminology
- No broken links or 404 errors

### Phase 2-3: Core Features (Weeks 2-3)
**Goal**: Complete Daily Stable Report and per-robot breakdown

**Deliverables**:
- ✅ Full Daily Stable Report format implemented
- ✅ Revenue and expense pie charts
- ✅ Per-robot financial tracking
- ✅ Robot profitability ranking

**Success Criteria**:
- All revenue streams and operating costs displayed accurately
- Per-robot breakdown shows individual robot profitability
- UI matches "Daily Stable Report" design from PRD_ECONOMY_SYSTEM.md

### Phase 4-6: Advanced Features (Weeks 4-6)
**Goal**: Add investments tracking, trends, and alerts

**Deliverables**:
- ✅ Investment tracking and ROI calculator
- ✅ Historical trends and projections
- ✅ Economic alerts and recommendations

**Success Criteria**:
- Users can track their spending vs passive costs
- Historical charts show income/expense trends over time
- Alerts proactively warn users of economic issues
- ROI calculator helps users make informed upgrade decisions

---

## Technical Considerations

### Frontend (React/TypeScript)

**Component Structure**:
```
src/pages/IncomeDashboardPage.tsx (renamed from FinancialReportPage.tsx)
├── OverviewTab.tsx
│   ├── DailyStableReport.tsx (ASCII-style report)
│   ├── FinancialHealthCard.tsx
│   ├── RevenuePieChart.tsx
│   └── ExpensePieChart.tsx
├── PerRobotTab.tsx
│   ├── RobotFinancialCard.tsx
│   └── RobotProfitabilityRanking.tsx
├── InvestmentsTab.tsx
│   ├── WeeklySpendingSummary.tsx
│   ├── InvestmentVsCostsChart.tsx
│   ├── ROICalculator.tsx
│   └── RecentTransactionsLog.tsx
├── ProjectionsTab.tsx
│   ├── IncomeTrendChart.tsx
│   ├── ExpenseTrendChart.tsx
│   ├── NetIncomeTrendChart.tsx
│   └── EconomicMilestones.tsx
└── AlertsTab.tsx
    ├── ActiveAlertsPanel.tsx
    ├── AIRecommendations.tsx
    └── EconomicHealthScore.tsx
```

**State Management**:
- Use React hooks (useState, useEffect) for component-local state
- Consider React Context for shared financial data across tabs
- Cache API responses to reduce backend load

**Charting Library**:
- Recommendation: **Chart.js** or **Recharts**
- Lightweight, TypeScript-friendly, good documentation
- Supports pie charts, line charts, bar charts

**Routing**:
- Primary route: `/income`
- Redirect: `/finances` → `/income`
- Tab state: Store active tab in URL hash (e.g., `/income#per-robot`) for shareable links

### Backend (Node.js/Prisma)

**API Endpoints**:
```typescript
// Existing endpoints (keep)
GET /api/finances/summary           // Quick dashboard overview
GET /api/finances/daily             // Comprehensive financial report
GET /api/finances/operating-costs   // Detailed cost breakdown
GET /api/finances/revenue-streams   // Income sources
GET /api/finances/projections       // Forecasts & recommendations

// New endpoints (add)
GET /api/finances/per-robot         // Per-robot financial breakdown
GET /api/finances/investments       // User spending tracking
GET /api/finances/history           // Historical financial data (7/30/90 days)
GET /api/finances/alerts            // Active economic alerts
POST /api/finances/roi-calculator   // Calculate facility upgrade ROI
```

**Database Schema Changes**:
```prisma
// Store historical financial snapshots
model DailyFinancialSnapshot {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  date          DateTime @default(now())
  
  // Revenue
  battleWinnings   Float
  prestigeBonus    Float
  merchandising    Float
  streaming        Float
  totalRevenue     Float
  
  // Expenses
  operatingCosts   Float
  repairCosts      Float
  totalExpenses    Float
  
  // Metrics
  netIncome        Float
  balance          Float
  financialHealth  String
  profitMargin     Float
  daysToBankruptcy Int
  
  @@index([userId, date])
}

// Store user spending transactions
model SpendingTransaction {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  timestamp     DateTime @default(now())
  
  type          String   // "ATTRIBUTE_UPGRADE" | "WEAPON_PURCHASE" | "FACILITY_UPGRADE" | "ROBOT_CREATION"
  amount        Float
  description   String
  relatedId     String?  // Optional: ID of related entity (robot, facility, weapon)
  
  @@index([userId, timestamp])
  @@index([userId, type])
}

// Store per-robot financial performance
model RobotFinancialPerformance {
  id            String   @id @default(uuid())
  robotId       String   @unique
  robot         Robot    @relation(fields: [robotId], references: [id])
  
  // Lifetime totals
  totalBattleWinnings   Float @default(0)
  totalRepairCosts      Float @default(0)
  totalBattles          Int   @default(0)
  
  // Current day (reset daily)
  dailyBattleWinnings   Float @default(0)
  dailyRepairCosts      Float @default(0)
  dailyBattles          Int   @default(0)
  
  lastUpdated   DateTime @default(now())
  
  @@index([robotId])
}
```

**Calculation Utilities**:
```typescript
// src/utils/economyCalculations.ts (extend existing)

// Calculate per-robot revenue breakdown
export function calculatePerRobotRevenue(robot: Robot, user: User): RobotRevenue {
  // Battle winnings (from robot's battles)
  // Merchandising (fame contribution to stable merchandising)
  // Streaming (battle count contribution to stable streaming)
  // Return breakdown
}

// Calculate facility upgrade ROI
export function calculateFacilityROI(
  facilityType: string,
  currentLevel: number,
  targetLevel: number,
  userPrestige: number
): ROICalculation {
  // Upgrade cost
  // Daily cost increase
  // Daily benefit increase
  // Break-even time
  // Net benefit over time periods
  // Return ROI data
}

// Detect economic alerts
export function detectEconomicAlerts(
  balance: number,
  dailyRevenue: number,
  dailyExpenses: number,
  facilities: Facility[],
  robots: Robot[]
): EconomicAlert[] {
  // Check for low balance, negative cash flow, etc.
  // Return array of alerts
}
```

**Performance Considerations**:
- **Caching**: Cache financial calculations for 1 hour (most data doesn't change frequently)
- **Indexes**: Add database indexes on frequently queried fields (userId, date, type)
- **Pagination**: Paginate transaction logs and historical data
- **Background Jobs**: Run daily financial snapshot creation as background job

---

## Design Alignment

### Color Palette Verification

**Current Income Dashboard Uses** (from FinancialReportPage.tsx):
- Background: `gray-900` (#111827)
- Cards: `gray-800` (#1F2937)
- Borders: `gray-700` (#374151)
- Success: `green-400` (#4ade80)
- Error: `red-400` (#f87171)
- Warning: N/A
- Info: `purple-400` (#c084fc)

**Design System Colors** (from `/docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md`):
- Background: `#0a0e14` (Deep space black)
- Surface: `#1a1f29` (Dark panel)
- Surface Elevated: `#252b38` (Raised cards)
- Primary: `#58a6ff` (Cyan-blue)
- Success: `#3fb950` (Green)
- Warning: `#d29922` (Amber)
- Error: `#f85149` (Red)
- Info: `#a371f7` (Purple - prestige)

**Action**: Update Income Dashboard to use design system colors for consistency.

### Typography

**Current**: Default Tailwind typography (sans-serif)

**Design System**: 
- Headers: Orbitron (bold, uppercase for main titles)
- Body: Inter (clean, readable for data-heavy pages)
- Monospace: JetBrains Mono (for numeric data, currency values)

**Action**: 
- Use Orbitron for "INCOME DASHBOARD" title
- Use JetBrains Mono for all currency values (₡1,904,000)
- Use Inter for body text and labels

### Currency Display

**Format**: `₡XXX,XXX` (Credit symbol + comma-separated number)

**Examples**:
- Small amounts: ₡1,250
- Medium amounts: ₡125,000
- Large amounts: ₡1,904,000
- Negative amounts: -₡500 (red color)

**Consistency**: Align with existing `formatCurrency()` utility in `financialApi.ts`

### Icons & Visual Indicators

**Financial Health Status**:
- Excellent ✅: Green checkmark, `#3fb950`
- Good ✅: Green checkmark, `#3fb950`
- Stable ⚠️: Yellow warning, `#d29922`
- Warning ⚠️: Yellow warning, `#d29922`
- Critical ❌: Red X, `#f85149`

**Revenue Sources** (pie chart colors):
- Battle Winnings: `#f85149` (Red - combat)
- Prestige Bonus: `#a371f7` (Purple - prestige)
- Merchandising: `#3fb950` (Green - passive)
- Streaming: `#58a6ff` (Blue - passive)

**Expense Categories** (pie chart colors):
- Operating Costs: `#d29922` (Amber - ongoing)
- Repairs: `#f85149` (Red - variable)

---

## Success Criteria

### Must Have (Phase 1-2)

- ✅ Navigation menu "Income Dashboard" link works correctly
- ✅ Consistent "Income Dashboard" terminology across all pages and documentation
- ✅ Route `/income` implemented with backwards-compatible `/finances` redirect
- ✅ Daily Stable Report format matches PRD_ECONOMY_SYSTEM.md specification
- ✅ All revenue streams displayed (battle winnings, prestige bonus, merchandising, streaming)
- ✅ All operating costs listed by facility
- ✅ Financial health indicators calculated and displayed
- ✅ Revenue and expense pie charts implemented

### Should Have (Phase 3-4)

- ✅ Per-robot financial breakdown implemented
- ✅ Robot profitability ranking
- ✅ Investment tracking and spending summary
- ✅ Facility upgrade ROI calculator
- ✅ Recent transactions log

### Nice to Have (Phase 5-6)

- ✅ Historical financial trends (7/30/90-day charts)
- ✅ Financial projections (weekly, monthly, best/worst case)
- ✅ Economic alerts and warnings
- ✅ Economic health score (0-100)
- ✅ AI-powered recommendations (already implemented, enhance with alerts)

---

## Open Questions & Answers

**Q: Should we keep both `/income` and `/finances` routes?**  
A: Yes. Primary route should be `/income`, but maintain `/finances` as a redirect for backwards compatibility (links in documentation, bookmarks).

**Q: How should facility costs be allocated to individual robots in per-robot breakdown?**  
A: Split evenly across all **active/battle-ready** robots. Inactive or retired robots don't incur facility cost allocation.

**Q: What time period should "Daily Stable Report" cover?**  
A: MVP implementation covers "current day" (since last daily finance processing). Future: Allow users to select historical days (yesterday, last 7 days, last 30 days).

**Q: Should historical data be stored indefinitely?**  
A: Keep last 90 days in database. Archive older data to separate table or export to CSV for long-term storage.

**Q: How to handle users with no robots?**  
A: Show "No robots" message in per-robot tab. Encourage robot creation with link to Create Robot page.

**Q: Should ROI calculator consider prestige requirements?**  
A: Yes. If target facility level requires prestige the user doesn't have, show "Prestige Required" warning and estimate time to earn that prestige.

**Q: How to handle income/expenses that span multiple days?**  
A: Capture snapshots at end of each "day" (daily finance processing cycle). Historical charts show day-by-day data, not hourly/minute-level granularity.

---

## Future Considerations

### When Real Users Join (Post-Prototype)

- **Leaderboards**: "Top Earners" leaderboard showing richest stables
- **Economic Comparison**: Compare your financial performance to average players
- **Investment Strategies**: Share and compare facility upgrade paths with other players
- **Economic Events**: Global events that affect income/costs (e.g., "Tournament Season +20% battle rewards")

### Planned Features Integration

- **Tournaments**: Add tournament winnings to revenue streams
- **Marketplace**: Add trading commission to revenue streams
- **Sponsorships**: High-prestige stables attract sponsors for daily passive income
- **Achievements**: Display economic achievement milestones (first ₡1M, first ₡10M, etc.)
- **Budget Planning**: Set spending limits and track adherence

### Advanced Analytics (Future Phases)

- **Predictive Modeling**: ML-based predictions of income/expense trends
- **What-If Scenarios**: Simulate financial impact of decisions ("What if I upgrade all facilities to max level?")
- **Economic Reports**: Monthly/quarterly summary reports with insights
- **Export to CSV/PDF**: Download financial reports for external analysis
- **API Access**: Allow third-party tools to access financial data (with user consent)

### Mobile/Tablet Support

- **Current**: Desktop-only implementation
- **Future**: Responsive design for mobile/tablet viewing
- **Mobile Focus**: Simplified view with key metrics (balance, net income, alerts)
- **Full Details**: Accessible via desktop or tablet landscape mode

---

## Appendix A: API Response Examples

### GET /api/finances/per-robot

**Request**: `GET /api/finances/per-robot`

**Response**:
```json
{
  "robots": [
    {
      "id": "robot-uuid-1",
      "name": "Thunder",
      "league": "gold_2",
      "elo": 1645,
      "revenue": {
        "battleWinnings": 25000,
        "merchandising": 8000,
        "streaming": 12000,
        "total": 45000
      },
      "costs": {
        "repairs": 8500,
        "allocatedFacilities": 5800,
        "total": 14300
      },
      "netIncome": 30700,
      "roi": 68.2,
      "metrics": {
        "winRate": 62.5,
        "avgEarningsPerBattle": 1250,
        "totalBattles": 20,
        "fameContribution": 5000,
        "repairCostPercentage": 18.9
      }
    },
    {
      "id": "robot-uuid-2",
      "name": "Blitz",
      "league": "silver_3",
      "elo": 1420,
      "revenue": {
        "battleWinnings": 20000,
        "merchandising": 6400,
        "streaming": 7040,
        "total": 33440
      },
      "costs": {
        "repairs": 12000,
        "allocatedFacilities": 5800,
        "total": 17800
      },
      "netIncome": 15640,
      "roi": 46.8,
      "metrics": {
        "winRate": 55.0,
        "avgEarningsPerBattle": 1000,
        "totalBattles": 20,
        "fameContribution": 3000,
        "repairCostPercentage": 35.9
      }
    }
  ],
  "summary": {
    "totalRevenue": 78440,
    "totalCosts": 32100,
    "totalNetIncome": 46340,
    "averageROI": 57.5,
    "mostProfitable": "Thunder",
    "leastProfitable": "Blitz"
  }
}
```

### GET /api/finances/alerts

**Request**: `GET /api/finances/alerts`

**Response**:
```json
{
  "alerts": [
    {
      "id": "alert-1",
      "type": "LOW_BALANCE",
      "severity": "critical",
      "title": "Low Balance Warning",
      "message": "Current balance: ₡85,000. You have approximately 3 days of operating costs remaining.",
      "recommendations": [
        "Win more battles to increase income",
        "Consider disabling expensive coach (₡3,000/day)",
        "Repair only critical robots",
        "Upgrade Income Generator for passive income"
      ],
      "actionLinks": [
        { "label": "View Battle History", "path": "/battle-history" },
        { "label": "Manage Facilities", "path": "/facilities" }
      ]
    },
    {
      "id": "alert-2",
      "type": "HIGH_REPAIR_COSTS",
      "severity": "warning",
      "title": "High Repair Costs",
      "message": "Repair costs are consuming 65% of your income. Consider upgrading Medical Bay or avoiding risky battles.",
      "recommendations": [
        "Upgrade Medical Bay for repair cost discounts",
        "Focus on winning battles with higher-HP robots",
        "Avoid battles with significantly stronger opponents"
      ],
      "actionLinks": [
        { "label": "Upgrade Medical Bay", "path": "/facilities" },
        { "label": "View Robot Health", "path": "/robots" }
      ]
    },
    {
      "id": "alert-3",
      "type": "INVESTMENT_OPPORTUNITY",
      "severity": "info",
      "title": "Investment Opportunity Available",
      "message": "You can afford Income Generator Level 6 (₡800K). ROI break-even in 145 days with ₡5,500/day net gain.",
      "recommendations": [
        "Upgrade Income Generator Level 6 for ₡800,000",
        "Net daily gain: ₡5,500",
        "Break-even time: 145 days (~5 months)"
      ],
      "actionLinks": [
        { "label": "View ROI Calculator", "path": "/income#investments" },
        { "label": "Upgrade Facility", "path": "/facilities" }
      ]
    }
  ],
  "summary": {
    "total": 3,
    "critical": 1,
    "warning": 1,
    "info": 1
  }
}
```

---

## Appendix B: Mockup - Overview Tab

```
╔═══════════════════════════════════════════════════════════════════════╗
║ INCOME DASHBOARD                                   [Refresh] [Export] ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║ [Overview] [Per-Robot] [Investments] [Projections] [Alerts]          ║
║ ─────────                                                             ║
║                                                                       ║
║ ╔═════════════════════════════════════════════════════════════════╗   ║
║ ║ FINANCIAL HEALTH: EXCELLENT ✅                                  ║   ║
║ ║ Current Balance: ₡1,904,000                                     ║   ║
║ ║ Daily Profit Margin: 54%  |  Days to Bankruptcy: 67 days       ║   ║
║ ╚═════════════════════════════════════════════════════════════════╝   ║
║                                                                       ║
║ ╔═══════════════════════════════════════════════════════════════════╗ ║
║ ║          DAILY STABLE REPORT - February 7, 2026                   ║ ║
║ ╠═══════════════════════════════════════════════════════════════════╣ ║
║ ║ REVENUE STREAMS:                                                  ║ ║
║ ║   Battle Winnings:         ₡45,000                                ║ ║
║ ║   Prestige Bonus (10%):    ₡4,500                                 ║ ║
║ ║   Merchandising:           ₡30,000                                ║ ║
║ ║   Streaming:               ₡27,000                                ║ ║
║ ║   ───────────────────────────────────                             ║ ║
║ ║   Total Revenue:           ₡106,500                               ║ ║
║ ║                                                                   ║ ║
║ ║ OPERATING COSTS:                                                  ║ ║
║ ║   Repair Bay (Lvl 5):      ₡3,500                                 ║ ║
║ ║   Training Facility (Lvl 4): ₡4,500                               ║ ║
║ ║   Weapons Workshop (Lvl 3): ₡2,000                                ║ ║
║ ║   [...more facilities...]                                         ║ ║
║ ║   ───────────────────────────────────                             ║ ║
║ ║   Total Operating Costs:   ₡29,000                                ║ ║
║ ║                                                                   ║ ║
║ ║ REPAIRS:                                                          ║ ║
║ ║   Robot "Thunder":         ₡8,500                                 ║ ║
║ ║   Robot "Blitz":           ₡12,000                                ║ ║
║ ║   ───────────────────────────────────                             ║ ║
║ ║   Total Repair Costs:      ₡20,500                                ║ ║
║ ║                                                                   ║ ║
║ ║ ═══════════════════════════════════════════════════════════════   ║ ║
║ ║ NET INCOME:                ₡57,000                                ║ ║
║ ║ CURRENT BALANCE:           ₡1,904,000                             ║ ║
║ ╚═══════════════════════════════════════════════════════════════════╝ ║
║                                                                       ║
║ ╔═══════════╗  ╔═══════════╗  ╔═══════════╗                          ║
║ ║  REVENUE  ║  ║ EXPENSES  ║  ║NET INCOME ║                          ║
║ ║ ₡106,500  ║  ║  ₡49,500  ║  ║  ₡57,000  ║                          ║
║ ╚═══════════╝  ╚═══════════╝  ╚═══════════╝                          ║
║                                                                       ║
║ ╔══════════════════════╗  ╔══════════════════════╗                   ║
║ ║  Revenue Breakdown   ║  ║  Expense Breakdown   ║                   ║
║ ║  [Pie Chart Here]    ║  ║  [Pie Chart Here]    ║                   ║
║ ╚══════════════════════╝  ╚══════════════════════╝                   ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## Appendix C: Mockup - Per-Robot Tab

```
╔═══════════════════════════════════════════════════════════════════════╗
║ INCOME DASHBOARD                                   [Refresh] [Export] ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║ [Overview] [Per-Robot] [Investments] [Projections] [Alerts]          ║
║            ──────────                                                 ║
║                                                                       ║
║ ╔═══════════════════════════════════════════════════════════════╗     ║
║ ║ ROBOT PROFITABILITY RANKING                                   ║     ║
║ ║ 1. Thunder     ₡30,700 net  (68.2% ROI)  ✅ Highly Profitable ║     ║
║ ║ 2. Blitz       ₡15,640 net  (46.8% ROI)  ✅ Profitable        ║     ║
║ ╚═══════════════════════════════════════════════════════════════╝     ║
║                                                                       ║
║ ╔═══════════════════════════════════════════════════════════════════╗ ║
║ ║ ROBOT "THUNDER"                                                   ║ ║
║ ║ League: Gold Tier 2  |  ELO: 1,645  |  Win Rate: 62.5%           ║ ║
║ ╠═══════════════════════════════════════════════════════════════════╣ ║
║ ║ REVENUE:                                                          ║ ║
║ ║   Battle Winnings:     ₡25,000                                    ║ ║
║ ║   Merchandising:       ₡8,000   (Fame: 5,000)                     ║ ║
║ ║   Streaming:           ₡12,000  (Battles: 500)                    ║ ║
║ ║   ───────────────────────────────────                             ║ ║
║ ║   Robot Revenue:       ₡45,000                                    ║ ║
║ ║                                                                   ║ ║
║ ║ COSTS:                                                            ║ ║
║ ║   Repair Costs:        ₡8,500                                     ║ ║
║ ║   Allocated Facilities*: ₡5,800                                   ║ ║
║ ║   ───────────────────────────────────                             ║ ║
║ ║   Robot Costs:         ₡14,300                                    ║ ║
║ ║                                                                   ║ ║
║ ║ ═══════════════════════════════════════════════════════════════   ║ ║
║ ║ NET INCOME:            ₡30,700 ✅                                 ║ ║
║ ║ ROI:                   68.2%                                      ║ ║
║ ║                                                                   ║ ║
║ ║ 💡 Recommendation: Thunder is highly profitable. Consider         ║ ║
║ ║    entering tournaments to maximize earnings.                     ║ ║
║ ╚═══════════════════════════════════════════════════════════════════╝ ║
║                                                                       ║
║ ╔═══════════════════════════════════════════════════════════════════╗ ║
║ ║ ROBOT "BLITZ"                                                     ║ ║
║ ║ League: Silver Tier 3  |  ELO: 1,420  |  Win Rate: 55.0%         ║ ║
║ ╠═══════════════════════════════════════════════════════════════════╣ ║
║ ║ REVENUE:                                                          ║ ║
║ ║   Battle Winnings:     ₡20,000                                    ║ ║
║ ║   Merchandising:       ₡6,400   (Fame: 3,000)                     ║ ║
║ ║   Streaming:           ₡7,040   (Battles: 300)                    ║ ║
║ ║   ───────────────────────────────────                             ║ ║
║ ║   Robot Revenue:       ₡33,440                                    ║ ║
║ ║                                                                   ║ ║
║ ║ COSTS:                                                            ║ ║
║ ║   Repair Costs:        ₡12,000                                    ║ ║
║ ║   Allocated Facilities*: ₡5,800                                   ║ ║
║ ║   ───────────────────────────────────                             ║ ║
║ ║   Robot Costs:         ₡17,800                                    ║ ║
║ ║                                                                   ║ ║
║ ║ ═══════════════════════════════════════════════════════════════   ║ ║
║ ║ NET INCOME:            ₡15,640 ✅                                 ║ ║
║ ║ ROI:                   46.8%                                      ║ ║
║ ║                                                                   ║ ║
║ ║ ⚠️ Warning: Blitz has high repair costs (35.9% of revenue).       ║ ║
║ ║    Consider upgrading Medical Bay for repair discounts.           ║ ║
║ ╚═══════════════════════════════════════════════════════════════════╝ ║
║                                                                       ║
║ *Facilities costs split evenly across 2 active robots                ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

**End of Document**
