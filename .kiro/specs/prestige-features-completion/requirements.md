# Prestige Features Completion - Requirements

**Feature Name**: prestige-features-completion  
**Created**: February 9, 2026  
**Status**: Requirements Complete

## Overview

Complete two partially implemented prestige system features:
1. **Prestige Gates** - Enforce prestige requirements for facility upgrades
2. **Income Multiplier Display** - Show prestige/fame multiplier breakdowns in UI

## Background

The prestige and fame system is documented in PRD_PRESTIGE_AND_FAME.md and STABLE_SYSTEM.md. Analysis revealed:
- Prestige requirements are documented but not enforced in code
- Income multipliers are implemented in backend but not displayed in frontend
- Both features need completion to match the documented specifications

## User Stories

### User Story 1: Prestige-Gated Facility Upgrades
**As a** player  
**I want** facility upgrades to be locked behind prestige requirements  
**So that** I have clear progression goals and prestige feels meaningful

**Acceptance Criteria**:
1.1. Facility upgrade API validates prestige requirements before allowing upgrades
1.2. Facilities API returns prestige requirement information for each level
1.3. Frontend displays lock icons for prestige-locked facility levels
1.4. Frontend shows "Requires X prestige" tooltip on locked levels
1.5. Attempting to upgrade without sufficient prestige shows clear error message
1.6. All 14 facilities have correct prestige requirements from STABLE_SYSTEM.md

### User Story 2: Income Multiplier Visibility
**As a** player  
**I want** to see how prestige and fame affect my income  
**So that** I understand the value of building reputation

**Acceptance Criteria**:
2.1. Income Dashboard displays prestige bonus breakdown for battle winnings
2.2. Income Dashboard shows merchandising income with prestige multiplier calculation
2.3. Income Dashboard shows streaming income with battle/fame multiplier calculation
2.4. Tooltips explain how each multiplier is calculated
2.5. Current prestige/fame values are displayed alongside multipliers
2.6. Multiplier display updates in real-time when prestige/fame changes

## Prestige Requirements Reference

From STABLE_SYSTEM.md, facilities with prestige gates:

| Facility | Levels Requiring Prestige |
|----------|---------------------------|
| Repair Bay | L4: 1,000, L7: 5,000, L9: 10,000 |
| Training Facility | L4: 1,000, L7: 5,000, L9: 10,000 |
| Weapons Workshop | L4: 1,500, L7: 5,000, L9: 10,000 |
| Research Lab | L4: 2,000, L7: 7,500, L9: 15,000 |
| Medical Bay | L4: 2,000, L7: 7,500, L9: 15,000 |
| Roster Expansion | L4: 1,000, L7: 5,000, L9: 10,000 |
| Coaching Staff | L3: 2,000, L6: 5,000, L9: 10,000 |
| Booking Office | L1: 1,000, L2: 2,500, L3: 5,000, L4: 10,000, L5: 15,000, L6: 20,000, L7: 25,000, L8: 35,000, L9: 45,000, L10: 50,000 |
| Combat Training Academy | L3: 2,000, L5: 4,000, L7: 7,000, L9: 10,000, L10: 15,000 |
| Defense Training Academy | L3: 2,000, L5: 4,000, L7: 7,000, L9: 10,000, L10: 15,000 |
| Mobility Training Academy | L3: 2,000, L5: 4,000, L7: 7,000, L9: 10,000, L10: 15,000 |
| AI Training Academy | L3: 2,000, L5: 4,000, L7: 7,000, L9: 10,000, L10: 15,000 |
| Income Generator | L4: 3,000, L7: 7,500, L9: 15,000 |
| Storage Facility | None |

## Income Multiplier Formulas

From economyCalculations.ts (already implemented):

**Prestige Multiplier (Battle Winnings)**:
```typescript
if (prestige >= 50000) return 1.20;  // +20%
if (prestige >= 25000) return 1.15;  // +15%
if (prestige >= 10000) return 1.10;  // +10%
if (prestige >= 5000) return 1.05;   // +5%
return 1.0;                          // No bonus
```

**Merchandising Income**:
```typescript
merchandising = base_rate × (1 + prestige / 10000)
```

**Streaming Income**:
```typescript
streaming = base_rate × (1 + total_battles / 1000) × (1 + total_fame / 5000)
```

## Technical Constraints

- Backend uses TypeScript with Express.js
- Frontend uses React with TypeScript
- Database uses Prisma ORM with PostgreSQL
- Must maintain backward compatibility with existing data
- Test coverage must be >80% for new code

## Success Metrics

- All prestige-gated facilities properly enforce requirements
- Zero facility upgrades succeed without meeting prestige requirements
- Income Dashboard displays all multiplier breakdowns
- User feedback indicates clear understanding of prestige benefits
- Test coverage >80% for all new code

## Out of Scope

- Changing prestige requirement values (use STABLE_SYSTEM.md values)
- Adding new facilities or income streams
- Modifying prestige earning formulas
- UI redesign beyond adding multiplier displays
