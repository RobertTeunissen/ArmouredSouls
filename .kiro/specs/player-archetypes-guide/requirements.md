# Requirements Document

## Introduction

This document defines requirements for creating a comprehensive "Player Archetypes and Starting Strategies Guide" for Armoured Souls. The guide will help new and intermediate players make informed decisions about how to spend their starting budget (₡3,000,000) based on different playstyles and strategic preferences.

The game features deep economic and progression systems with multiple viable paths to success. Players must balance investments across robots, weapons, facilities, and attribute upgrades. This guide will identify distinct player archetypes, provide detailed budget allocation strategies, and offer progression roadmaps for each playstyle.

## Glossary

- **System**: The documentation system that generates and maintains the Player Archetypes Guide
- **Player**: A user of Armoured Souls who is reading the guide
- **Archetype**: A distinct playstyle or strategic approach to the game
- **Starting_Budget**: The ₡3,000,000 credits each player begins with
- **Robot**: A combat unit that players purchase, upgrade, and battle with
- **Facility**: Infrastructure that provides discounts, unlocks, or passive income
- **Attribute**: One of 23 robot stats that can be upgraded (Combat Power, Hull Integrity, etc.)
- **Weapon**: Equipment purchased and equipped to robots for combat bonuses
- **League**: Competitive tier (Bronze, Silver, Gold, Platinum, Diamond, Champion)
- **Prestige**: Stable-level reputation that unlocks content and provides bonuses
- **Fame**: Robot-level reputation that affects streaming revenue
- **ROI**: Return on Investment - how long it takes for an investment to pay for itself
- **Win_Rate**: Percentage of battles won (50% is balanced matchmaking baseline)
- **Bankruptcy**: When player balance reaches ₡0 and cannot afford repairs or operations

## Requirements

### Requirement 1: Player Archetype Identification

**User Story:** As a new player, I want to understand different playstyles available in Armoured Souls, so that I can choose an approach that matches my preferences and goals.

#### Acceptance Criteria

1. THE System SHALL identify at least 10 distinct player archetypes based on game mechanics
2. WHEN describing each archetype, THE System SHALL include robot build style (Tank, Glass Cannon, Speed Demon, etc.)
3. THE System SHALL specify loadout type (Single, Weapon+Shield, Two-Handed, Dual-Wield) for each archetype
4. THE System SHALL explain attribute focus for each archetype (which of 23 attributes to prioritize)
5. THE System SHALL explain how league progression affects risk level for each archetype
6. THE System SHALL provide clear differentiation between archetypes to avoid overlap
7. THE System SHALL include both competitive and casual-friendly archetypes

### Requirement 2: Starting Budget Allocation

**User Story:** As a player choosing an archetype, I want detailed spending breakdowns for the ₡3M starting budget, so that I can execute my chosen strategy effectively from day one.

#### Acceptance Criteria

1. WHEN providing budget allocation, THE System SHALL break down spending across robots, weapons, facilities, and attribute upgrades
2. THE System SHALL specify exact costs for each purchase recommendation
3. THE System SHALL include a reserve buffer amount with justification
4. THE System SHALL ensure total spending does not exceed ₡3,000,000 but stay close to this number since the expectation is that players will spend almost everything
5. THE System SHALL explain the strategic rationale for each major expenditure
6. THE System SHALL account for facility operating costs in budget planning
7. THE System SHALL specify which attributes to prioritize for upgrades per archetype

### Requirement 3: Early Game Strategy (Days 1-30)

**User Story:** As a new player, I want guidance on my first 30 days of gameplay, so that I can establish a sustainable stable and avoid early bankruptcy.

#### Acceptance Criteria

1. WHEN describing early game strategy, THE System SHALL specify recommended battle frequency per week
2. THE System SHALL provide income expectations based on Bronze/Silver league performance
3. THE System SHALL identify when to make first major purchases beyond starting investments
4. THE System SHALL list common pitfalls specific to each archetype
5. THE System SHALL explain how to manage repair costs and operating expenses, accounting for league income scaling
6. THE System SHALL provide league progression goals for the first month
7. THE System SHALL explain how league advancement dramatically affects income (Bronze ₡5-10K vs Gold ₡20-40K per win)

### Requirement 4: Mid Game Transition (Days 30-120)

**User Story:** As a player progressing beyond early game, I want to know when and how to expand my stable, so that I can scale my operations effectively.

#### Acceptance Criteria

1. WHEN describing mid game transition, THE System SHALL specify expansion triggers (balance thresholds, league advancement)
2. THE System SHALL prioritize facility upgrades based on archetype strategy
3. THE System SHALL explain income diversification strategies (battle winnings, merchandising, streaming)
4. THE System SHALL provide league advancement targets (Silver → Gold → Platinum)
5. THE System SHALL identify when to purchase additional robots or weapons
6. THE System SHALL explain how to balance growth investments vs operational sustainability

### Requirement 5: Build Synergies

**User Story:** As a player optimizing my strategy, I want to understand how my archetype aligns with robot builds and combat systems, so that I can maximize effectiveness.

#### Acceptance Criteria

1. THE System SHALL map each archetype to compatible robot attribute builds (Tank, Glass Cannon, Speed Demon, etc.)
2. THE System SHALL recommend loadout types (Single, Weapon+Shield, Two-Handed, Dual-Wield) per archetype
3. THE System SHALL suggest battle stances (Offensive, Defensive, Balanced) appropriate for each archetype
4. THE System SHALL explain yield threshold strategies based on archetype risk tolerance
5. THE System SHALL identify attribute synergies (which stats work well together)
6. THE System SHALL explain how weapon choices complement archetype strategies

### Requirement 6: Economic Analysis

**User Story:** As a strategic player, I want detailed economic analysis for each archetype, so that I can understand profitability, risks, and long-term viability.

#### Acceptance Criteria

1. WHEN providing economic analysis, THE System SHALL calculate ROI for key investments per archetype
2. THE System SHALL estimate break-even timelines for major facility purchases
3. THE System SHALL project profitability at 50% win rate (balanced matchmaking baseline)
4. THE System SHALL assess bankruptcy risk for each archetype at different league tiers (Bronze vs Silver vs Gold)
5. THE System SHALL explain how league advancement changes risk profiles (high-risk in Bronze may become low-risk in Gold)
6. THE System SHALL compare income streams (battle winnings vs passive income) per archetype
7. THE System SHALL explain how prestige and fame affect long-term economics
8. THE System SHALL identify which archetypes are most/least forgiving of losses
9. THE System SHALL explain why facility investments may have better ROI than direct spending (e.g., Training Facility saves 5% on all future upgrades)

### Requirement 7: Hybrid Strategies

**User Story:** As an experienced player, I want to understand how to combine or transition between archetypes, so that I can adapt my strategy as my stable grows.

#### Acceptance Criteria

1. THE System SHALL identify viable archetype combinations (e.g., Power Maximizer → Economic Strategist)
2. THE System SHALL explain multi-phase strategies (early game focus → mid game pivot)
3. THE System SHALL specify transition triggers (balance thresholds, prestige levels, league tiers)
4. THE System SHALL describe situational adaptations (responding to losses, capitalizing on win streaks)
5. THE System SHALL explain how to rebalance investments when changing strategies

### Requirement 8: Practical Examples and Calculations

**User Story:** As a player reading the guide, I want concrete examples with real numbers, so that I can follow the strategies without guesswork.

#### Acceptance Criteria

1. WHEN providing examples, THE System SHALL use actual game costs and formulas
2. THE System SHALL show step-by-step calculations for ROI and break-even analysis
3. THE System SHALL include sample robot builds with specific attribute levels
4. THE System SHALL provide example weekly income/expense projections
5. THE System SHALL demonstrate repair cost calculations for different damage scenarios
6. THE System SHALL show prestige accumulation timelines with realistic win rates

### Requirement 9: Risk Assessment and Warnings

**User Story:** As a player considering a high-risk archetype, I want clear warnings about potential pitfalls, so that I can make informed decisions.

#### Acceptance Criteria

1. THE System SHALL identify high-risk archetypes and explain why they are risky
2. THE System SHALL warn about bankruptcy scenarios and how to avoid them
3. THE System SHALL explain consequences of poor early decisions (e.g., overspending on facilities)
4. THE System SHALL provide recovery strategies if a player falls behind economically
5. THE System SHALL identify "trap" investments that appear good but have poor ROI

### Requirement 10: Accessibility and Readability

**User Story:** As a player reading the guide, I want clear organization and formatting, so that I can quickly find information relevant to my chosen archetype.

#### Acceptance Criteria

1. THE System SHALL organize content with clear headings and sections
2. THE System SHALL use tables for comparing archetypes side-by-side
3. THE System SHALL include summary boxes for quick reference
4. THE System SHALL use consistent terminology matching game documentation
5. THE System SHALL provide a table of contents for easy navigation
6. THE System SHALL use visual formatting (bold, italics, lists) to improve readability

### Requirement 11: Weapon Purchase Strategy

**User Story:** As a player managing limited resources, I want to understand when and why to purchase additional weapons, so that I don't waste credits on unnecessary equipment.

#### Acceptance Criteria

1. THE System SHALL explain that most archetypes only need 1-2 weapons initially (one per robot)
2. THE System SHALL identify when purchasing additional weapons makes strategic sense (e.g., Two-Robot Specialist needs 2 weapons minimum)
3. THE System SHALL explain that weapon experimentation is expensive and should be deferred to mid-game
4. THE System SHALL explain that Storage Facility is required for weapon collections (default capacity is only 5 weapons)
5. THE System SHALL explain the trade-off: buying multiple weapons vs investing in attribute upgrades or facilities
6. THE System SHALL identify which archetypes benefit from weapon variety (e.g., Speed Demon with dual-wield options) vs which don't (e.g., Tank Fortress with fixed loadout)
