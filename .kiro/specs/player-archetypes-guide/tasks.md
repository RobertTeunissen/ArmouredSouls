# Implementation Plan: Player Archetypes and Starting Strategies Guide

## Overview

This implementation plan outlines the tasks for creating a comprehensive markdown guide document that helps Armoured Souls players understand different playstyles and make informed decisions about their ₡3,000,000 starting budget. The guide will be created as a single markdown file in the `docs/` directory.

## Tasks

- [x] 1. Create guide document structure and introduction
  - Create `docs/PLAYER_ARCHETYPES_GUIDE.md` file
  - Write introduction explaining guide purpose and how to use it
  - Create table of contents with links to all major sections
  - Write "Understanding the Economy" primer section covering robots, facilities, weapons, income, and costs
  - _Requirements: 10.1, 10.4, 10.5_

- [x] 2. Define and document all 10 player archetypes
  - [x] 2.1 Write Tank Fortress archetype
    - Document philosophy, robot build, loadout type, attribute focus
    - Explain league scaling (risk in Bronze vs Silver vs Gold)
    - Include personality fit and strategic focus
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.2 Write Glass Cannon archetype
    - Document philosophy, robot build, loadout type, attribute focus
    - Explain league scaling and high-risk/high-reward nature
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.3 Write Speed Demon archetype
    - Document philosophy, robot build, loadout type, attribute focus
    - Explain dual-wield strategy and mobility focus
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.4 Write Balanced Brawler archetype
    - Document philosophy, robot build, loadout type, attribute focus
    - Explain why this is most forgiving for new players
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_
  
  - [x] 2.5 Write Facility Investor archetype
    - Document philosophy, robot build, loadout type, attribute focus
    - Explain long-term economic strategy and passive income
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_
  
  - [x] 2.6 Write Two-Robot Specialist archetype
    - Document philosophy, robot build, loadout type, attribute focus
    - Explain Roster Expansion requirement and complementary builds
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.7 Write Melee Specialist archetype
    - Document philosophy, robot build, loadout type, attribute focus
    - Explain Hydraulic Systems focus and positioning gameplay
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.8 Write Ranged Sniper archetype
    - Document philosophy, robot build, loadout type, attribute focus
    - Explain Targeting Systems focus and precision gameplay
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.9 Write AI Tactician archetype
    - Document philosophy, robot build, loadout type, attribute focus
    - Explain Combat Algorithms focus and strategic depth
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.10 Write Prestige Rusher archetype
    - Document philosophy, robot build, loadout type, attribute focus
    - Explain competitive focus and prestige optimization
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 3. Create archetype comparison table
  - Build side-by-side comparison table with columns: Name, Build Style, Loadout, Risk Level (Bronze/Silver/Gold), Resource Split, Best For
  - Ensure table is readable and helps players quickly compare options
  - _Requirements: 10.2, 10.3_

- [x] 4. Write detailed budget allocations for each archetype
  - [x] 4.1 Calculate Tank Fortress budget allocation
    - Break down robot purchases, attribute upgrades (specific attributes and levels), weapons, facilities
    - Show exact costs and formulas
    - Explain facility purchase order and ROI analysis
    - Ensure total ≤ ₡3,000,000 with minimal buffer (₡5-15K)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [x] 4.2 Calculate Glass Cannon budget allocation
    - Break down spending with focus on offensive attributes and premium two-handed weapon
    - Explain why Training Facility may be purchased first for upgrade discounts
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [x] 4.3 Calculate Speed Demon budget allocation
    - Break down spending with focus on speed/mobility attributes and dual-wield weapons
    - Explain weapon choices (2× one-handed weapons)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [x] 4.4 Calculate Balanced Brawler budget allocation
    - Break down spending with balanced attribute distribution
    - Explain larger buffer for safety
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [x] 4.5 Calculate Facility Investor budget allocation
    - Break down spending with 50% on facilities (Income Generator, Repair Bay, Training Facility)
    - Show ROI calculations for each facility
    - Explain long-term payback strategy
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 6.9_
  
  - [x] 4.6 Calculate Two-Robot Specialist budget allocation
    - Break down spending for 2 robots with complementary builds
    - Explain Roster Expansion requirement (₡300K + ₡500/day operating cost)
    - Show weapon allocation (1 per robot minimum)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 11.2_
  
  - [x] 4.7 Calculate Melee Specialist budget allocation
    - Break down spending with focus on Hydraulic Systems and melee weapons
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [x] 4.8 Calculate Ranged Sniper budget allocation
    - Break down spending with focus on Targeting Systems and ranged weapons
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [x] 4.9 Calculate AI Tactician budget allocation
    - Break down spending with focus on AI attributes and AI Training Academy
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [x] 4.10 Calculate Prestige Rusher budget allocation
    - Break down spending optimized for win rate and prestige accumulation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 5. Write economic analysis for each archetype
  - [x] 5.1 Calculate Tank Fortress economics
    - Project income at 50% win rate for Bronze, Silver, Gold leagues
    - Calculate operating costs (facility costs + repair costs)
    - Show weekly net income for each league tier
    - Assess bankruptcy risk at each league tier
    - Calculate break-even win rate for each league
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 5.2 Calculate Glass Cannon economics
    - Project income and costs across league tiers
    - Explain how high repair costs in Bronze become manageable in Gold
    - Show risk profile changes with league advancement
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 5.3 Calculate Speed Demon economics
    - Project income and costs across league tiers
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 5.4 Calculate Balanced Brawler economics
    - Project income and costs across league tiers
    - Explain why this is most sustainable archetype
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 5.5 Calculate Facility Investor economics
    - Project income including passive income from Income Generator
    - Show how facility benefits compound over time
    - Calculate ROI timelines for major facility investments
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_
  
  - [x] 5.6 Calculate Two-Robot Specialist economics
    - Project income and costs for 2-robot operation
    - Account for Roster Expansion operating costs
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 5.7 Calculate Melee Specialist economics
    - Project income and costs across league tiers
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 5.8 Calculate Ranged Sniper economics
    - Project income and costs across league tiers
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 5.9 Calculate AI Tactician economics
    - Project income and costs across league tiers
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 5.10 Calculate Prestige Rusher economics
    - Project income and costs across league tiers
    - Show prestige accumulation timeline
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 6. Write early game strategy (Days 1-30) for each archetype
  - [x] 6.1 Write Tank Fortress early game strategy
    - Specify battle frequency, income expectations, league progression goals
    - List common pitfalls (e.g., overinvesting in defense early)
    - Explain repair cost management
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 6.2 Write Glass Cannon early game strategy
    - Warn about high bankruptcy risk in Bronze
    - Explain importance of advancing to Silver quickly
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 9.1, 9.2_
  
  - [x] 6.3 Write Speed Demon early game strategy
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 6.4 Write Balanced Brawler early game strategy
    - Emphasize safety and learning
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 6.5 Write Facility Investor early game strategy
    - Explain slow start but sustainable economics
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 6.6 Write Two-Robot Specialist early game strategy
    - Explain robot selection strategy (which robot to use when)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 6.7 Write Melee Specialist early game strategy
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 6.8 Write Ranged Sniper early game strategy
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 6.9 Write AI Tactician early game strategy
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 6.10 Write Prestige Rusher early game strategy
    - Emphasize win rate optimization
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 7. Write mid game transition (Days 30-120) for each archetype
  - [x] 7.1 Write Tank Fortress mid game transition
    - Specify expansion triggers, facility upgrade priorities, income diversification
    - Explain when to purchase additional weapons or robots
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 7.2 Write Glass Cannon mid game transition
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 7.3 Write Speed Demon mid game transition
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 7.4 Write Balanced Brawler mid game transition
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 7.5 Write Facility Investor mid game transition
    - Explain when facility investments start paying off
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 7.6 Write Two-Robot Specialist mid game transition
    - Explain when to consider 3rd robot
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 7.7 Write Melee Specialist mid game transition
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 7.8 Write Ranged Sniper mid game transition
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 7.9 Write AI Tactician mid game transition
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 7.10 Write Prestige Rusher mid game transition
    - Explain tournament access and prestige milestones
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 8. Write build synergies section for each archetype
  - [x] 8.1 Write Tank Fortress build synergies
    - Map to robot build type, loadout, battle stance, yield threshold
    - List attribute priorities with target levels and rationale
    - Explain weapon synergies (why Combat Shield + Power Sword works)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.2 Write Glass Cannon build synergies
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.3 Write Speed Demon build synergies
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.4 Write Balanced Brawler build synergies
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.5 Write Facility Investor build synergies
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.6 Write Two-Robot Specialist build synergies
    - Explain complementary builds (Tank + Glass Cannon)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.7 Write Melee Specialist build synergies
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.8 Write Ranged Sniper build synergies
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.9 Write AI Tactician build synergies
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 8.10 Write Prestige Rusher build synergies
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 9. Write hybrid strategies and transitions section
  - Identify viable archetype combinations (e.g., Tank Fortress → Facility Investor)
  - Explain multi-phase strategies (e.g., Glass Cannon early → Balanced Brawler mid)
  - Specify transition triggers (balance thresholds, prestige levels, league tiers)
  - Describe situational adaptations (responding to losing streaks, capitalizing on win streaks)
  - Explain how to rebalance investments when changing strategies
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 10. Write weapon purchase strategy section
  - Explain that most archetypes only need 1-2 weapons initially
  - Identify when purchasing additional weapons makes sense
  - Explain weapon experimentation costs and why to defer to mid-game
  - Explain Storage Facility requirement for weapon collections
  - Compare trade-offs: multiple weapons vs attribute upgrades vs facilities
  - Identify which archetypes benefit from weapon variety vs fixed loadouts
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 11. Create practical examples with calculations
  - [x] 11.1 Show attribute upgrade cost calculations
    - Example: Upgrading Combat Power from 1→10
    - Show formula: Σ((level + 1) × 1,500)
    - Calculate total cost step-by-step
    - _Requirements: 8.1, 8.2_
  
  - [x] 11.2 Show repair cost calculations
    - Example: Robot with 230 total attributes, 60% damage
    - Show formula: (total_attributes × 100) × damage_% × multiplier
    - Calculate with and without Repair Bay discount
    - _Requirements: 8.1, 8.5_
  
  - [x] 11.3 Show weekly income projections
    - Example: 7 battles/week at 50% win rate in Bronze
    - Calculate: (3.5 wins × ₡7,500) + (7 battles × ₡1,500 participation)
    - Show how income changes in Silver and Gold
    - _Requirements: 8.1, 8.4_
  
  - [x] 11.4 Show facility ROI calculations
    - Example: Training Facility Level 1 ROI
    - Calculate: ₡300K cost / (5% savings on upgrades - ₡10.5K/week operating cost)
    - Show break-even analysis
    - _Requirements: 8.1, 8.2_
  
  - [x] 11.5 Show prestige accumulation timeline
    - Example: Path to 5,000 prestige
    - Calculate: Bronze wins + Silver wins + achievements + tournaments
    - Show realistic timeline (6-12 months)
    - _Requirements: 8.1, 8.6_

- [x] 12. Write risk assessment and warnings section
  - Identify high-risk archetypes (Glass Cannon, Prestige Rusher) and explain risks
  - Warn about bankruptcy scenarios (spending all buffer, losing streaks in Bronze)
  - Explain consequences of poor early decisions (buying wrong facilities, overspending on weapons)
  - Provide recovery strategies (how to recover from bankruptcy or bad start)
  - Identify "trap" investments (facilities with poor early-game ROI)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 13. Create quick reference section
  - Create archetype summary table (Name, Build, Loadout, Risk, Best For)
  - Create budget allocation summary table (all 10 archetypes side-by-side)
  - Create league income reference table (Bronze/Silver/Gold rewards)
  - Create facility cost reference table (purchase costs + operating costs)
  - Create weapon cost reference table (organized by tier)
  - _Requirements: 10.2, 10.3_

- [x] 14. Write appendices
  - [x] 14.1 Appendix A: Complete attribute list with descriptions
    - List all 23 attributes with brief descriptions
    - _Requirements: 10.4_
  
  - [x] 14.2 Appendix B: Complete weapon catalog
    - List all 23 weapons with costs, damage, cooldown, bonuses
    - _Requirements: 10.4_
  
  - [x] 14.3 Appendix C: Complete facility list
    - List all 14 facilities with costs, benefits, operating costs
    - _Requirements: 10.4_
  
  - [x] 14.4 Appendix D: Formula reference
    - List all key formulas (attribute upgrades, repairs, income, etc.)
    - _Requirements: 10.4_
  
  - [x] 14.5 Appendix E: Glossary
    - Define all key terms used in guide
    - _Requirements: 10.4_

- [x] 15. Final review and validation
  - Verify all budget allocations sum to ≤ ₡3,000,000
  - Verify all weapon costs match SEED_DATA_SPECIFICATION.md
  - Verify all facility costs match STABLE_SYSTEM.md
  - Verify all formulas match game documentation
  - Verify all economic projections are realistic
  - Check for consistency in terminology
  - Proofread for clarity and readability
  - Ensure all cross-references are valid
  - Test table of contents links
  - _Requirements: All_

## Notes

- This is a documentation task - the output is a single markdown file
- All calculations must use exact formulas from game documentation
- All costs must match current game data (₡3M starting budget, weapon prices, facility costs)
- Economic projections should be realistic and account for league progression
- Guide should be accessible to new players while providing value to experienced players
- Emphasis on practical, actionable advice with concrete numbers
- Clear warnings about high-risk strategies and common pitfalls
