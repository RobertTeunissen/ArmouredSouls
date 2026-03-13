# Requirements Document

## Introduction

Armoured Souls is a complex robot combat strategy game with many interconnected systems (combat, leagues, economy, facilities, weapons, tournaments, prestige, fame, etc.). Acceptance testers consistently report feeling overwhelmed by the game's complexity and lacking a clear overview of how the moving parts fit together. This feature introduces an in-game guide (encyclopedia) section that explains all game concepts, mechanics, and systems through rich content reinforced by diagrams and images. The guide serves as a persistent, always-accessible reference that helps both new and experienced players understand the game and make informed strategic decisions.

## Glossary

- **Guide**: The in-game encyclopedia/help section accessible from the main navigation
- **Guide_Section**: A top-level category within the Guide (e.g., "Combat", "Economy")
- **Guide_Article**: An individual content page within a Guide_Section explaining a specific topic
- **Guide_Navigation**: The sidebar or menu component that allows browsing Guide_Sections and Guide_Articles
- **Guide_Search**: The search functionality that allows players to find specific topics across all Guide_Articles
- **Rich_Content**: Article content that includes formatted text, diagrams, images, tables, and interactive examples
- **Content_Renderer**: The frontend component responsible for rendering Rich_Content from a structured data source
- **Guide_API**: The backend service that provides Guide content to the frontend
- **Breadcrumb**: A navigation element showing the current location within the Guide hierarchy (e.g., Guide > Combat > Damage Calculation)
- **Table_of_Contents**: A per-article navigation element listing all headings within a Guide_Article for quick jumping
- **Design_System**: The project's UX design system documented in docs/design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md and docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md
- **Notification_Service**: The backend service that builds teaser messages after cron jobs complete and dispatches them through registered integrations
- **Integration**: A pluggable delivery target that implements a send method for dispatching notifications (e.g., Discord webhook)

## Requirements

### Requirement 1: Guide Section Access

**User Story:** As a player, I want to access an in-game guide from the main navigation, so that I can learn about game mechanics at any time without leaving the game.

#### Acceptance Criteria

1. THE Guide SHALL be accessible from the main navigation menu as a persistent top-level link
2. WHEN a player clicks the Guide navigation link, THE Guide SHALL display the Guide landing page within 500ms
3. THE Guide SHALL be accessible to all authenticated players regardless of progression level
4. WHEN a player navigates to the Guide, THE Guide_Navigation SHALL display all available Guide_Sections in a structured sidebar

### Requirement 2: Guide Content Structure

**User Story:** As a player, I want the guide organized into logical sections covering all game systems, so that I can find information about specific topics quickly.

#### Acceptance Criteria

1. THE Guide SHALL organize content into the following Guide_Sections: Getting Started, Robots, Combat, Weapons & Loadouts, Leagues & Matchmaking, Tournaments, Economy & Finances, Stable & Facilities, Prestige & Fame, Strategy Guides, and Integrations & API
2. WHEN a player selects a Guide_Section, THE Guide SHALL display a list of all Guide_Articles within that section with titles and brief descriptions
3. THE Guide_Navigation SHALL display Guide_Sections in a hierarchical sidebar that remains visible while reading Guide_Articles
4. WHEN a player is reading a Guide_Article, THE Guide SHALL display a Breadcrumb showing the path from Guide root to the current article
5. THE Guide SHALL display a Table_of_Contents for each Guide_Article that has more than three headings

### Requirement 3: Rich Content Rendering

**User Story:** As a player, I want guide articles to include diagrams, images, tables, and formatted text, so that complex mechanics are easier to understand visually.

#### Acceptance Criteria

1. THE Content_Renderer SHALL support rendering formatted text with headings, bold, italic, lists, and code blocks
2. THE Content_Renderer SHALL support rendering data tables with headers, rows, and optional column alignment
3. THE Content_Renderer SHALL support rendering inline and block-level images with alt text and optional captions
4. THE Content_Renderer SHALL support rendering diagrams defined in a text-based format (such as Mermaid) for flowcharts, sequence diagrams, and relationship diagrams
5. THE Content_Renderer SHALL support rendering highlighted tip boxes and callout blocks for key gameplay insights
6. WHEN an image fails to load, THE Content_Renderer SHALL display the alt text as a fallback

### Requirement 4: Getting Started Section

**User Story:** As a new player, I want a getting started section that explains the core game loop and basic concepts, so that I understand what the game is about before diving into details.

#### Acceptance Criteria

1. THE Guide SHALL include a "Getting Started" Guide_Section containing articles that explain the core game loop: build robots, configure strategy, enlist in battles, view results, and iterate
2. THE Guide SHALL include an article explaining the daily cycle system and when battles are processed
3. THE Guide SHALL include an article explaining the starting budget (₡3,000,000) and initial spending priorities
4. THE Guide SHALL include an article explaining roster strategy options (1 mighty robot, 2 average robots, 3 flimsy robots) with trade-off comparisons

### Requirement 5: Robot System Guide

**User Story:** As a player, I want to understand the robot attribute system and how attributes affect combat, so that I can make informed decisions when upgrading my robots.

#### Acceptance Criteria

1. THE Guide SHALL include articles explaining all 23 robot attributes organized by their five categories: Combat Systems, Defensive Systems, Chassis & Mobility, AI Processing, and Team Coordination
2. THE Guide SHALL include a diagram showing how robot attributes influence combat outcomes
3. THE Guide SHALL include an article explaining how Hull Integrity affects HP (higher Hull Integrity → more HP) and how Shield Capacity affects Energy Shields (higher Shield Capacity → stronger shields), using impact descriptions rather than exposing internal formulas
4. THE Guide SHALL include an article explaining attribute upgrade costs and the Training Facility discount system
5. THE Guide SHALL include an article explaining attribute caps and how Training Academies unlock higher attribute levels


### Requirement 6: Combat System Guide

**User Story:** As a player, I want to understand how battles work including damage calculation, hit chance, and critical hits, so that I can optimize my robot builds for combat effectiveness.

#### Acceptance Criteria

1. THE Guide SHALL include an article explaining the battle flow: weapon malfunction check, hit chance calculation, critical hit calculation, damage calculation, and damage application through shields and armor
2. THE Guide SHALL include a diagram showing the order of operations for a single attack (malfunction → hit → crit → damage → shield → armor → HP)
3. THE Guide SHALL include an article explaining the Weapon Control malfunction mechanic with examples at different attribute levels
4. THE Guide SHALL include an article explaining how stances (offensive, defensive, balanced) modify combat attributes with a comparison table
5. THE Guide SHALL include an article explaining the yield threshold system, repair costs, and the strategic trade-off between aggressive and conservative yield settings
6. THE Guide SHALL include an article explaining counter-attack mechanics and Energy Shield regeneration during battle

### Requirement 7: Weapons & Loadouts Guide

**User Story:** As a player, I want to understand the weapon types, loadout configurations, and how weapon bonuses work, so that I can choose the right equipment for my strategy.

#### Acceptance Criteria

1. THE Guide SHALL include an article listing all weapon categories (Energy, Ballistic, Melee, Shield) with their general characteristics
2. THE Guide SHALL include an article explaining the four loadout types (Single, Weapon+Shield, Two-Handed, Dual-Wield) with their bonuses, penalties, and recommended use cases
3. THE Guide SHALL include a comparison table showing loadout bonuses and penalties side by side
4. THE Guide SHALL include an article explaining how weapon attribute bonuses apply per-hand in dual-wield configurations
5. THE Guide SHALL include an article explaining offhand attack rules including the 50% base hit chance and 40% cooldown penalty

### Requirement 8: League & Matchmaking Guide

**User Story:** As a player, I want to understand how leagues, matchmaking, ELO, and league points work, so that I can plan my progression through the competitive tiers.

#### Acceptance Criteria

1. THE Guide SHALL include an article explaining the six league tiers (Bronze, Silver, Gold, Platinum, Diamond, Champion) and the instance system (max 100 robots per instance)
2. THE Guide SHALL include an article explaining the matchmaking algorithm: LP-primary matching (±10 LP ideal, ±20 LP fallback) with ELO as secondary quality check
3. THE Guide SHALL include an article explaining League Points (LP) earning (+3 win, -1 loss, +1 draw) and their role in promotion
4. THE Guide SHALL include an article explaining promotion requirements (top 10% of instance + ≥25 LP + ≥5 cycles in tier) and demotion rules (bottom 10% + ≥5 cycles)
5. THE Guide SHALL include an article explaining LP retention across tier changes and the automatic 5-cycle demotion protection for newly promoted robots
6. THE Guide SHALL include a diagram showing the league tier progression path from Bronze to Champion

### Requirement 9: Tournament System Guide

**User Story:** As a player, I want to understand how tournaments work including bracket generation, rewards, and progression, so that I can prepare my robots for tournament competition.

#### Acceptance Criteria

1. THE Guide SHALL include an article explaining the single elimination tournament format, bracket generation, and seeding by ELO
2. THE Guide SHALL include an article explaining tournament eligibility requirements (weapons equipped) and the continuous tournament cycle
3. THE Guide SHALL include an article explaining tournament-specific rewards including credits, prestige, fame, and championship titles with round-based multipliers
4. THE Guide SHALL include an article explaining how bye matches work in tournaments (top seeds advance without battle, no rewards for byes)

### Requirement 10: Economy & Finances Guide

**User Story:** As a player, I want to understand all income sources and expenses, so that I can manage my stable's finances and avoid bankruptcy.

#### Acceptance Criteria

1. THE Guide SHALL include an article explaining the Credits (₡) currency system, starting balance, and all ways to earn credits (battle winnings, merchandising, streaming)
2. THE Guide SHALL include an article explaining battle reward scaling by league tier (Bronze ₡7,500 through Champion ₡225,000) and prestige bonus multipliers
3. THE Guide SHALL include an article explaining all operating costs including facility daily costs and how damage severity, robot attributes, and league tier influence repair expenses
4. THE Guide SHALL include an article explaining how merchandising income works and how higher Prestige leads to greater passive income, using impact descriptions rather than exposing internal formulas
5. THE Guide SHALL include an article explaining how streaming revenue works and how more battles, higher Fame, and the Streaming Studio facility increase streaming income, using impact descriptions rather than exposing internal formulas
6. THE Guide SHALL include a diagram showing the daily financial cycle: revenue streams flowing in, operating costs flowing out, and net income calculation

### Requirement 11: Stable & Facilities Guide

**User Story:** As a player, I want to understand all 15 facility types and their benefits, so that I can prioritize facility investments for my strategy.

#### Acceptance Criteria

1. THE Guide SHALL include an article listing all 15 facility types with their purpose, cost range, operating costs, and key benefits
2. THE Guide SHALL include articles for each facility explaining level progression, prestige requirements, and ROI analysis
3. THE Guide SHALL include an article explaining the Training Academy system and how the four academies (Combat, Defense, Mobility, AI) control attribute caps from level 10 to level 50
4. THE Guide SHALL include an article explaining the Coaching Staff system including coach types, bonuses, switching costs, and the one-active-coach limitation
5. THE Guide SHALL include a recommended facility investment order for early, mid, and late game stages

### Requirement 12: Prestige & Fame Guide

**User Story:** As a player, I want to understand the difference between Prestige and Fame and how they benefit my stable, so that I can plan my long-term progression.

#### Acceptance Criteria

1. THE Guide SHALL include an article explaining Prestige as a stable-level permanent reputation score that unlocks facilities and content, with earning rates by league tier
2. THE Guide SHALL include an article explaining Fame as a robot-level reputation score with performance bonuses (perfect victory 2x, dominating 1.5x, comeback 1.25x)
3. THE Guide SHALL include an article explaining Prestige rank titles (Novice, Established, Veteran, Elite, Champion, Legendary) and their thresholds
4. THE Guide SHALL include an article explaining Fame tiers (Unknown, Known, Famous, Renowned, Legendary, Mythical) and their thresholds
5. THE Guide SHALL include an article explaining how Prestige affects income multipliers (battle winnings bonus and merchandising scaling)

### Requirement 13: Strategy Guides

**User Story:** As a player, I want to read about viable build archetypes and strategic approaches, so that I can develop effective strategies for my robots.

#### Acceptance Criteria

1. THE Guide SHALL include articles explaining at least five build archetypes: Tank, Glass Cannon, Speed Demon, Counter Striker, and Sniper with recommended attributes, weapons, loadouts, and stances
2. THE Guide SHALL include an article explaining the strategic implications of yield threshold settings with cost/benefit analysis for aggressive vs conservative approaches
3. THE Guide SHALL include an article explaining early game budget allocation strategies for 1-robot, 2-robot, and 3-robot approaches

### Requirement 14: Guide Search

**User Story:** As a player, I want to search across all guide content, so that I can quickly find information about a specific topic without browsing through sections manually.

#### Acceptance Criteria

1. THE Guide_Search SHALL accept text input and return matching Guide_Articles ranked by relevance
2. WHEN a player enters a search query of at least 2 characters, THE Guide_Search SHALL display matching results within 300ms
3. THE Guide_Search SHALL search across article titles, section names, and article body content
4. WHEN no results match the search query, THE Guide_Search SHALL display a "no results found" message with suggestions for related sections
5. WHEN a player selects a search result, THE Guide SHALL navigate to the matching Guide_Article and highlight the matched term

### Requirement 15: Guide Content Management

**User Story:** As a developer, I want guide content stored in a structured, maintainable format, so that articles can be added and updated without code changes to the frontend.

#### Acceptance Criteria

1. THE Guide_API SHALL serve Guide content from structured data files (Markdown or JSON) stored in the backend
2. WHEN a Guide_Article is requested, THE Guide_API SHALL return the article content, metadata (title, section, last updated date), and navigation context (previous/next articles)
3. THE Guide_API SHALL support adding new Guide_Articles and Guide_Sections without requiring frontend code changes
4. THE Guide_API SHALL return article content with a last-updated timestamp so players can see when information was last verified

### Requirement 16: Responsive Layout

**User Story:** As a player on a mobile device, I want the guide to be readable and navigable on smaller screens, so that I can reference game mechanics on any device.

#### Acceptance Criteria

1. WHILE the viewport width is less than 768 pixels, THE Guide SHALL collapse the Guide_Navigation sidebar into a toggleable menu
2. WHILE the viewport width is less than 768 pixels, THE Guide SHALL render images and diagrams at a maximum width of 100% of the viewport
3. THE Guide SHALL render tables in a horizontally scrollable container when the table width exceeds the viewport width
4. THE Guide SHALL maintain readable font sizes (minimum 16px body text) across all viewport sizes

### Requirement 17: Cross-Linking Between Articles

**User Story:** As a player reading about one system, I want links to related topics in other sections, so that I can explore connected mechanics without losing my place.

#### Acceptance Criteria

1. THE Content_Renderer SHALL support inline links to other Guide_Articles within article body content
2. WHEN a player clicks a cross-link, THE Guide SHALL navigate to the linked Guide_Article while preserving the Guide_Navigation state
3. THE Guide SHALL display a "Related Articles" section at the bottom of each Guide_Article listing 2-5 related topics from other Guide_Sections
4. IF a player navigates via cross-link, THEN THE Guide SHALL update the Breadcrumb to reflect the new location

### Requirement 18: Error Handling

**User Story:** As a player, I want the guide to handle errors gracefully, so that a missing article or failed content load does not break my experience.

#### Acceptance Criteria

1. IF the Guide_API returns an error when loading a Guide_Article, THEN THE Guide SHALL display a user-friendly error message with a retry option
2. IF a cross-link references a Guide_Article that does not exist, THEN THE Guide SHALL display a "content not found" message instead of a broken page
3. IF the Guide_API is unreachable, THEN THE Guide SHALL display a cached version of the Guide_Navigation with an offline indicator

### Requirement 19: UX Design System Compliance

**User Story:** As a player, I want the guide to look and feel consistent with the rest of the management interface, so that the experience feels cohesive and polished.

#### Acceptance Criteria

1. THE Guide SHALL comply with the project UX design system documented in docs/design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md and docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md for all UI components, layouts, and visual elements
2. THE Guide SHALL use the Direction B (Precision/Engineering) logo state on all Guide pages, consistent with the management context
3. THE Guide SHALL use the established color system, typography scale, spacing tokens, and component patterns defined in the Design_System
4. THE Guide SHALL follow the emotional design strategy (mastery, pride, deliberate ownership) in content presentation and visual hierarchy
5. THE Guide SHALL maintain consistent visual hierarchy with other management pages by using the established card patterns, badge styles, and icon systems from the Design_System

### Requirement 20: Integrations & API Guide

**User Story:** As a player or community member, I want to understand how the game's notification and webhook system works, so that I can build my own integrations to receive game notifications.

#### Acceptance Criteria

1. THE Guide SHALL include a Guide_Section titled "Integrations & API" covering the game's notification and webhook systems
2. THE Guide SHALL include an article explaining how the Notification_Service dispatches messages after scheduled cron jobs (league, tournament, tag team, settlement) to connected channels
3. THE Guide SHALL include an article explaining the pluggable Integration interface concept and how new delivery targets (Discord, Slack, email) can be added
4. THE Guide SHALL include an article explaining how to set up a personal webhook integration to receive game notifications, including the role of environment variables (APP_BASE_URL, DISCORD_WEBHOOK_URL)
5. THE Guide SHALL include a diagram showing the notification flow from cron job completion through the Notification_Service to registered integrations
6. IF the Integrations & API section references technical configuration details, THEN THE Guide SHALL present the information in a community-friendly format accessible to non-developers
