# Product Requirements Document: Admin Page UX Improvements

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: 1.2  
**Date**: February 4, 2026  
**Author**: GitHub Copilot  
**Status**: Revised based on Robert's feedback

---

## Version History
- v1.0 - Initial draft by GitHub Copilot
- v1.1 - Review by Robert Teunissen with inline comments
- v1.2 - Revised to address all feedback, moved to /docs/

---

## Executive Summary

The Admin Page (`/admin`) is the primary testing tool for Armoured Souls during the prototype phase. It enables rapid cycle testing, battle debugging, and system monitoring. This PRD outlines targeted improvements to make the admin page more intuitive and efficient.

**Key Goals:**
- Make System Statistics visible by default (critical information)
- Improve session logging to track all cycle operations
- Add tabbed interface for better organization
- Enable robot click-through links from battle logs
- Add real-time battle stream during bulk cycles
- Reduce UI clutter and improve information hierarchy

---

## Current State Analysis

### What the Admin Page Does

The Admin Page provides three main functional areas:

1. **System Statistics** - Overview of robots, matches, and battles
2. **Daily Cycle Controls** - Manual triggering of game systems (matchmaking, battles, league rebalancing, repairs, finances)
3. **Battle Logs & Debugging** - Searchable table of recent battles with detailed modal view

### Current Implementation Strengths

✅ **Comprehensive Functionality**: All core admin operations are accessible  
✅ **Battle Details Modal**: Rich debugging information with combat logs and formula breakdowns  
✅ **Search & Filter**: Can search by robot name and filter by league  
✅ **Pagination**: Handles large battle histories efficiently  
✅ **Visual Hierarchy**: Clear sections with consistent styling  
✅ **Real-time Feedback**: Toast messages confirm action outcomes  
✅ **Robot Statistics**: Advanced analytics with outlier detection and win-rate analysis  
✅ **Bulk Cycle Runner**: Existing feature runs multiple cycles with auto-repair and daily finances

### Current Pain Points & Priority Issues

#### 1. **System Statistics Hidden by Default** ⭐ HIGH PRIORITY
- **Issue**: Critical information not immediately visible - must click "Refresh Stats"
- **Impact**: User cannot see current system state without manual action
- **Solution**: Make System Statistics visible on page load

#### 2. **Cycle Controls Taking Too Much Space**
- **Issue**: Both individual step buttons AND bulk cycle runner displayed simultaneously
- **Impact**: Page feels cluttered; both serve different but valid purposes
- **Solution**: Reorganize layout or use tabs to preserve both workflows

#### 3. **Session Log Missing Critical Information**
- **Issue**: No comprehensive log of cycle operations including:
  - Daily finance processing and results
  - Tier rebalancing events (e.g., bronze_1 splitting into bronze_1 & bronze_2)
  - League merging/creation events
- **Impact**: Cannot track what happened during complex cycles
- **Solution**: Enhanced session log with all operation details

#### 4. **No Robot Click-Through in Battle Logs**
- **Issue**: Cannot click robot names to navigate to their detail page
- **Impact**: Must manually search for robots when debugging battles
- **Solution**: Make robot names clickable links to existing robot pages

#### 5. **Bulk Cycle UI Bug**
- **Issue**: After completing bulk cycles, page turns blank (data/processing unaffected)
- **Impact**: User must refresh to see results
- **Solution**: Fix blank page bug

#### 6. **Admin Battles vs Normal Battles Unclear**
- **Question**: What's the difference between `/api/admin/battles` and regular battles?
- **Impact**: Confusion about data sources and purposes
- **Solution**: Document distinction clearly

#### 7. **No Real-Time Progress During Bulk Cycles**
- **Issue**: Must switch to terminal to watch backend logs
- **Impact**: No visibility into long-running operations
- **Solution**: Real-time battle stream showing progress

#### 8. **Robot Statistics Not Prominent**
- **Issue**: Powerful debugging tool hidden behind "Load Robot Statistics" button
- **Impact**: Underutilized feature
- **Solution**: Always-visible panel or better placement

#### 9. **Missing Financial and Facility Statistics**
- **Issue**: No visibility into:
  - Facility purchase statistics (how many users bought each facility)
  - Financial health tracking (bankruptcy warnings, total funds)
- **Impact**: Cannot monitor economic balance
- **Solution**: Expand System Statistics section

---

## Proposed Admin Page Structure (With Tabs)

### Tab-Based Organization

```
╔════════════════════════════════════════════════════════════════╗
║ ADMIN PORTAL                                [Refresh All] [💰] ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║ [Dashboard] [Cycle Controls] [Battle Logs] [Robot Stats]      ║
║ ───────────                                                    ║
║                                                                ║
║  ... tab content ...                                           ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

### Tab 1: Dashboard (Default View)
**Purpose**: At-a-glance system health and recent activity

**Content**:
- **System Statistics** (always visible, no button needed)
  - Robot stats (total, by tier, battle-ready %)
  - Match stats (scheduled, completed)
  - Battle stats (last 24h, total, draws %, kills)
  - Financial stats (total funds in system, users at risk of bankruptcy)
  - Facility stats (purchases by type, most popular facilities)
- **Recent Session Log** (last 10 actions)
  - Compact view of recent operations
  - Link to "Cycle Controls" tab for full log

### Tab 2: Cycle Controls
**Purpose**: Run game cycles and view detailed logs

**Content**:
- **Quick Actions** (side by side to save space)
  - Individual step buttons: [Auto-Repair] [Matchmaking] [Battles] [Rebalance] [Daily Finances]
- **Bulk Cycle Runner**
  - Cycle count (1-100)
  - Checkboxes: Auto-repair, Daily finances
  - [Run Bulk Cycles] button
  - Progress indicator during execution
- **Enhanced Session Log** (full details)
  - All operations with timestamps
  - Includes: matchmaking results, battle summary, league rebalancing, tier splits/merges, finance processing, bankruptcy events
  - Persists in localStorage
  - [Export Log] button

### Tab 3: Battle Logs
**Purpose**: Search and debug battles

**Content**:
- Search and filter controls (robot name, league)
- Battle table with clickable robot names
- Pagination
- Battle details modal (existing functionality)

### Tab 4: Robot Stats
**Purpose**: Deep-dive analysis of robot attributes

**Content**:
- Existing robot statistics interface
- Always available without loading button
- Attribute selector and analysis tools

---

## Proposed UX Improvements (Prioritized)

### Phase 1: Critical Fixes & Restructuring

#### 1.1 Implement Tabbed Interface ⭐ HIGH PRIORITY
**Problem Solved**: Reduces clutter, separates concerns, makes navigation intuitive

**Implementation**:
- Add tab navigation component with 4 tabs
- Move content into appropriate tabs
- Persist active tab in localStorage
- URL hash reflects current tab (e.g., `/admin#battles`)

#### 1.2 Make System Statistics Visible by Default ⭐ HIGH PRIORITY
**Problem Solved**: Critical information immediately available

**Implementation**:
- Load system statistics automatically on page mount
- Display in Dashboard tab (no button required)
- Add [Refresh Stats] button in header for manual updates
- Update stats automatically after cycle operations

#### 1.3 Enhanced Session Log ⭐ HIGH PRIORITY
**Problem Solved**: Complete visibility into cycle operations

**Implementation**:
- Track ALL operations:
  - Auto-repair: "Repaired 45 robots"
  - Matchmaking: "Created 34 matches"
  - Battles: "45/45 successful, 0 failed"
  - League rebalancing: "3 promoted, 2 demoted"
  - Tier events: "Bronze league split: bronze_1 → bronze_1 & bronze_2"
  - Finance processing: "Processed 15 users, ₡25,000 deducted, 1 bankruptcy"
- Store in localStorage (max 100 entries, FIFO)
- [Clear Log] and [Export Log] buttons
- Show compact recent log in Dashboard, full log in Cycle Controls tab

#### 1.4 Fix Bulk Cycle Blank Page Bug
**Problem Solved**: Page displays results correctly

**Implementation**:
- Debug React state issue causing blank page
- Ensure bulk results properly update UI
- Add error handling for state updates

#### 1.5 Robot Name Click-Through Links
**Problem Solved**: Seamless navigation to robot details

**Implementation**:
- Make robot names in battle table clickable
- Links open existing `/robots/:id` page in new tab
- Use standard browser link behavior (Ctrl+click, Shift+click)

### Phase 2: Enhanced Visibility & Monitoring

#### 2.1 Expanded System Statistics
**Problem Solved**: Better monitoring of game economy and balance

**Implementation**:
- **Battle Statistics Section**:
  - Total battles, last 24h
  - Draw percentage and analysis
  - Average battle duration
  - Most common outcomes
- **Financial Statistics Section**:
  - Total credits in system
  - Average player balance
  - Users at risk of bankruptcy (balance < daily costs × 3)
  - Recent bankruptcy events
- **Facility Statistics Section**:
  - Purchase counts by facility type
  - Most/least popular facilities
  - Revenue from facility purchases

#### 2.2 Real-Time Battle Stream During Bulk Cycles ⭐
**Problem Solved**: No need to watch terminal logs

**Implementation**:
- During bulk cycle execution, show live feed of battles completing
- Mini battle cards showing: Winner, Duration, ELO changes
- Color-coded by outcome (normal vs. upset)
- Auto-scrolls with [Pause] button
- Shows cycle progress: "Cycle 23/50 - Battle 12/45"

#### 2.3 Battle Table Visual Enhancements
**Problem Solved**: Quick identification of interesting battles

**Implementation**:
- Add outcome icons in winner column:
  - 🏆 Clear victory (HP > 50)
  - 💪 Narrow victory (HP 1-50)
  - ⚖️ Draw
  - ⏱️ Max duration reached
- Subtle colored borders for unusual battles:
  - Red border: Draw (rare)
  - Yellow border: Battle > 90s (balance issue)
  - Blue border: Large ELO swing (>50 points)

### Phase 3: Polish & Quality of Life

#### 3.1 Robot Statistics Panel Improvements
**Problem Solved**: More discoverable and accessible

**Implementation**:
- Move to dedicated Robot Stats tab
- Auto-load on first view (persist in session)
- Add filtering and sorting options
- Direct links from outliers to robot detail pages

#### 3.2 Navigation Bar Updates During Cycles
**Problem Solved**: Stale financial data in navbar

**Implementation**:
- After cycle completion, refresh navbar money display
- Consider auto-refresh or manual refresh prompt
- Ensure all displayed values are current

#### 3.3 Battle Details Modal Clarification
**Problem Solved**: Understand admin vs. normal battle views

**Documentation Update**:
- Admin battles show actual numeric values
- Normal battle reports show narrative text only
- Both use same data source, different presentation
- Document in technical docs and inline help

---

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Fix critical issues and restructure UI

**Tasks**:
- [ ] Implement tabbed interface (Dashboard, Cycle Controls, Battle Logs, Robot Stats)
- [ ] Make System Statistics visible by default in Dashboard tab
- [ ] Build enhanced session log with all cycle operation details
- [ ] Fix bulk cycle blank page bug
- [ ] Add robot name click-through links in battle table
- [ ] Move existing content into appropriate tabs

**Risk**: Low - mostly frontend reorganization

### Phase 2: Enhanced Monitoring (Weeks 3-4)
**Goal**: Add missing statistics and visibility

**Tasks**:
- [ ] Expand System Statistics with battle, financial, and facility sections
- [ ] Implement real-time battle stream during bulk cycles
- [ ] Add battle table visual enhancements (icons, colored borders)
- [ ] Update navbar money display after cycles
- [ ] Improve robot statistics panel in dedicated tab

**Risk**: Medium - requires backend changes for real-time streaming

### Phase 3: Polish (Week 5)
**Goal**: Refinement and documentation

**Tasks**:
- [ ] Document admin battles vs. normal battles distinction
- [ ] Add inline help tooltips where needed
- [ ] Performance optimization (caching, lazy loading)
- [ ] Comprehensive testing across all tabs
- [ ] Update admin page documentation

**Risk**: Low

---

## Technical Considerations

### Frontend (React/TypeScript)
- **Tabbed Interface**: Use React Router or state-based tabs
- **Session Log**: Store in localStorage, max 100 entries
- **Real-Time Stream**: WebSocket or polling during bulk cycles
- **Responsive Design**: Ensure tabs work on different screen sizes
- **Type Safety**: Maintain strict TypeScript for all new components

### Backend (Node.js/Prisma)
- **Real-Time Updates**: Consider WebSocket endpoint for battle streaming
- **Session Tracking**: May need to enhance cycle endpoints to return detailed logs
- **Statistics Aggregation**: Add queries for financial and facility stats
- **Performance**: Cache frequently accessed statistics

### Database
- **No schema changes required** for Phase 1-2
- **Potential indexes**: Add if statistics queries are slow

### Testing Strategy
- **Component tests**: New tab navigation and session log
- **Integration tests**: Cycle operations and logging
- **Manual testing**: Verify all workflows still function
- **Performance testing**: Ensure statistics load quickly

---

## Design Alignment

### Color Palette Verification

The existing admin page uses Tailwind's gray-based palette. Verify alignment with design system:

**Current Admin Colors**:
- Background: `gray-900` (#111827)
- Cards: `gray-800` (#1F2937)
- Accents: `gray-700` (#374151)

**Design System Colors** (from `/docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md`):
- Background: `#0a0e14` (Deep space black)
- Surface: `#1a1f29` (Dark panel)
- Surface Elevated: `#252b38` (Raised cards)

**Action**: Update admin page to use design system colors for consistency.

**Accent Colors** (maintain existing):
- Primary: `blue-600` → Use design system `--primary: #58a6ff`
- Success: `green-600` → Use design system `--success: #3fb950`
- Warning: `yellow-500` → Use design system `--warning: #d29922`
- Error: `red-600` → Use design system `--error: #f85149`

---

## Future Considerations

### When Real Users Join (Post-Prototype)
- User management section in admin
- Filter battles/robots by user ID
- User activity tracking
- Ban/suspend user capabilities

### Planned Features Integration
- **Tournaments**: Add tournament monitoring to cycle controls
- **2v2 Battles**: Extend battle logs to show team battles
- **Auto-User Growth**: Track automated user addition per cycle (1 user per cycle, e.g., cycle 5 = 5 users)

### Advanced Analytics (Future Phases)
- Battle outcome prediction models
- Attribute correlation analysis (which attributes drive wins)
- League progression visualizations
- Economic health dashboards

### Mobile/Tablet Support
- Currently desktop-only
- Future: Responsive design for on-the-go monitoring
- Read-only mobile view focused on monitoring

---

## Success Criteria

### Must Have (Phase 1)
- ✅ Tabbed interface implemented and functional
- ✅ System Statistics visible by default
- ✅ Enhanced session log tracks all operations
- ✅ Robot names are clickable links
- ✅ Bulk cycle bug fixed

### Should Have (Phase 2)
- ✅ Real-time battle stream working
- ✅ Expanded statistics (battle, financial, facility)
- ✅ Visual enhancements in battle table
- ✅ Navbar updates after cycles

### Nice to Have (Phase 3)
- ✅ Design system color alignment
- ✅ Comprehensive documentation
- ✅ Performance optimizations

---

## Open Questions & Answers

**Q: Should we preserve both individual buttons and bulk cycle runner?**  
A: Yes, place them side by side. Both serve valid purposes.

**Q: How to handle errors during full cycle execution?**  
A: Not critical during prototype phase. Most issues result in hung processes requiring restart.

**Q: Should session log be shared across browser tabs?**  
A: No need - only one developer uses admin page at a time.

**Q: Need role-based admin permissions?**  
A: No - only developer access during prototype phase.

**Q: Should we add "Undo" functionality for cycles?**  
A: Too complex for prototype phase. Defer to production.

---

## Appendix A: Future Admin Page Structure (With Tabs)

```
/admin Page Layout (Revised)

├── Navigation Bar (global)
├── Admin Header
│   ├── Page Title: "Admin Portal"
│   ├── Current User Balance (updates after cycles)
│   └── [Refresh All] button (global refresh)
├── Tab Navigation
│   ├── [Dashboard] (default)
│   ├── [Cycle Controls]
│   ├── [Battle Logs]
│   └── [Robot Stats]
└── Tab Content Area
    │
    ├─ Dashboard Tab
    │  ├── System Statistics (always visible)
    │  │   ├── Robot Statistics
    │  │   ├── Match Statistics
    │  │   ├── Battle Statistics (with draw %, kills)
    │  │   ├── Financial Statistics (bankruptcy warnings)
    │  │   └── Facility Statistics (purchase counts)
    │  └── Recent Activity Log (last 10 actions)
    │
    ├─ Cycle Controls Tab
    │  ├── Quick Actions (side by side)
    │  │   └── Individual buttons: Repair, Matchmaking, Battles, Rebalance, Finances
    │  ├── Bulk Cycle Runner
    │  │   ├── Cycle count input
    │  │   ├── Option checkboxes
    │  │   ├── [Run Bulk Cycles] button
    │  │   └── Real-time battle stream (when running)
    │  └── Full Session Log
    │      ├── Complete operation history
    │      └── [Clear Log] [Export Log] buttons
    │
    ├─ Battle Logs Tab
    │  ├── Search & Filter controls
    │  ├── Battle table (with clickable robot names)
    │  ├── Pagination
    │  └── Battle Details Modal (on row click)
    │
    └─ Robot Stats Tab
       ├── Attribute selector dropdown
       ├── Summary statistics
       ├── Outlier detection
       ├── Win-rate analysis
       └── Top/bottom performers (with robot links)
```

---

## Appendix B: Admin Battles vs. Normal Battles

**Admin Battle Endpoints**:
- `GET /api/admin/battles` - Paginated battle list for debugging
- `GET /api/admin/battles/:id` - Full battle details with numeric data

**Normal Battle Endpoint**:
- `GET /api/battles/:id` - Battle report with narrative text

**Key Differences**:
- **Data Source**: Same battles in database
- **Presentation**: Admin shows raw numbers, normal shows narrative
- **Purpose**: Admin for debugging, normal for player experience
- **Access**: Admin requires authentication + admin role

**Documentation Location**: Add to `/docs/admin_page/ADMIN_BATTLE_DEBUGGING.md`

---

## Appendix C: Color System Migration

### Current Admin Page Colors
```css
/* Tailwind defaults - needs update */
background: gray-900    /* #111827 */
cards: gray-800         /* #1F2937 */
borders: gray-700       /* #374151 */
```

### Target Design System Colors
```css
/* From /docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md */
background: #0a0e14     /* Deep space black */
surface: #1a1f29        /* Dark panel */
elevated: #252b38       /* Raised cards */
primary: #58a6ff        /* Cyan-blue */
success: #3fb950        /* Green */
warning: #d29922        /* Amber */
error: #f85149          /* Red */
```

### Migration Steps
1. Update Tailwind config with custom colors
2. Replace `gray-900` → custom `background`
3. Replace `gray-800` → custom `surface`
4. Replace `gray-700` → custom `elevated`
5. Update accent colors to design system values
6. Test color contrast ratios (WCAG AA)

---

**End of Document**
