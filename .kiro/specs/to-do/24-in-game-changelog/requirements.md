# Requirements Document

## Introduction

Armoured Souls currently has no in-game communication channel for game updates. Players only discover balance changes, new features, and bug fixes if they happen to notice differences or hear about them in Discord. This is a problem because changes directly affect player strategy — a weapon damage adjustment, an economy tweak, or a facility discount fix can invalidate a player's current build without them knowing.

The In-Game Changelog ("What's New") feature provides a system for surfacing meaningful game updates to players when they log in. Developers write short, player-facing changelog entries tagged with categories. On login, players see a dismissable modal with unread updates since their last visit. Each entry explains what changed and how it impacts gameplay — not developer-facing commit messages, but player-facing explanations like "Repair Bay discount now correctly applies to all robots in your stable."

The system stores changelog entries in the database (not markdown files in the repo) so they can be created, edited, and managed through the admin panel without requiring a deploy. Entries are categorized (balance, feature, bugfix, economy) and ordered by publish date. Dismissal tracking uses a per-user "last seen" timestamp — simple, efficient, and sufficient for the use case since entries are chronologically ordered.

This is backlog item #17, ranked #5 in the WSJF priority list with 4 player votes. The feature generates value on every release and is estimated at ~1 week of work.

## Glossary

- **Changelog_Service**: The backend service responsible for creating, updating, deleting, and querying changelog entries
- **Changelog_Entry**: A single update record stored in the database with title, body, category, and publish date
- **Changelog_Modal**: The frontend modal component that displays unread changelog entries to players on login
- **Changelog_Page**: A dedicated page listing all changelog entries with filtering, accessible from the navigation
- **Admin_Changelog_Tab**: The admin panel tab for managing changelog entries (create, edit, delete, preview)
- **Category**: A classification tag for changelog entries — one of: balance, feature, bugfix, economy
- **Last_Seen_Changelog**: A timestamp stored on the User record tracking when the player last dismissed the changelog modal
- **Unread_Entries**: Changelog entries with a publishDate after the player's Last_Seen_Changelog timestamp
- **Admin_Panel**: The existing admin interface at `/admin` with tabbed navigation

## Expected Contribution

This feature closes the communication gap between developers and players, ensuring game changes are surfaced where players actually see them — inside the game.

1. **Player awareness of changes**: Before: Players have zero in-game visibility into balance changes, bug fixes, or new features — they only learn about changes through Discord or by noticing differences. After: Every logged-in player sees unread updates in a modal on login, with a dedicated changelog page for browsing history.

2. **Admin content management**: Before: No admin tooling exists for communicating with players. After: Admins can create, edit, delete, and preview changelog entries from the admin panel without requiring a code deploy.

3. **Categorized updates**: Before: N/A. After: All entries are tagged with one of 4 categories (balance, feature, bugfix, economy), enabling players to quickly identify which updates affect their strategy.

4. **Dismissal tracking**: Before: N/A. After: Per-user "last seen" timestamp ensures players only see new entries, and the modal does not reappear until new content is published.

5. **Accessible history**: Before: No changelog exists in-game. After: A dedicated `/changelog` page lets players browse all past entries with category filtering, so they can catch up on changes they missed.

6. **Database-driven content**: Before: N/A. After: Changelog entries live in a database table, decoupled from deploys. Entries can be created, scheduled, and edited without touching the codebase.

### Verification Criteria

After all tasks are complete, run these checks to confirm the feature works:

1. **ChangelogEntry model exists in Prisma schema**:
   ```bash
   grep -c "model ChangelogEntry" app/backend/prisma/schema.prisma
   # Expected: 1
   ```

2. **User model has lastSeenChangelog field**:
   ```bash
   grep -c "lastSeenChangelog" app/backend/prisma/schema.prisma
   # Expected: >= 1
   ```

3. **Changelog API routes exist**:
   ```bash
   grep -r "changelog" app/backend/src/routes/ --include="*.ts" -l | wc -l
   # Expected: >= 1 (route file exists)
   ```

4. **Admin CRUD endpoints are protected**:
   ```bash
   grep -E "requireAdmin.*changelog|changelog.*requireAdmin" app/backend/src/routes/ -r | wc -l
   # Expected: >= 1
   ```

5. **Changelog service exists**:
   ```bash
   ls app/backend/src/services/changelog/ 2>/dev/null && echo "exists"
   # Expected: "exists"
   ```

6. **Frontend modal component exists**:
   ```bash
   ls app/frontend/src/components/ChangelogModal.tsx 2>/dev/null && echo "exists"
   # Expected: "exists"
   ```

7. **Frontend changelog page exists**:
   ```bash
   ls app/frontend/src/pages/ChangelogPage.tsx 2>/dev/null && echo "exists"
   # Expected: "exists"
   ```

8. **Admin changelog tab exists**:
   ```bash
   ls app/frontend/src/components/admin/AdminChangelogTab.tsx 2>/dev/null && echo "exists"
   # Expected: "exists"
   ```

9. **Category filtering is supported**:
   ```bash
   grep -r "category" app/backend/src/services/changelog/ --include="*.ts" | wc -l
   # Expected: >= 1
   ```

10. **Tests exist for changelog service**:
    ```bash
    find app/backend/src -path "*changelog*test*" -o -path "*changelog*spec*" | wc -l
    # Expected: >= 1
    ```

## Requirements

### Requirement 1: Changelog Entry Storage

**User Story:** As a developer, I want changelog entries stored in the database with structured metadata, so that entries can be managed without code deploys and queried efficiently.

#### Acceptance Criteria

1. THE Changelog_Service SHALL store each Changelog_Entry with the following fields: id (auto-increment), title (string, max 200 characters), body (text, max 5000 characters), category (enum: balance, feature, bugfix, economy), publishDate (datetime), createdBy (admin user ID), createdAt (datetime), updatedAt (datetime)
2. THE Changelog_Entry SHALL require a non-empty title and a non-empty body
3. THE Changelog_Entry SHALL require exactly one category from the allowed set: balance, feature, bugfix, economy
4. WHEN a Changelog_Entry has a publishDate in the future, THE Changelog_Service SHALL exclude the entry from player-facing queries until the publishDate has passed
5. THE Changelog_Service SHALL return entries ordered by publishDate descending (newest first)
6. THE Changelog_Service SHALL support pagination with configurable page size (default 20, max 100)

### Requirement 2: Unread Entry Detection

**User Story:** As a player, I want the game to know which changelog entries I haven't seen yet, so that I only get notified about new updates.

#### Acceptance Criteria

1. THE User model SHALL include a lastSeenChangelog field (nullable datetime, default null) tracking when the player last dismissed the Changelog_Modal
2. WHEN a player has a null lastSeenChangelog value, THE Changelog_Service SHALL treat all published entries as unread
3. WHEN a player has a lastSeenChangelog value, THE Changelog_Service SHALL return only entries with a publishDate after the lastSeenChangelog timestamp as unread
4. WHEN a player dismisses the Changelog_Modal, THE Changelog_Service SHALL update the player's lastSeenChangelog to the current timestamp
5. THE Changelog_Service SHALL provide an endpoint that returns the count of unread entries for a player without returning the full entry data

### Requirement 3: Player Changelog Modal

**User Story:** As a player, I want to see a dismissable modal with new game updates when I log in, so that I stay informed about changes that affect my strategy.

#### Acceptance Criteria

1. WHEN a player navigates to the dashboard and has unread changelog entries, THE Changelog_Modal SHALL appear as an overlay displaying the unread entries
2. THE Changelog_Modal SHALL display each entry's title, body, category badge, and publish date
3. THE Changelog_Modal SHALL group entries by category with visual distinction (color-coded category badges)
4. THE Changelog_Modal SHALL provide a dismiss button that closes the modal and updates the player's lastSeenChangelog timestamp
5. THE Changelog_Modal SHALL be scrollable when the content exceeds the viewport height
6. THE Changelog_Modal SHALL include a link to the full Changelog_Page for browsing older entries
7. IF there are no unread entries, THE Changelog_Modal SHALL not appear
8. THE Changelog_Modal SHALL display a maximum of 20 unread entries, with a message indicating more entries are available on the Changelog_Page when the count exceeds 20

### Requirement 4: Changelog Page

**User Story:** As a player, I want a dedicated page to browse all past changelog entries, so that I can catch up on changes I missed or review previous updates.

#### Acceptance Criteria

1. THE Changelog_Page SHALL be accessible at the `/changelog` route and from the main navigation
2. THE Changelog_Page SHALL display all published changelog entries in reverse chronological order with pagination
3. THE Changelog_Page SHALL provide category filter buttons (All, Balance, Feature, Bugfix, Economy) that filter the displayed entries
4. THE Changelog_Page SHALL display each entry's title, body, category badge, and publish date
5. WHEN a category filter is active, THE Changelog_Page SHALL only display entries matching the selected category
6. THE Changelog_Page SHALL use the existing Navigation component and follow the established page layout patterns

### Requirement 5: Admin Changelog Management

**User Story:** As an admin, I want to create, edit, and delete changelog entries from the admin panel, so that I can communicate game updates to players without deploying code.

#### Acceptance Criteria

1. THE Admin_Changelog_Tab SHALL be accessible from the Admin_Panel tab navigation
2. THE Admin_Changelog_Tab SHALL display a list of all changelog entries (published and scheduled) ordered by publishDate descending
3. THE Admin_Changelog_Tab SHALL provide a form to create new entries with fields: title, body, category (dropdown), publishDate (datetime picker, defaults to now)
4. THE Admin_Changelog_Tab SHALL provide inline editing for existing entries (title, body, category, publishDate)
5. THE Admin_Changelog_Tab SHALL provide a delete action with a confirmation prompt before deletion
6. WHEN an admin creates or edits an entry, THE Admin_Changelog_Tab SHALL validate that title is non-empty (max 200 characters), body is non-empty (max 5000 characters), and category is one of the allowed values
7. THE Admin_Changelog_Tab SHALL visually distinguish between published entries (publishDate in the past) and scheduled entries (publishDate in the future)
8. THE Admin_Changelog_Tab SHALL display the entry creator's username and the last updated timestamp for each entry

### Requirement 6: Changelog API Authorization

**User Story:** As a system administrator, I want changelog management endpoints restricted to admins while read endpoints are available to authenticated players, so that only authorized users can modify changelog content.

#### Acceptance Criteria

1. THE create changelog entry endpoint SHALL require admin role authentication
2. THE update changelog entry endpoint SHALL require admin role authentication
3. THE delete changelog entry endpoint SHALL require admin role authentication
4. THE list all entries endpoint (including scheduled) SHALL require admin role authentication
5. THE list published entries endpoint SHALL require standard player authentication
6. THE unread entries endpoint SHALL require standard player authentication
7. THE dismiss changelog endpoint SHALL require standard player authentication
8. IF a non-admin user attempts to access admin changelog endpoints, THEN THE Changelog_Service SHALL return a 403 error

### Requirement 7: Changelog API Input Validation

**User Story:** As a developer, I want all changelog API inputs validated with Zod schemas, so that invalid data is rejected at the API boundary.

#### Acceptance Criteria

1. THE create entry endpoint SHALL validate the request body with a Zod schema requiring: title (string, 1-200 chars), body (string, 1-5000 chars), category (enum: balance, feature, bugfix, economy), publishDate (optional ISO datetime string, defaults to current time)
2. THE update entry endpoint SHALL validate the request body with a Zod schema allowing partial updates: title (optional string, 1-200 chars), body (optional string, 1-5000 chars), category (optional enum), publishDate (optional ISO datetime string)
3. THE update and delete endpoints SHALL validate the entry ID parameter as a positive integer using the existing positiveIntParam validator
4. THE list entries endpoint SHALL validate optional query parameters: page (positive integer), perPage (positive integer, max 100), category (optional enum)
5. IF validation fails, THEN THE endpoint SHALL return a 400 error with details about which fields failed validation
