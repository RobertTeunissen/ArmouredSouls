# Requirements Document

## Introduction

Armoured Souls currently has no in-game communication channel for game updates. Players only discover balance changes, new features, and bug fixes if they happen to notice differences or hear about them in Discord. This is a problem because changes directly affect player strategy — a weapon damage adjustment, an economy tweak, or a facility discount fix can invalidate a player's current build without them knowing.

The In-Game Changelog ("What's New") feature provides a system for surfacing meaningful game updates to players when they log in. Entries are visually attractive cards with optional images, category badges, and rich text — designed to feel like a polished game update feed, not a developer commit log. The system works seamlessly on both desktop and mobile.

Changelog entries are auto-generated from completed specs and deploy commits via a GitHub Actions post-deploy step, then land in the admin panel as drafts. Admins review, edit, optionally add images, and publish when ready. This means every deploy produces draft content automatically, but nothing goes live without explicit admin approval.

The system stores changelog entries in the database with a status workflow (draft → published) so they can be managed through the admin panel without requiring a code deploy. Entries are categorized (balance, feature, bugfix, economy) and ordered by publish date. Dismissal tracking uses a per-user "last seen" timestamp.

This is backlog item #17, ranked #5 in the WSJF priority list with 4 player votes. The feature generates value on every release.

## Glossary

- **Changelog_Service**: The backend service responsible for creating, updating, deleting, and querying changelog entries
- **Changelog_Entry**: A single update record stored in the database with title, body, category, optional image URL, status, and publish date
- **Changelog_Modal**: The frontend modal component that displays unread changelog entries to players on dashboard load
- **Changelog_Page**: A dedicated page listing all published changelog entries with filtering, accessible from the navigation
- **Admin_Changelog_Tab**: The admin panel tab for managing changelog entries (review drafts, edit, publish, delete)
- **Category**: A classification tag for changelog entries — one of: balance, feature, bugfix, economy
- **Status**: The publication state of a changelog entry — one of: draft, published
- **Draft**: An auto-generated or manually created entry that is not yet visible to players, pending admin review
- **Last_Seen_Changelog**: A timestamp stored on the User record tracking when the player last dismissed the changelog modal
- **Unread_Entries**: Published changelog entries with a publishDate after the player's Last_Seen_Changelog timestamp
- **Admin_Panel**: The existing admin interface at `/admin` with tabbed navigation
- **Auto_Generator**: A GitHub Actions post-deploy step that creates draft changelog entries from git commit messages and completed spec titles
- **Changelog_Image**: An optional image attached to a changelog entry, stored in `uploads/changelog/` using the existing file storage pattern

## Expected Contribution

This feature closes the communication gap between developers and players, ensuring game changes are surfaced where players actually see them — inside the game.

1. **Player awareness of changes**: Before: Players have zero in-game visibility into balance changes, bug fixes, or new features. After: Every logged-in player sees unread updates in a visually attractive modal on dashboard load, with a dedicated changelog page for browsing history.

2. **Automated draft generation**: Before: No changelog content exists. After: Every deploy automatically generates draft changelog entries from commit messages and completed specs. Admins review and publish — no manual writing from scratch required.

3. **Admin review and approval workflow**: Before: N/A. After: Auto-generated drafts land in the admin panel for review. Admins can edit titles, bodies, categories, add images, and publish when ready. Nothing goes live without explicit approval.

4. **Visual richness with images**: Before: N/A. After: Changelog entries support optional images (screenshots, feature previews, balance change diagrams) that display inline in both the modal and changelog page.

5. **Mobile-responsive design**: Before: N/A. After: The changelog modal and page are fully responsive — touch-friendly tap targets, stacked card layout on mobile, images scale to viewport, no horizontal scrolling.

6. **Categorized updates**: Before: N/A. After: All entries are tagged with one of 4 categories (balance, feature, bugfix, economy) with color-coded badges, enabling players to quickly identify which updates affect their strategy.

7. **Accessible history**: Before: No changelog exists in-game. After: A dedicated `/changelog` page lets players browse all past entries with category filtering.

### Verification Criteria

After all tasks are complete, run these checks to confirm the feature works:

1. **ChangelogEntry model exists in Prisma schema with status field**:
   ```bash
   grep -c "model ChangelogEntry" app/backend/prisma/schema.prisma
   # Expected: 1
   ```

2. **ChangelogEntry has status and imageUrl fields**:
   ```bash
   grep -E "status|imageUrl" app/backend/prisma/schema.prisma | grep -i changelog | wc -l
   # Expected: >= 2
   ```

3. **User model has lastSeenChangelog field**:
   ```bash
   grep -c "lastSeenChangelog" app/backend/prisma/schema.prisma
   # Expected: >= 1
   ```

4. **Changelog API routes exist**:
   ```bash
   grep -r "changelog" app/backend/src/routes/ --include="*.ts" -l | wc -l
   # Expected: >= 1
   ```

5. **Admin CRUD endpoints are protected**:
   ```bash
   grep -E "requireAdmin" app/backend/src/routes/changelog.ts | wc -l
   # Expected: >= 3 (create, update, delete)
   ```

6. **Changelog service directory exists**:
   ```bash
   ls app/backend/src/services/changelog/ 2>/dev/null && echo "exists"
   # Expected: "exists"
   ```

7. **Frontend modal component exists**:
   ```bash
   ls app/frontend/src/components/ChangelogModal.tsx 2>/dev/null && echo "exists"
   # Expected: "exists"
   ```

8. **Frontend changelog page exists**:
   ```bash
   ls app/frontend/src/pages/ChangelogPage.tsx 2>/dev/null && echo "exists"
   # Expected: "exists"
   ```

9. **Admin changelog tab exists**:
   ```bash
   ls app/frontend/src/components/admin/AdminChangelogTab.tsx 2>/dev/null && echo "exists"
   # Expected: "exists"
   ```

10. **Auto-generator script exists**:
    ```bash
    ls app/backend/scripts/generate-changelog-drafts.ts 2>/dev/null && echo "exists"
    # Expected: "exists"
    ```

11. **Deploy workflow includes changelog generation step**:
    ```bash
    grep -c "generate-changelog" .github/workflows/deploy.yml
    # Expected: >= 1
    ```

12. **Tests exist for changelog service**:
    ```bash
    find app/backend/src -path "*changelog*test*" -o -path "*changelog*spec*" | wc -l
    # Expected: >= 1
    ```

13. **Mobile responsiveness in modal and page**:
    ```bash
    grep -E "md:|lg:|sm:|mobile" app/frontend/src/components/ChangelogModal.tsx app/frontend/src/pages/ChangelogPage.tsx | wc -l
    # Expected: >= 3 (responsive breakpoints used)
    ```

## Requirements

### Requirement 1: Changelog Entry Storage

**User Story:** As a developer, I want changelog entries stored in the database with structured metadata, status tracking, and optional images, so that entries can be auto-generated as drafts and published through admin review.

#### Acceptance Criteria

1. THE Changelog_Service SHALL store each Changelog_Entry with the following fields: id (auto-increment), title (string, max 200 characters), body (text, max 5000 characters), category (enum: balance, feature, bugfix, economy), status (enum: draft, published), imageUrl (nullable string, max 500 characters), publishDate (nullable datetime — set when published), sourceType (nullable string: "spec", "commit", "manual" — tracks how the entry was created), sourceRef (nullable string, max 200 — spec name or commit SHA for auto-generated entries), createdBy (nullable admin user ID — null for auto-generated), createdAt (datetime), updatedAt (datetime)
2. THE Changelog_Entry SHALL require a non-empty title and a non-empty body
3. THE Changelog_Entry SHALL require exactly one category from the allowed set: balance, feature, bugfix, economy
4. WHEN a Changelog_Entry has status "draft", THE Changelog_Service SHALL exclude the entry from all player-facing queries
5. WHEN a Changelog_Entry has status "published", THE Changelog_Service SHALL include the entry in player-facing queries ordered by publishDate descending
6. THE Changelog_Service SHALL support pagination with configurable page size (default 20, max 100)
7. THE Changelog_Entry imageUrl field SHALL accept paths in the format `/uploads/changelog/{filename}.webp` or null

### Requirement 2: Unread Entry Detection

**User Story:** As a player, I want the game to know which changelog entries I haven't seen yet, so that I only get notified about new updates.

#### Acceptance Criteria

1. THE User model SHALL include a lastSeenChangelog field (datetime, default now()) tracking when the player last dismissed the Changelog_Modal
2. WHEN a new user registers, THE registration service SHALL set lastSeenChangelog to the current timestamp so that new players start with a clean slate and see no modal on first login
3. WHEN a player has a lastSeenChangelog value, THE Changelog_Service SHALL return only published entries with a publishDate after the lastSeenChangelog timestamp as unread
4. WHEN a player dismisses the Changelog_Modal, THE Changelog_Service SHALL update the player's lastSeenChangelog to the current timestamp
5. THE Changelog_Service SHALL provide an endpoint that returns the count of unread entries for a player without returning the full entry data

### Requirement 3: Player Changelog Modal

**User Story:** As a player, I want to see a visually attractive, dismissable modal with new game updates when I open the dashboard, so that I stay informed about changes that affect my strategy.

#### Acceptance Criteria

1. WHEN a player navigates to the dashboard and has unread changelog entries, THE Changelog_Modal SHALL appear as an overlay displaying the unread entries
2. THE Changelog_Modal SHALL display each entry as a visually distinct card with: title, body text, color-coded category badge, publish date, and optional image
3. WHEN a Changelog_Entry has an imageUrl, THE Changelog_Modal SHALL display the image inline within the entry card, scaled to fit the card width
4. THE Changelog_Modal SHALL provide a dismiss button that closes the modal and updates the player's lastSeenChangelog timestamp
5. THE Changelog_Modal SHALL be scrollable when the content exceeds the viewport height
6. THE Changelog_Modal SHALL include a link to the full Changelog_Page for browsing older entries
7. IF there are no unread entries, THE Changelog_Modal SHALL not appear
8. THE Changelog_Modal SHALL display a maximum of 10 unread entries, with a message indicating more entries are available on the Changelog_Page when the count exceeds 10

### Requirement 4: Mobile-Responsive Design

**User Story:** As a player on mobile, I want the changelog modal and page to be fully usable on my phone, so that I can read game updates on any device.

#### Acceptance Criteria

1. THE Changelog_Modal SHALL use a full-screen overlay on viewports below 768px (md breakpoint) and a centered overlay with max-width on larger viewports
2. THE Changelog_Modal dismiss button and the "View all updates" link SHALL have a minimum touch target of 44×44px
3. THE Changelog_Page SHALL stack entry cards vertically on mobile with no horizontal scrolling
4. THE Changelog_Page category filter buttons SHALL wrap to multiple rows on narrow viewports rather than overflowing
5. Changelog_Entry images SHALL scale proportionally to fit the container width on all viewport sizes, with a max-height to prevent oversized images dominating the view
6. THE Changelog_Modal and Changelog_Page SHALL use the existing Tailwind responsive breakpoint patterns (sm:, md:, lg:) consistent with the rest of the application

### Requirement 5: Changelog Page

**User Story:** As a player, I want a dedicated page to browse all past changelog entries, so that I can catch up on changes I missed or review previous updates.

#### Acceptance Criteria

1. THE Changelog_Page SHALL be accessible at the `/changelog` route and from the main navigation
2. THE Changelog_Page SHALL display all published changelog entries in reverse chronological order with pagination
3. THE Changelog_Page SHALL provide category filter buttons (All, Balance, Feature, Bugfix, Economy) that filter the displayed entries
4. THE Changelog_Page SHALL display each entry as a card with: title, body, category badge, publish date, and optional image
5. WHEN a category filter is active, THE Changelog_Page SHALL only display entries matching the selected category
6. THE Changelog_Page SHALL use the existing Navigation component and follow the established page layout patterns

### Requirement 6: Admin Changelog Management

**User Story:** As an admin, I want to review auto-generated drafts, edit them, add images, and publish when ready, so that I control what players see while benefiting from automated content generation.

#### Acceptance Criteria

1. THE Admin_Changelog_Tab SHALL be accessible from the Admin_Panel tab navigation
2. THE Admin_Changelog_Tab SHALL display all changelog entries grouped by status: drafts at the top, published entries below, each group ordered by createdAt/publishDate descending
3. THE Admin_Changelog_Tab SHALL provide a form to create new entries with fields: title, body, category (dropdown), image upload (optional), status (draft or published)
4. THE Admin_Changelog_Tab SHALL provide editing for existing entries (title, body, category, image, status)
5. THE Admin_Changelog_Tab SHALL provide a "Publish" action on draft entries that sets status to "published" and publishDate to the current timestamp
6. THE Admin_Changelog_Tab SHALL provide a delete action with a confirmation prompt before deletion
7. WHEN an admin creates or edits an entry, THE Admin_Changelog_Tab SHALL validate that title is non-empty (max 200 characters), body is non-empty (max 5000 characters), and category is one of the allowed values
8. THE Admin_Changelog_Tab SHALL visually distinguish between draft entries and published entries (e.g., draft badge, muted styling)
9. THE Admin_Changelog_Tab SHALL display the source type (spec, commit, manual) and source reference for auto-generated entries so admins can trace the origin
10. THE Admin_Changelog_Tab image upload SHALL accept JPEG, PNG, and WebP files up to 2 MB, process them to WebP format, and store them in `uploads/changelog/`

### Requirement 7: Changelog Image Upload

**User Story:** As an admin, I want to attach images to changelog entries (screenshots, feature previews), so that updates are visually engaging for players.

#### Acceptance Criteria

1. THE Admin_Changelog_Tab SHALL provide an image upload field when creating or editing a changelog entry
2. THE image upload SHALL accept JPEG, PNG, and WebP files with a maximum size of 2 MB
3. THE image upload SHALL process the uploaded image to WebP format with a maximum width of 800px (maintaining aspect ratio) using sharp
4. THE processed image SHALL be stored in `uploads/changelog/{uuid}.webp` using the existing file storage pattern (non-guessable UUID filenames)
5. WHEN a changelog entry with an image is deleted, THE Changelog_Service SHALL delete the associated image file from disk
6. THE existing Caddy `handle /uploads/*` block already serves `uploads/changelog/` — no Caddy configuration changes are needed

### Requirement 8: Auto-Generation from Deploys

**User Story:** As a developer, I want changelog drafts automatically created from completed specs and deploy commits, so that I don't have to write entries from scratch for every release.

#### Acceptance Criteria

1. THE Auto_Generator SHALL run as a post-deploy step in the GitHub Actions deploy workflow (after successful deployment to acceptance or production)
2. THE Auto_Generator SHALL scan git commits since the last deploy tag for commit messages and extract a summary
3. THE Auto_Generator SHALL scan the `.kiro/specs/done-*` directories for specs completed since the last deploy tag (based on git history of the spec files)
4. THE Auto_Generator SHALL create one draft Changelog_Entry per completed spec, using the spec name as the title and a summary derived from the spec's requirements introduction as the body
5. THE Auto_Generator SHALL create one aggregated draft Changelog_Entry for non-spec commits (bug fixes, minor changes), grouping commit messages into a single entry titled with the deploy date
6. THE Auto_Generator SHALL assign a category to each draft based on heuristics: spec names containing "fix" or "bug" → bugfix, specs in balance-related directories → balance, otherwise → feature. Commit-based entries default to bugfix.
7. THE Auto_Generator SHALL set sourceType to "spec" or "commit" and sourceRef to the spec directory name or commit SHA range
8. THE Auto_Generator SHALL skip generation if no new specs or commits are found since the last deploy tag
9. THE Auto_Generator SHALL call the admin changelog API endpoint to create draft entries, authenticating with a deploy service token
10. THE Auto_Generator SHALL be idempotent — running it twice for the same deploy SHALL NOT create duplicate entries (check sourceRef before creating)

### Requirement 9: Changelog API Authorization

**User Story:** As a system administrator, I want changelog management endpoints restricted to admins while read endpoints are available to authenticated players, so that only authorized users can modify changelog content.

#### Acceptance Criteria

1. THE create changelog entry endpoint SHALL require admin role authentication
2. THE update changelog entry endpoint SHALL require admin role authentication
3. THE delete changelog entry endpoint SHALL require admin role authentication
4. THE publish changelog entry endpoint SHALL require admin role authentication
5. THE list all entries endpoint (including drafts) SHALL require admin role authentication
6. THE list published entries endpoint SHALL require standard player authentication
7. THE unread entries endpoint SHALL require standard player authentication
8. THE dismiss changelog endpoint SHALL require standard player authentication
9. IF a non-admin user attempts to access admin changelog endpoints, THEN THE Changelog_Service SHALL return a 403 error

### Requirement 10: Changelog API Input Validation

**User Story:** As a developer, I want all changelog API inputs validated with Zod schemas, so that invalid data is rejected at the API boundary.

#### Acceptance Criteria

1. THE create entry endpoint SHALL validate the request body with a Zod schema requiring: title (string, 1-200 chars), body (string, 1-5000 chars), category (enum: balance, feature, bugfix, economy), status (optional enum: draft, published, defaults to draft), imageUrl (optional string), sourceType (optional enum: spec, commit, manual), sourceRef (optional string, max 200)
2. THE update entry endpoint SHALL validate the request body with a Zod schema allowing partial updates: title (optional string, 1-200 chars), body (optional string, 1-5000 chars), category (optional enum), status (optional enum), imageUrl (optional nullable string)
3. THE update, delete, and publish endpoints SHALL validate the entry ID parameter as a positive integer using the existing positiveIntParam validator
4. THE list entries endpoint SHALL validate optional query parameters: page (positive integer), perPage (positive integer, max 100), category (optional enum)
5. IF validation fails, THEN THE endpoint SHALL return a 400 error with details about which fields failed validation
