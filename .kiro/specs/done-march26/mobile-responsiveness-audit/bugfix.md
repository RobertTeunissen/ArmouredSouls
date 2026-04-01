# Bugfix Requirements Document

## Introduction

Multiple pages across the Armoured Souls frontend are not properly optimized for mobile viewports (below 768px width). Users report poor usability on mobile devices, particularly on older pages. The issues span across all 27 page components and include: tables that overflow on narrow screens without horizontal scroll or mobile-adapted layouts, fixed-width elements causing horizontal page overflow, touch targets smaller than the 44x44px WCAG minimum, grid layouts that don't collapse to single columns, inconsistent breakpoint usage between hooks (`useIsMobile` at 768px) and the Navigation component (Tailwind `lg:` at 1024px), and hardcoded color values instead of Tailwind design tokens. This audit covers the systematic identification and resolution of these issues across the entire frontend.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN viewport width is below 768px THEN the `useIsMobile` hook (in `useIsMobile.ts`) reports mobile at 768px while the Navigation component switches layout at `lg:1024px`, creating a 768px–1024px dead zone where neither mobile nor desktop layout is fully applied

1.2 WHEN viewport width is below 768px on LeagueStandingsPage THEN the standings table (with columns: Rank, Robot, Owner, ELO, LP, Fame, W-D-L, Win Rate) renders at full width without a mobile-adapted layout, causing horizontal overflow or unreadable compressed columns

1.3 WHEN viewport width is below 768px on AdminPage THEN the tab navigation bar (7 tabs: Dashboard, Cycle Controls, Tournaments, Battle Logs, Robot Stats, System Health, Recent Users) renders as a single horizontal row that overflows without scrolling or wrapping, and the dashboard statistics grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7`) crams content at small sizes

1.4 WHEN viewport width is below 768px on AdminPage battle logs tab THEN the battle table (columns: ID, Robot 1, Robot 2, Winner, League, Duration, Date, Action) renders at full desktop width, and the search/filter controls render in a horizontal row that overflows

1.5 WHEN viewport width is below 768px on BattleHistoryPage THEN the filter/sort controls bar (outcome filter, sort control, search input, results per page, clear filters) renders as `flex flex-wrap` but individual controls have no responsive sizing, causing awkward wrapping and small touch targets

1.6 WHEN viewport width is below 768px on FinancialReportPage THEN the header uses `flex justify-between items-center` which causes the title and back button to collide on narrow screens, and the Financial Health section uses a side-by-side layout (`flex justify-between`) that doesn't stack vertically

1.7 WHEN viewport width is below 768px on HallOfRecordsPage THEN the record cards and sections render without mobile-specific layout adjustments, with potential overflow from grid layouts

1.8 WHEN viewport width is below 768px on DashboardPage THEN the header row (`flex items-center justify-between`) causes the "Command Center" title and stable name to collide on narrow screens

1.9 WHEN viewport width is below 768px on TournamentDetailPage THEN the bracket visualization (BracketView component) renders at full width without horizontal scrolling or mobile adaptation, making tournament brackets unreadable

1.10 WHEN viewport width is below 768px on pages using tables (AdminPage at-risk users, AdminPage battle logs, LeagueStandingsPage) THEN table rows have padding and text sized for desktop (`p-3`, `p-4`, `text-sm`) with no mobile density adjustments, and touch targets for action buttons are below the 44x44px WCAG minimum

1.11 WHEN viewport width is below 768px on multiple pages THEN hardcoded color values (e.g., `bg-gray-900`, `text-gray-400`, `bg-gray-800`) are used instead of the Tailwind design tokens defined in `tailwind.config.js` (e.g., `bg-background`, `text-secondary`, `bg-surface`), creating visual inconsistency with pages that do use the design system

1.12 WHEN viewport width is between 768px and 1024px THEN pages using the `useIsMobile` hook render in "desktop" mode (hook returns false) while the Navigation component renders in mobile mode (below `lg:` breakpoint), creating a layout mismatch where content assumes desktop width but navigation takes mobile form

1.13 WHEN viewport width is below 768px on WeaponShopPage THEN weapon cards and shop layout elements don't properly adapt to single-column mobile layout

1.14 WHEN viewport width is below 768px on ProfilePage, CreateRobotPage, or OnboardingPage THEN form inputs and buttons may not be properly sized for touch interaction (minimum 44x44px touch targets)

### Expected Behavior (Correct)

2.1 WHEN viewport width is below 1024px THEN the `useIsMobile` hook and Navigation component SHALL use a consistent breakpoint (aligned to Tailwind's `lg:1024px`) so that mobile layout is applied uniformly across all components

2.2 WHEN viewport width is below 768px on LeagueStandingsPage THEN the standings table SHALL either wrap in a horizontally scrollable container with visual scroll affordance, or transform into a mobile-friendly card-based layout showing key stats (Rank, Robot, ELO, W-D-L) per card

2.3 WHEN viewport width is below 768px on AdminPage THEN the tab navigation SHALL be horizontally scrollable with scroll affordance, and the dashboard statistics grid SHALL reflow to a readable layout (e.g., `grid-cols-2` on small screens) with adequate spacing

2.4 WHEN viewport width is below 768px on AdminPage battle logs tab THEN the battle table SHALL be wrapped in a horizontally scrollable container, and the search/filter controls SHALL stack vertically with full-width inputs and minimum 44px height touch targets

2.5 WHEN viewport width is below 768px on BattleHistoryPage THEN the filter/sort controls SHALL stack vertically or wrap into a compact mobile layout with each control being full-width and having minimum 44px height for touch targets

2.6 WHEN viewport width is below 768px on FinancialReportPage THEN the header SHALL stack the title above the back button, and the Financial Health section SHALL stack the health status above the balance display vertically

2.7 WHEN viewport width is below 768px on HallOfRecordsPage THEN record sections SHALL use a single-column layout with cards that fit the viewport width without horizontal overflow

2.8 WHEN viewport width is below 768px on DashboardPage THEN the header SHALL stack the title above the stable name vertically, and all grid sections SHALL collapse to single-column layout

2.9 WHEN viewport width is below 768px on TournamentDetailPage THEN the bracket visualization SHALL be wrapped in a horizontally scrollable container with visual scroll affordance, or provide a simplified mobile-friendly bracket view

2.10 WHEN viewport width is below 768px on pages using tables THEN all interactive elements (buttons, links, select dropdowns) SHALL have a minimum touch target size of 44x44px, and table cells SHALL use compact padding appropriate for mobile

2.11 WHEN any page is rendered at any viewport width THEN the page SHALL use Tailwind design tokens from `tailwind.config.js` (e.g., `bg-background`, `text-secondary`, `bg-surface`, `bg-surface-elevated`) instead of hardcoded gray color values, ensuring visual consistency across the application

2.12 WHEN viewport width is between 768px and 1024px THEN the layout SHALL be consistent — both the Navigation and page content SHALL agree on whether to show mobile or desktop layout, eliminating the dead zone

2.13 WHEN viewport width is below 768px on WeaponShopPage THEN weapon cards SHALL reflow to a single-column layout that fits the viewport width with adequate spacing and touch-friendly interaction areas

2.14 WHEN viewport width is below 768px on pages with forms (ProfilePage, CreateRobotPage, OnboardingPage) THEN all form inputs SHALL have a minimum height of 44px, and submit/action buttons SHALL have minimum 44x44px touch targets

### Unchanged Behavior (Regression Prevention)

3.1 WHEN viewport width is 1024px or above THEN the Navigation component SHALL CONTINUE TO display the desktop top navigation bar with dropdown menus, logo, currency display, and logout button exactly as it does today

3.2 WHEN viewport width is 1024px or above THEN all page layouts SHALL CONTINUE TO render with their current desktop grid layouts, table formats, and spacing without any visual changes

3.3 WHEN viewport width is below 1024px THEN the Navigation component SHALL CONTINUE TO display the mobile bottom tab bar (Dashboard, Robots, Battles, Shop, More) and hamburger drawer menu with all current menu sections and items

3.4 WHEN any page is loaded THEN all existing functionality (data fetching, filtering, sorting, pagination, navigation, form submission) SHALL CONTINUE TO work identically regardless of viewport width

3.5 WHEN the user interacts with tables on desktop viewports THEN table sorting, row highlighting, pagination controls, and action buttons SHALL CONTINUE TO function as they do today

3.6 WHEN the user accesses the AdminPage on desktop THEN all admin controls (cycle controls, bulk operations, battle logs, robot stats, session log) SHALL CONTINUE TO function and display identically

3.7 WHEN Tailwind design tokens are applied to replace hardcoded colors THEN the visual appearance SHALL CONTINUE TO match the intended dark theme aesthetic — the token values (`background: #0a0e14`, `surface: #1a1f29`, `surface-elevated: #252b38`) are close equivalents to the hardcoded grays currently used
