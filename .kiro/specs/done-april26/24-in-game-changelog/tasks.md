# Implementation Plan: In-Game Changelog / "What's New"

## Overview

Implement a player-facing changelog system for Armoured Souls. Backend: new Prisma model, Express routes, service layer, image handling, auto-generator script. Frontend: modal on dashboard, dedicated page, admin tab, API client. Follows existing patterns throughout — Express 5 routes with Zod validation, Prisma 7 models, React 19 components with Tailwind CSS 4.

## Tasks

- [x] 1. Database schema and error definitions
  - [x] 1.1 Add ChangelogEntry model to Prisma schema and lastSeenChangelog to User model
    - Add `ChangelogEntry` model to `app/backend/prisma/schema.prisma` with all fields from design: id, title, body, category, status, imageUrl, publishDate, sourceType, sourceRef, createdBy, createdAt, updatedAt
    - Add indexes: `[status, publishDate]` and `[sourceRef]`
    - Add `lastSeenChangelog DateTime @default(now()) @map("last_seen_changelog")` to the existing `User` model
    - Run `npx prisma migrate dev` to generate the migration
    - Run `npx prisma generate` to regenerate the Prisma client
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 2.1, 2.2_
  - [x] 1.2 Create ChangelogError class and error codes
    - Create `app/backend/src/errors/changelogErrors.ts` following the `RobotError`/`RobotErrorCode` pattern in `src/errors/robotErrors.ts`
    - Define error codes: `CHANGELOG_NOT_FOUND`, `CHANGELOG_VALIDATION_ERROR`, `CHANGELOG_IMAGE_ERROR`
    - _Requirements: 1.1_

- [x] 2. Backend changelog service
  - [x] 2.1 Implement ChangelogService with CRUD and player-facing queries
    - Create `app/backend/src/services/changelog/changelogService.ts`
    - Implement `listPublished(page, perPage, category?)` — returns only `status: 'published'` entries ordered by `publishDate` desc, with pagination (default 20, max 100)
    - Implement `getUnread(userId, limit?)` — returns published entries with `publishDate` after the user's `lastSeenChangelog`, max 10
    - Implement `getUnreadCount(userId)` — returns count of unread entries
    - Implement `dismiss(userId)` — updates `lastSeenChangelog` to `new Date()`
    - Implement `listAll(page, perPage)` — returns all entries (drafts + published) for admin, ordered by createdAt desc
    - Implement `create(data)` — creates a new entry, sets `publishDate` if status is "published"
    - Implement `update(id, data)` — partial update, throws `CHANGELOG_NOT_FOUND` if missing
    - Implement `delete(id)` — deletes entry, calls image cleanup if imageUrl exists, throws `CHANGELOG_NOT_FOUND` if missing
    - Implement `publish(id)` — sets status to "published" and publishDate to now, throws `CHANGELOG_NOT_FOUND` if missing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.3, 2.4, 2.5, 6.5, 7.5_

  - [x] 2.2 Implement ChangelogImageService
    - Create `app/backend/src/services/changelog/changelogImageService.ts`
    - Adapt the existing `imageProcessingService` and `fileStorageService` patterns
    - Implement `processAndStore(buffer)` — resize to max 800px width (maintain aspect ratio) via sharp, convert to WebP, store in `uploads/changelog/{uuid}.webp`, return the relative URL path
    - Implement `deleteImage(imageUrl)` — resolve path and delete file from disk (non-fatal on failure, log errors)
    - Create `uploads/changelog/` directory if it doesn't exist on first store
    - _Requirements: 6.10, 7.2, 7.3, 7.4, 7.5_
  - [x] 2.3 Write unit tests for ChangelogService
    - Create `app/backend/src/services/changelog/__tests__/changelogService.test.ts`
    - Test `listPublished` returns only published entries in publishDate desc order
    - Test `getUnread` returns only entries after lastSeenChangelog
    - Test `getUnreadCount` returns correct count
    - Test `dismiss` updates lastSeenChangelog
    - Test `create` with valid data, test `update` with partial data, test `delete` with image cleanup
    - Test `publish` sets status and publishDate
    - Test `CHANGELOG_NOT_FOUND` thrown for missing entries on update/delete/publish
    - Mock Prisma client following existing test patterns
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.3, 2.4, 2.5, 6.5, 7.5_
  - [x] 2.4 Write property test: Entry data round-trip (Property 1)
    - Create `app/backend/src/services/changelog/__tests__/changelogService.property.test.ts`
    - **Property 1: Entry data round-trip** — For any valid changelog entry data, creating via the service and reading back returns matching fields
    - Use fast-check to generate arbitrary valid titles (1-200 chars), bodies (1-5000 chars), categories, statuses
    - **Validates: Requirements 1.1**
  - [x] 2.5 Write property test: Player-facing query returns only published entries in publishDate desc order (Property 2)
    - In `app/backend/src/services/changelog/__tests__/changelogService.property.test.ts`
    - **Property 2: Player-facing query returns only published entries in publishDate descending order**
    - Generate mixed sets of draft/published entries, verify listPublished returns only published, sorted by publishDate desc
    - **Validates: Requirements 1.4, 1.5**
  - [x] 2.6 Write property test: Pagination returns correct slices (Property 3)
    - In `app/backend/src/services/changelog/__tests__/changelogService.property.test.ts`
    - **Property 3: Pagination returns correct slices** — For any valid page/perPage, returned entries are the correct slice of the full sorted set
    - **Validates: Requirements 1.6**
  - [x] 2.7 Write property test: Unread detection by timestamp (Property 4)
    - In `app/backend/src/services/changelog/__tests__/changelogService.property.test.ts`
    - **Property 4: Unread detection by timestamp** — For any set of published entries and any lastSeenChangelog, unread entries are exactly those with publishDate after lastSeenChangelog
    - **Validates: Requirements 2.2, 2.3, 2.5**

- [x] 3. Backend API routes and validation
  - [x] 3.1 Create changelog routes with Zod validation and auth middleware
    - Create `app/backend/src/routes/changelog.ts`
    - Define Zod schemas inline (following `robots.ts` pattern): `createEntrySchema`, `updateEntrySchema`, `listQuerySchema`, `entryIdParamsSchema`
    - Implement 10 endpoints per design table:
      - `GET /api/changelog` — player, `authenticateToken`, `validateRequest({ query: listQuerySchema })`, calls `listPublished`
      - `GET /api/changelog/unread` — player, `authenticateToken`, calls `getUnread`
      - `GET /api/changelog/unread/count` — player, `authenticateToken`, calls `getUnreadCount`
      - `POST /api/changelog/dismiss` — player, `authenticateToken`, calls `dismiss`
      - `GET /api/changelog/admin` — admin, `authenticateToken`, `requireAdmin`, calls `listAll`
      - `POST /api/changelog/admin` — admin, `authenticateToken`, `requireAdmin`, `validateRequest({ body: createEntrySchema })`, calls `create`
      - `PUT /api/changelog/admin/:id` — admin, `authenticateToken`, `requireAdmin`, `validateRequest({ params: entryIdParamsSchema, body: updateEntrySchema })`, calls `update`
      - `DELETE /api/changelog/admin/:id` — admin, `authenticateToken`, `requireAdmin`, `validateRequest({ params: entryIdParamsSchema })`, calls `delete`
      - `POST /api/changelog/admin/:id/publish` — admin, `authenticateToken`, `requireAdmin`, `validateRequest({ params: entryIdParamsSchema })`, calls `publish`
      - `POST /api/changelog/admin/upload-image` — admin, `authenticateToken`, `requireAdmin`, multer (2MB limit), calls `changelogImageService.processAndStore`
    - _Requirements: 1.6, 2.3, 2.4, 2.5, 5.2, 5.3, 5.5, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.1, 10.2, 10.3, 10.4, 10.5_
  - [x] 3.2 Mount changelog routes in backend index.ts
    - Import `changelogRoutes` in `app/backend/src/index.ts`
    - Mount at `app.use('/api/changelog', changelogRoutes)` alongside existing route mounts
    - _Requirements: 5.2, 9.6, 9.7_
  - [x] 3.3 Write unit tests for changelog routes (authorization and validation)
    - Create `app/backend/src/routes/__tests__/changelog.test.ts`
    - Test all 5 admin endpoints return 403 for non-admin users
    - Test all 3 player endpoints return 401 without auth token
    - Test validation: empty title → 400, title > 200 chars → 400, empty body → 400, body > 5000 chars → 400, invalid category → 400, non-positive-integer ID → 400
    - Test publish action sets status and publishDate
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.1, 10.2, 10.3, 10.4, 10.5_
  - [x] 3.4 Write property test: API input validation rejects invalid data (Property 13)
    - Create `app/backend/src/routes/__tests__/changelog.property.test.ts`
    - **Property 13: API input validation rejects invalid data with field-level errors** — For any invalid input (empty title, title > 200, empty body, body > 5000, invalid category, invalid ID), endpoint returns 400 with field-level error details
    - Use fast-check to generate invalid inputs across all validation boundaries
    - **Validates: Requirements 1.2, 1.3, 1.7, 10.1, 10.2, 10.3, 10.4, 10.5**

- [x] 4. Checkpoint — Backend core complete
  - Ensure all backend tests pass (`npm run test:unit` in `app/backend`), ask the user if questions arise.

- [x] 5. Image service tests
  - [x] 5.1 Write unit tests for ChangelogImageService
    - Create `app/backend/src/services/changelog/__tests__/changelogImageService.test.ts`
    - Test `processAndStore` produces WebP output, stores in correct path, returns URL matching `/uploads/changelog/{uuid}.webp`
    - Test `deleteImage` removes file from disk
    - Test image cleanup on entry deletion (integration with ChangelogService.delete)
    - _Requirements: 6.10, 7.2, 7.3, 7.4, 7.5_
  - [x] 5.2 Write property test: Image processing produces valid WebP with correct dimensions (Property 7)
    - Create `app/backend/src/services/changelog/__tests__/changelogImageService.property.test.ts`
    - **Property 7: Image processing produces valid WebP with correct dimensions** — For any valid image buffer, output is WebP with width ≤ 800px and matching aspect ratio
    - **Validates: Requirements 6.10, 7.3**
  - [x] 5.3 Write property test: Image storage path matches expected pattern (Property 8)
    - In `app/backend/src/services/changelog/__tests__/changelogImageService.property.test.ts`
    - **Property 8: Image storage path matches expected pattern** — For any stored image, returned path matches `/uploads/changelog/{uuid}.webp`
    - **Validates: Requirements 7.4**
  - [x] 5.4 Write property test: Image cleanup on entry deletion (Property 9)
    - In `app/backend/src/services/changelog/__tests__/changelogImageService.property.test.ts`
    - **Property 9: Image cleanup on entry deletion** — For any entry with an imageUrl pointing to a file on disk, deleting the entry also deletes the image file
    - **Validates: Requirements 7.5**

- [x] 6. Frontend API client and changelog page
  - [x] 6.1 Create changelog API client
    - Create `app/frontend/src/utils/changelogApi.ts` following the `guideApi.ts` pattern
    - Define TypeScript interfaces: `ChangelogEntry`, `PaginatedChangelogResult`
    - Implement player functions: `fetchPublishedEntries(page, perPage, category?)`, `fetchUnreadEntries()`, `fetchUnreadCount()`, `dismissChangelog()`
    - Implement admin functions: `fetchAllEntries(page, perPage)`, `createEntry(data)`, `updateEntry(id, data)`, `deleteEntry(id)`, `publishEntry(id)`, `uploadChangelogImage(file)`
    - _Requirements: 3.1, 5.2, 6.3, 6.4, 6.5, 6.6, 7.1_
  - [x] 6.2 Create ChangelogPage component
    - Create `app/frontend/src/pages/ChangelogPage.tsx`
    - Use `Navigation` component, follow `GuidePage` layout pattern
    - Display all published entries in reverse chronological order with pagination
    - Category filter buttons: All, Balance, Feature, Bugfix, Economy — wrap on narrow viewports
    - Each entry as a card: title, body, color-coded category badge, publish date, optional image
    - Images scale proportionally with max-height to prevent oversized display
    - Responsive: stacked cards on mobile, no horizontal scrolling
    - Use Tailwind responsive breakpoints (sm:, md:, lg:) consistent with existing pages
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [x] 6.3 Register /changelog route in App.tsx and navigation
    - Add `/changelog` route in `app/frontend/src/App.tsx` with `ProtectedRoute` wrapper, importing `ChangelogPage`
    - Add `'/changelog'` to `implementedPages` set in `app/frontend/src/components/nav/types.ts`
    - Add `{ path: '/changelog', label: '📰 What\'s New' }` to the `social` category in `allPages` in `app/frontend/src/components/nav/types.ts`
    - _Requirements: 5.1, 5.6_

- [x] 7. Frontend changelog modal
  - [x] 7.1 Create ChangelogModal component
    - Create `app/frontend/src/components/ChangelogModal.tsx`
    - Fetch unread entries on mount via `fetchUnreadEntries()`
    - Do not render if unread count is 0
    - Render as overlay: centered max-width on desktop (md+), full-screen on mobile (<768px)
    - Each entry as a card: title, body text, color-coded category badge, publish date, optional inline image
    - Scrollable content area when entries exceed viewport height
    - Dismiss button (min 44×44px touch target) calls `dismissChangelog()`, closes modal
    - "View all updates" link (min 44×44px touch target) navigates to `/changelog`
    - Max 10 entries displayed; show overflow message when count exceeds 10
    - Silently fail if fetch errors (modal doesn't appear, dashboard still loads)
    - Use Tailwind responsive breakpoints consistent with existing components
    - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.5, 4.6_
  - [x] 7.2 Integrate ChangelogModal into DashboardPage
    - Import and render `ChangelogModal` in `app/frontend/src/pages/DashboardPage.tsx`
    - Modal appears on dashboard load when unread entries exist
    - _Requirements: 3.1, 3.7_
  - [x] 7.3 Write frontend tests for ChangelogModal
    - Create `app/frontend/src/components/__tests__/ChangelogModal.test.tsx`
    - Test modal appears when unread entries > 0
    - Test modal does not appear when unread entries = 0
    - Test dismiss button calls dismissChangelog and closes modal
    - Test max 10 entries displayed with overflow message when count > 10
    - Test "View all updates" link points to `/changelog`
    - _Requirements: 3.1, 3.4, 3.7, 3.8_
  - [x] 7.4 Write property test: Entry card renders all required fields (Property 5)
    - Create `app/frontend/src/components/__tests__/ChangelogModal.property.test.tsx`
    - **Property 5: Entry card renders all required fields** — For any entry with title, body, category, publishDate, the rendered card contains all fields. When imageUrl is present, an image element is rendered.
    - Use fast-check + Vitest + React Testing Library
    - **Validates: Requirements 3.2, 5.4**
  - [x] 7.5 Write property test: Category filter returns only matching entries (Property 6)
    - Create `app/frontend/src/pages/__tests__/ChangelogPage.property.test.tsx`
    - **Property 6: Category filter returns only matching entries** — For any set of entries and any selected category, displayed entries all match the filter. "All" shows all entries.
    - Use fast-check + Vitest + React Testing Library
    - **Validates: Requirements 5.5**

- [x] 8. Checkpoint — Frontend core complete
  - Ensure all frontend tests pass (`npx vitest --run` in `app/frontend`), ask the user if questions arise.

- [x] 9. Admin changelog tab
  - [x] 9.1 Create AdminChangelogTab component
    - Create `app/frontend/src/components/admin/AdminChangelogTab.tsx`
    - List all entries grouped by status: drafts at top, published below, each group ordered by createdAt/publishDate desc
    - Create/edit form: title (max 200), body (max 5000), category dropdown, image upload (JPEG/PNG/WebP, max 2MB), status
    - Publish action on drafts — sets status to published and publishDate
    - Delete with confirmation prompt (reuse existing `ConfirmationModal` pattern)
    - Validate form fields client-side: non-empty title (max 200), non-empty body (max 5000), valid category
    - Visual distinction: draft entries have muted styling + "DRAFT" badge, published entries show normally
    - Display sourceType and sourceRef for auto-generated entries
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 7.1, 7.2_
  - [x] 9.2 Register AdminChangelogTab in AdminPage
    - Add `'changelog'` to `TabType` union, `VALID_TABS` array, and `TAB_LABELS` record in `app/frontend/src/pages/AdminPage.tsx`
    - Add tab label: `'📋 Changelog'`
    - Import `AdminChangelogTab` and render it in the tab panel section
    - _Requirements: 6.1_
  - [x] 9.3 Write tests for AdminChangelogTab
    - Create `app/frontend/src/components/admin/__tests__/AdminChangelogTab.test.tsx`
    - Test tab appears in AdminPage
    - Test create form fields exist and validate
    - Test draft/published visual distinction
    - Test publish action
    - Test delete with confirmation
    - Test sourceType/sourceRef display for auto-generated entries
    - _Requirements: 6.1, 6.3, 6.7, 6.8, 6.9_

- [x] 10. Auto-generator script and deploy integration
  - [x] 10.1 Create auto-generator script
    - Create `app/backend/scripts/generate-changelog-drafts.ts`
    - Scan git commits since last deploy tag for commit messages
    - Scan `.kiro/specs/done-*` directories for specs completed since last deploy tag (based on git history)
    - Create one draft entry per completed spec: title from spec name, body from spec requirements introduction, sourceType "spec", sourceRef = spec directory name
    - Create one aggregated draft entry for non-spec commits: title with deploy date, body with grouped commit messages, sourceType "commit", sourceRef = commit SHA range
    - Category heuristics: spec name contains "fix"/"bug" → bugfix, contains "balance" → balance, otherwise → feature. Commit-based entries default to bugfix.
    - Check sourceRef before creating to ensure idempotency (no duplicates)
    - Skip generation if no new specs or commits found
    - Call admin changelog API endpoint with deploy service token
    - Retry network errors once with 5-second delay
    - Exit with non-zero code on git operation failures
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_
  - [x] 10.2 Add post-deploy step to GitHub Actions workflow
    - Add a `generate-changelog-drafts` step in `.github/workflows/deploy.yml` after the health check in both ACC and PRD deploy jobs
    - Step runs `npx ts-node app/backend/scripts/generate-changelog-drafts.ts` with the deploy service token
    - Step is non-blocking (uses `|| true` or `continue-on-error: true`) since the deploy already succeeded
    - _Requirements: 8.1_
  - [x] 10.3 Write unit tests for auto-generator
    - Create `app/backend/scripts/__tests__/generate-changelog-drafts.test.ts`
    - Test spec scanning creates correct draft entries with proper sourceType/sourceRef
    - Test commit aggregation creates single entry with deploy date title
    - Test category heuristics: "fix" → bugfix, "balance" → balance, default → feature
    - Test idempotency: running twice with same inputs creates no duplicates
    - Test skip behavior when no new specs or commits found
    - Mock git operations and API calls
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.10_
  - [x] 10.4 Write property test: Auto-generator creates correct drafts from specs (Property 10)
    - Create `app/backend/scripts/__tests__/generate-changelog-drafts.property.test.ts`
    - **Property 10: Auto-generator creates correct drafts from specs** — For any set of completed spec directories, creates exactly one draft per spec with sourceType "spec" and sourceRef = spec directory name
    - **Validates: Requirements 8.4, 8.7**
  - [x] 10.5 Write property test: Auto-generator category heuristics (Property 11)
    - In `app/backend/scripts/__tests__/generate-changelog-drafts.property.test.ts`
    - **Property 11: Auto-generator category heuristics** — For any spec name, assigns "bugfix" when name contains "fix"/"bug", "balance" when contains "balance", "feature" otherwise. Commit entries default to "bugfix".
    - **Validates: Requirements 8.6**
  - [x] 10.6 Write property test: Auto-generator idempotency (Property 12)
    - In `app/backend/scripts/__tests__/generate-changelog-drafts.property.test.ts`
    - **Property 12: Auto-generator idempotency** — Running twice with same inputs produces same number of entries as running once (no duplicates, verified by sourceRef uniqueness)
    - **Validates: Requirements 8.10**

- [x] 11. Documentation updates and final verification
  - [x] 11.1 Update project-overview steering file
    - Add "Changelog System" to the Key Systems list in `.kiro/steering/project-overview.md` with a one-line description
    - _Requirements: 5.1_
  - [x] 11.2 Update navigation types with /changelog
    - Verify `/changelog` is in `implementedPages` and `allPages` in `app/frontend/src/components/nav/types.ts` (done in task 6.3, this task confirms it persisted)
    - _Requirements: 5.1, 5.6_
  - [x] 11.3 Run verification criteria from requirements
    - Run all 13 verification checks defined in the requirements document:
      1. `grep -c "model ChangelogEntry" app/backend/prisma/schema.prisma` → expected 1
      2. `grep -E "status|imageUrl" app/backend/prisma/schema.prisma | grep -i changelog | wc -l` → expected ≥ 2
      3. `grep -c "lastSeenChangelog" app/backend/prisma/schema.prisma` → expected ≥ 1
      4. `grep -r "changelog" app/backend/src/routes/ --include="*.ts" -l | wc -l` → expected ≥ 1
      5. `grep -E "requireAdmin" app/backend/src/routes/changelog.ts | wc -l` → expected ≥ 3
      6. `ls app/backend/src/services/changelog/` → expected exists
      7. `ls app/frontend/src/components/ChangelogModal.tsx` → expected exists
      8. `ls app/frontend/src/pages/ChangelogPage.tsx` → expected exists
      9. `ls app/frontend/src/components/admin/AdminChangelogTab.tsx` → expected exists
      10. `ls app/backend/scripts/generate-changelog-drafts.ts` → expected exists
      11. `grep -c "generate-changelog" .github/workflows/deploy.yml` → expected ≥ 1
      12. `find app/backend/src -path "*changelog*test*" -o -path "*changelog*spec*" | wc -l` → expected ≥ 1
      13. `grep -E "md:|lg:|sm:|mobile" app/frontend/src/components/ChangelogModal.tsx app/frontend/src/pages/ChangelogPage.tsx | wc -l` → expected ≥ 3
    - _Requirements: 1.1, 2.1, 5.1, 6.1, 7.4, 8.1, 9.1, 9.2, 9.3, 4.6_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Run `npm run test:unit` in `app/backend` and `npx vitest --run` in `app/frontend`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Every task references specific requirement acceptance criteria for traceability
- Property tests validate the 13 correctness properties defined in the design document
- Checkpoints at tasks 4, 8, and 12 ensure incremental validation
- The auto-generator script (task 10) is the last major feature since it depends on the admin API being complete
- All tasks are mandatory per project spec quality standards
