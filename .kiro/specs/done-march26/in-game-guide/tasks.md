# Implementation Plan: In-Game Guide

## Overview

Build a read-only encyclopedia feature for Armoured Souls. Backend serves Markdown content via REST API; frontend renders rich content with Mermaid diagrams, search, and responsive layout. No database tables — all content is file-based. Implementation proceeds bottom-up: backend services → API routes → frontend components → content authoring → integration wiring → tests.

## Tasks

- [x] 1. Backend infrastructure and content parsing
  - [x] 1.1 Install backend dependencies and create content directory structure
    - Install `gray-matter` package in `app/backend/`
    - Create `app/backend/src/content/guide/` directory
    - Create `sections.json` with all 11 sections (getting-started, robots, combat, weapons, leagues, tournaments, economy, facilities, prestige-fame, strategy, integrations) per the design data model
    - Create empty subdirectories for each section
    - _Requirements: 2.1, 15.1_

  - [x] 1.2 Implement MarkdownParser service
    - Create `app/backend/src/services/markdown-parser.ts`
    - Implement YAML frontmatter parsing using `gray-matter`
    - Implement heading extraction (h2, h3) with slugified anchor IDs for table of contents
    - Implement plain-text stripping (remove Markdown syntax) for search index body text
    - Implement frontmatter validation (required fields: title, description, order, lastUpdated)
    - Log warnings for malformed frontmatter via existing logger
    - _Requirements: 15.1, 15.2_

  - [x] 1.3 Write unit tests for MarkdownParser
    - Test valid YAML frontmatter parsing
    - Test missing required fields handling
    - Test malformed YAML handling
    - Test heading extraction with correct levels and slugified IDs
    - Test plain-text stripping for search index
    - _Requirements: 15.1_

  - [x] 1.4 Implement GuideService
    - Create `app/backend/src/services/guide-service.ts`
    - Implement `getSections()`: read `sections.json`, scan each section directory for `.md` files, parse frontmatter, return `GuideSection[]` sorted by order
    - Implement `getArticle(sectionSlug, articleSlug)`: read specific `.md` file, parse frontmatter + body, extract headings, resolve relatedArticles (filter non-existent), compute previous/next article links, return `GuideArticle | null`
    - Implement `getSearchIndex()`: iterate all articles, return `SearchIndexEntry[]` with plain-text body
    - Implement in-memory cache (`GuideCache` with sections, articles Map, searchIndex) populated on first request
    - Implement `invalidateCache()` method
    - Handle errors: missing content directory returns empty list, file read errors logged and return null, invalid relatedArticles silently filtered
    - _Requirements: 1.4, 2.2, 14.3, 15.1, 15.2, 15.3, 17.3, 18.1_

  - [x] 1.5 Write property tests for GuideService
    - **Property 2: Section and article listing completeness** — generate random `sections.json` + article files, verify `getSections()` returns all sections and all articles with non-empty title and description
    - **Validates: Requirements 1.4, 2.2**
    - **Property 7: Article API response completeness** — generate random valid article files, verify `getArticle()` response includes all required fields (title, body, sectionSlug, sectionTitle, lastUpdated as ISO 8601, headings array, relatedArticles array, previousArticle/nextArticle)
    - **Validates: Requirements 15.2**
    - **Property 8: Related articles display bounds** — generate articles with random relatedArticles (some valid, some invalid), verify filtering to 0-5 entries and all reference existing articles
    - **Validates: Requirements 17.3**

  - [x] 1.6 Write unit tests for GuideService
    - Test that all 11 required sections exist (Req 2.1)
    - Test that specific articles exist for each section per Req 4-13 and Req 20
    - Test 404 behavior for non-existent section/article slugs
    - Test cache invalidation
    - _Requirements: 2.1, 4.1-4.4, 5.1-5.5, 6.1-6.6, 7.1-7.5, 8.1-8.6, 9.1-9.4, 10.1-10.6, 11.1-11.5, 12.1-12.5, 13.1-13.3, 20.1-20.6_

- [x] 2. Backend API routes
  - [x] 2.1 Implement Guide Router
    - Create `app/backend/src/routes/guide.ts`
    - `GET /api/guide/sections` → call `GuideService.getSections()`, return JSON
    - `GET /api/guide/articles/:sectionSlug/:articleSlug` → call `GuideService.getArticle()`, return JSON or 404
    - `GET /api/guide/search-index` → call `GuideService.getSearchIndex()`, return JSON
    - All endpoints behind `authenticateToken` middleware
    - Error responses follow existing pattern: `{ error: string }`
    - _Requirements: 1.3, 15.2, 15.4, 18.1_

  - [x] 2.2 Register guide routes in backend entry point
    - Add `app.use('/api/guide', guideRoutes)` to `app/backend/src/index.ts`
    - _Requirements: 1.1_

  - [x] 2.3 Write unit tests for Guide Router
    - Test 200 responses for valid section/article slugs
    - Test 404 responses for invalid slugs
    - Test 401 responses for unauthenticated requests
    - **Property 1: Authenticated access without progression gating** — generate random authenticated user objects with varying prestige/league/robot count, verify all guide endpoints return 200 and never 403
    - **Validates: Requirements 1.3**
    - _Requirements: 1.3, 18.1_

- [x] 3. Checkpoint — Backend complete
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 4. Frontend infrastructure and core components
  - [x] 4.1 Install frontend dependencies and create component directory
    - Install `react-markdown`, `remark-gfm`, `mermaid` packages in `app/frontend/`
    - Create `app/frontend/src/components/guide/` directory
    - Create `app/frontend/src/utils/guideApi.ts` with `fetchGuideSections()`, `fetchGuideArticle()`, `fetchSearchIndex()` functions using existing `apiClient`
    - _Requirements: 3.1, 3.4_

  - [x] 4.2 Implement ContentRenderer component
    - Create `app/frontend/src/components/guide/ContentRenderer.tsx`
    - Use `react-markdown` with `remark-gfm` plugin
    - Custom heading renderer: add anchor IDs matching slugified heading text
    - Custom code block renderer: delegate ` ```mermaid ` blocks to `MermaidDiagram`, delegate ` ```callout-tip/warning/info ` blocks to `CalloutBlock`
    - Custom image renderer: `loading="lazy"`, `onError` handler shows alt text in styled placeholder div
    - Custom table renderer: wrap in horizontally scrollable container
    - Custom link renderer: internal `/guide/` links use React Router `<Link>`, external links open in new tab
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 16.3, 17.1, 17.2_

  - [x] 4.3 Implement MermaidDiagram component
    - Create `app/frontend/src/components/guide/MermaidDiagram.tsx`
    - Render Mermaid source to SVG using `mermaid.render()`
    - On render failure, display raw source in a code block with "Diagram could not be rendered" caption
    - _Requirements: 3.4_

  - [x] 4.4 Implement CalloutBlock component
    - Create `app/frontend/src/components/guide/CalloutBlock.tsx`
    - Support tip, warning, and info variants with appropriate styling per design system
    - _Requirements: 3.5_

  - [x] 4.5 Write property test for ContentRenderer
    - **Property 5: Content rendering fidelity** — generate random Markdown strings with headings, tables, images, mermaid blocks, and callout blocks; verify rendered output contains matching element counts for each type
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 5. Frontend navigation and page components
  - [x] 5.1 Implement GuideNavigation component
    - Create `app/frontend/src/components/guide/GuideNavigation.tsx`
    - Render collapsible section list in sidebar
    - Highlight current article
    - Responsive: sidebar on desktop, toggleable drawer on mobile (<768px)
    - _Requirements: 1.4, 2.3, 16.1_

  - [x] 5.2 Implement GuideBreadcrumb component
    - Create `app/frontend/src/components/guide/GuideBreadcrumb.tsx`
    - Render three segments: Guide → Section → Article with correct links
    - Update on cross-link navigation
    - _Requirements: 2.4, 17.4_

  - [x] 5.3 Implement GuideTableOfContents component
    - Create `app/frontend/src/components/guide/GuideTableOfContents.tsx`
    - Render sticky ToC from article headings array
    - Only render when article has more than 3 headings
    - _Requirements: 2.5_

  - [x] 5.4 Implement GuideSearch and GuideSearchResults components
    - Create `app/frontend/src/components/guide/GuideSearch.tsx` and `GuideSearchResults.tsx`
    - Search input with 200ms debounce, minimum 2 character query
    - On first interaction, fetch `/api/guide/search-index` and cache in state
    - Filter entries by case-insensitive substring match against title, sectionTitle, bodyText
    - Rank results: title matches first, then section matches, then body matches
    - Highlight matched terms in results
    - Show "No results found" with section suggestions when empty
    - Handle search index fetch failure: show "Search unavailable", disable input
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 5.5 Write property tests for search and navigation components
    - **Property 6: Search completeness and ranking** — generate random search indices and query strings (2+ chars), verify all matching entries returned and title matches rank before section matches rank before body-only matches
    - **Validates: Requirements 14.1, 14.3**
    - **Property 3: Breadcrumb path correctness** — generate random section/article names, verify breadcrumb produces exactly 3 segments with correct routes
    - **Validates: Requirements 2.4**
    - **Property 4: Table of Contents conditional rendering** — generate articles with random heading counts, verify ToC rendered when >3 headings, not rendered when ≤3
    - **Validates: Requirements 2.5**

  - [x] 5.6 Implement GuideLandingPage component
    - Create `app/frontend/src/components/guide/GuideLandingPage.tsx`
    - Display all sections as cards with title and description
    - _Requirements: 1.2, 2.2_

  - [x] 5.7 Implement GuideArticleView and GuideRelatedArticles components
    - Create `app/frontend/src/components/guide/GuideArticleView.tsx` and `GuideRelatedArticles.tsx`
    - Article layout: breadcrumb + ToC + ContentRenderer + related articles + previous/next navigation
    - Related articles block at bottom showing 2-5 related topics
    - _Requirements: 2.4, 2.5, 15.2, 17.3_

  - [x] 5.8 Implement GuidePage and wire routing
    - Create `app/frontend/src/pages/GuidePage.tsx`
    - Use `useParams()` to determine current view (landing / section / article)
    - Manage state: sections list, current article, search state, error states
    - Add routes in `App.tsx`: `/guide`, `/guide/:sectionSlug`, `/guide/:sectionSlug/:articleSlug` wrapped in `<ProtectedRoute>`
    - Add "Guide" link to main navigation
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 5.9 Implement error handling states
    - API 404: display "Article not found" with link back to guide landing
    - API 500: display "Something went wrong" with "Try Again" button
    - Network error: display cached navigation with "Offline" indicator, article area shows connection error message
    - Image load failure: alt text fallback (handled in ContentRenderer)
    - _Requirements: 18.1, 18.2, 18.3_

- [x] 6. Checkpoint — Frontend components complete
  - Ensure all frontend tests pass, ask the user if questions arise.

- [x] 7. Content authoring
  - [x] 7.1 Create Getting Started section articles
    - `core-game-loop.md` — core game loop explanation with mermaid diagram (Build → Configure → Battle → Results → Iterate)
    - `daily-cycle.md` — daily cycle system and battle processing
    - `starting-budget.md` — starting ₡3,000,000 and initial spending priorities
    - `roster-strategy.md` — 1/2/3 robot approaches with trade-off comparisons
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.2 Create Robots section articles
    - Articles covering all 23 attributes in 5 categories, attribute-combat influence diagram, Hull Integrity/Shield Capacity impact descriptions, upgrade costs and Training Facility discounts, attribute caps and Training Academies
    - Include mermaid diagram for attribute-combat influence (Req 5.2)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.3 Create Combat section articles
    - `battle-flow.md` with mermaid diagram for attack order of operations (Req 6.2)
    - `malfunctions.md` — Weapon Control malfunction mechanic with examples
    - `stances.md` — offensive/defensive/balanced comparison table
    - `yield-threshold.md` — yield system, repair costs, strategic trade-offs
    - `counter-attacks.md` — counter-attack mechanics and Energy Shield regeneration
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 7.4 Create Weapons & Loadouts section articles
    - Weapon categories (Energy, Ballistic, Melee, Shield), loadout types with bonuses/penalties comparison table, dual-wield per-hand bonuses, offhand attack rules
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 7.5 Create Leagues & Matchmaking section articles
    - League tiers and instance system, matchmaking algorithm, LP earning/spending, promotion/demotion rules, LP retention, mermaid diagram for tier progression (Req 8.6)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 7.6 Create Tournaments section articles
    - Single elimination format and bracket generation, eligibility requirements, tournament rewards with round multipliers, bye match mechanics
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 7.7 Create Economy & Finances section articles
    - Credits system and income sources, battle reward scaling by tier, operating costs and repair expenses, merchandising income (impact descriptions), streaming revenue (impact descriptions), mermaid diagram for daily financial cycle (Req 10.6)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 7.8 Create Stable & Facilities section articles
    - All 15 facility types overview, individual facility articles with level progression and ROI, Training Academy system (4 academies, caps 10-50), Coaching Staff system, recommended investment order by game stage
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 7.9 Create Prestige & Fame section articles
    - Prestige as stable-level score with earning rates, Fame as robot-level score with performance bonuses, Prestige rank titles and thresholds, Fame tier titles and thresholds, Prestige income multiplier effects
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 7.10 Create Strategy Guides section articles
    - 5 build archetypes (Tank, Glass Cannon, Speed Demon, Counter Striker, Sniper) with recommended attributes/weapons/loadouts/stances
    - Yield threshold strategy article with cost/benefit analysis
    - Early game budget allocation for 1/2/3 robot approaches
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 7.11 Create Integrations & API section articles
    - Notification service overview, pluggable Integration interface, webhook setup guide with environment variables, mermaid diagram for notification flow (Req 20.5), community-friendly format (Req 20.6)
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

  - [x] 7.12 Create placeholder images
    - Create `app/frontend/public/images/guide/` directory structure with all 33 placeholder images (solid color with text label) organized by section
    - Placeholders allow development to proceed; final assets replace them later
    - _Requirements: 3.3, 5.2, 6.2, 8.6, 10.6, 20.5_

- [x] 8. Checkpoint — Content authoring complete
  - Ensure all content files have valid frontmatter, all sections populated, all required mermaid diagrams present. Ask the user if questions arise.

- [x] 9. Content validation and integration tests
  - [x] 9.1 Write content validation tests
    - Create `app/backend/src/__tests__/guide/content-validation.test.ts`
    - Verify all 11 required sections exist in `sections.json`
    - Verify each section directory contains at least one `.md` file
    - Verify all `.md` files have valid frontmatter (title, description, order, lastUpdated)
    - Verify all `relatedArticles` references point to existing files
    - Verify specific articles exist per Req 4-13 and Req 20
    - Verify articles requiring diagrams contain at least one ` ```mermaid ` block (Req 5.2, 6.2, 8.6, 10.6, 20.5)
    - _Requirements: 2.1, 4.1-4.4, 5.2, 6.2, 8.6, 10.6, 15.1, 20.5_

  - [x] 9.2 Write frontend unit tests
    - Create tests in `app/frontend/src/__tests__/guide/`
    - `GuidePage.test.tsx` — renders landing page with all sections
    - `GuideNavigation.test.tsx` — sidebar renders sections, highlights current, collapses on mobile
    - `GuideSearch.test.tsx` — debounce behavior, minimum 2 chars, no-results message
    - `ContentRenderer.test.tsx` — image error fallback, cross-link rendering, table scroll wrapper
    - `GuideArticleView.test.tsx` — related articles section, previous/next navigation
    - `error-handling.test.tsx` — API error states: 404 message, 500 retry button, offline indicator
    - _Requirements: 1.2, 1.4, 3.6, 14.2, 14.4, 16.1, 17.1, 18.1, 18.2, 18.3_

- [x] 10. Final checkpoint — All tests pass
  - Run full test suite (`npm test` in both backend and frontend). Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document using fast-check
- All 33 images start as placeholders — final assets are created separately
- No database migrations needed; all content is file-based
- Checkpoints ensure incremental validation at backend, frontend, and content milestones
