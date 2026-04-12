# Implementation Plan: Robot Image Upload with Content Moderation

## Overview

Implement a two-step image upload flow (preview → confirm) for custom robot images with NSFW content moderation (hard block), robot-likeness heuristic (soft warning with override), 512×512 WebP processing via sharp, UUID-based local filesystem storage, orphan cleanup integrated into the daily settlement cycle, admin visibility endpoints, and a mobile-responsive frontend upload tab in the existing RobotImageSelector modal. All backend services live under `src/services/moderation/`. No Prisma migration needed — Robot already has `imageUrl`.

## Tasks

- [x] 1. Install dependencies and create moderation service directory
  - Run `npm install nsfwjs @tensorflow/tfjs-node multer sharp` and `npm install -D @types/multer` in `app/backend/`
  - Create directory `app/backend/src/services/moderation/`
  - Create `app/backend/src/services/moderation/index.ts` barrel export (empty initially, populated as services are built)
  - Create `app/backend/uploads/user-robots/.gitkeep` to establish the upload directory in version control
  - Add `uploads/user-robots/` to `app/backend/.gitignore` (keep `.gitkeep`, ignore uploaded files)
  - _Requirements: 6.1, 6.5_

- [x] 2. Implement File Validation Service
  - [x] 2.1 Create `app/backend/src/services/moderation/fileValidationService.ts`
    - Implement `validateImage(buffer: Buffer, mimeType: string): Promise<FileValidationResult>` as specified in design Component 2
    - Magic byte detection for JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`RIFF....WEBP`) — use magic bytes as authoritative type, ignore declared MIME
    - Use `sharp(buffer).metadata()` to read pixel dimensions
    - Reject if dimensions outside 64×64 to 4096×4096 range with error code `INVALID_IMAGE`
    - Reject if magic bytes don't match any supported format with error code `INVALID_IMAGE_FORMAT`
    - Export singleton instance
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Write unit tests for File Validation Service
    - Create `app/backend/src/services/moderation/__tests__/fileValidationService.test.ts`
    - Test magic byte detection for JPEG, PNG, WebP with real small test buffers
    - Test rejection of non-image files (e.g., text file, renamed executable)
    - Test dimension validation: reject below 64×64, reject above 4096×4096, accept within range
    - Test that declared MIME type mismatch uses magic-byte-detected format
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.3 Write property test for magic byte authority (Property 3)
    - **Property 3: Magic byte authority** — For any uploaded file buffer, the File_Validation_Service SHALL determine the file type from magic bytes, not from the declared MIME type
    - Generate arbitrary MIME type strings paired with known-valid image buffers; assert detected type always matches magic bytes regardless of declared MIME
    - **Validates: Requirements 2.1, 2.3**

  - [x] 2.4 Write property test for invalid file rejection (Property 4)
    - **Property 4: Invalid file rejection** — For any byte buffer whose magic bytes do not match JPEG, PNG, or WebP, the service SHALL reject it. For any valid image outside [64, 4096] dimension range, the service SHALL reject it
    - Generate random byte arrays that don't start with known magic byte sequences; assert all are rejected
    - **Validates: Requirements 2.2, 2.4**

- [x] 3. Implement Content Moderation Service
  - [x] 3.1 Create `app/backend/src/services/moderation/contentModerationService.ts`
    - Implement singleton `ContentModerationService` as specified in design Component 3
    - `initialize()`: load nsfwjs model at startup using TensorFlow.js CPU backend
    - `classifyImage(buffer)`: decode image, run nsfwjs classification, dispose tensors, return `ModerationResult`
    - `isReady()`: return whether model is loaded
    - NSFW thresholds: porn ≥ 0.3, hentai ≥ 0.3, sexy ≥ 0.5 → `safe: false`
    - Robot-likeness: `drawing + neutral < 0.6` → `robotLikely: false`, `robotLikenessScore` = drawing + neutral
    - If model unavailable: return `{ safe: false, reason: 'moderation_unavailable' }` (fail-closed)
    - Dispose all TensorFlow tensors after classification to prevent memory leaks
    - Export singleton instance
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 4.1, 4.2, 4.7_

  - [x] 3.2 Write unit tests for Content Moderation Service
    - Create `app/backend/src/services/moderation/__tests__/contentModerationService.test.ts`
    - Mock nsfwjs model to return controlled score arrays
    - Test NSFW threshold logic: porn at 0.3 → unsafe, porn at 0.29 → safe (boundary)
    - Test hentai threshold: 0.3 → unsafe, 0.29 → safe
    - Test sexy threshold: 0.5 → unsafe, 0.49 → safe
    - Test robot-likeness: drawing + neutral < 0.6 → `robotLikely: false`; ≥ 0.6 → `robotLikely: true`
    - Test model unavailable returns `safe: false` with reason `moderation_unavailable`
    - Test tensor disposal is called after classification
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 4.1, 4.2_

  - [x] 3.3 Write property test for NSFW threshold consistency (Property 5)
    - **Property 5: NSFW threshold consistency** — For any set of five NSFW category scores, the service SHALL mark the image as safe if and only if porn < 0.3 AND hentai < 0.3 AND sexy < 0.5
    - Generate arbitrary score objects with five categories summing to ~1.0; assert `safe` matches the threshold formula exactly
    - **Validates: Requirements 3.1, 3.2**

  - [x] 3.4 Write property test for robot-likeness soft warning with override (Property 7)
    - **Property 7: Robot-likeness is a soft warning with override** — For any NSFW-safe scores, `robotLikely` is true iff `drawing + neutral >= 0.6`
    - Generate score sets where all NSFW thresholds pass; vary drawing + neutral around 0.6 boundary; assert `robotLikely` matches the threshold
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 4. Implement Image Processing Service
  - [x] 4.1 Create `app/backend/src/services/moderation/imageProcessingService.ts`
    - Implement `processImage(buffer: Buffer): Promise<Buffer>` as specified in design Component 4
    - Use `sharp(buffer).resize(512, 512, { fit: 'cover', position: 'centre' }).webp({ quality: 80 }).toBuffer()`
    - All images pass through pipeline regardless of input format or dimensions
    - Export singleton instance
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 4.2 Write unit tests for Image Processing Service
    - Create `app/backend/src/services/moderation/__tests__/imageProcessingService.test.ts`
    - Test output is 512×512 WebP for JPEG input
    - Test output is 512×512 WebP for PNG input
    - Test output is 512×512 WebP for WebP input
    - Test non-square input is center-cropped (verify output dimensions)
    - Test already-512×512 WebP input still produces valid output
    - Verify output buffer starts with WebP magic bytes (`RIFF....WEBP`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 4.3 Write property test for image processing output invariant (Property 8)
    - **Property 8: Image processing output invariant** — For any valid image buffer, the service SHALL produce a 512×512 WebP buffer whose magic bytes match the WebP signature
    - Generate test images of varying dimensions and formats using sharp; assert output is always 512×512 WebP
    - **Validates: Requirements 5.1, 5.2**

- [x] 5. Checkpoint — Ensure all service unit and property tests pass
  - Run `cd app/backend && npx jest --testPathPattern="services/moderation" --no-coverage` and ensure all tests pass
  - Ask the user if questions arise

- [x] 6. Implement File Storage Service and Pending Upload Cache
  - [x] 6.1 Create `app/backend/src/services/moderation/fileStorageService.ts`
    - Implement `FileStorageService` as specified in design Component 5
    - `storeImage(userId, buffer)`: write to `uploads/user-robots/{userId}/{uuid}.webp`, create directory if needed, return relative URL path
    - `deleteImage(relativePath)`: delete file from disk, log errors but don't throw
    - `getAbsolutePath(relativePath)`: resolve relative URL to absolute filesystem path
    - `cleanupOrphans(referencedUrls)`: scan `uploads/user-robots/`, delete files not in referenced set, return `{ filesDeleted, bytesReclaimed, errors }`
    - Use `crypto.randomUUID()` for non-guessable filenames
    - Export singleton instance
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 6.2 Create `app/backend/src/services/moderation/pendingUploadCache.ts`
    - Implement `PendingUploadCache` as specified in design Component 1c
    - In-memory `Map<string, PendingUploadEntry>` keyed by confirmation token (UUID)
    - `store(token, entry)`: add entry with `createdAt` timestamp, enforce max 3 pending per user
    - `retrieve(token)`: return entry if exists and not expired (5-minute TTL), else return `null`
    - `delete(token)`: remove entry from map
    - `cleanup()`: remove all expired entries, run via `setInterval` every 60 seconds
    - Export singleton instance
    - _Requirements: 1.7_

  - [x] 6.3 Write unit tests for File Storage Service
    - Create `app/backend/src/services/moderation/__tests__/fileStorageService.test.ts`
    - Test `storeImage` creates directory and writes file with UUID filename
    - Test returned path matches `/uploads/user-robots/{userId}/{uuid}.webp` pattern
    - Test `deleteImage` removes file from disk
    - Test `cleanupOrphans` deletes unreferenced files and keeps referenced ones
    - Test directory creation when user directory doesn't exist
    - Use temp directories for test isolation
    - _Requirements: 6.1, 6.3, 6.4, 6.6_

  - [x] 6.4 Write unit tests for Pending Upload Cache
    - Create `app/backend/src/services/moderation/__tests__/pendingUploadCache.test.ts`
    - Test store and retrieve within TTL returns entry
    - Test retrieve after TTL expiry returns null
    - Test delete removes entry
    - Test per-user limit (max 3 pending) — oldest evicted when limit exceeded
    - Test cleanup removes expired entries
    - _Requirements: 1.6, 1.7_

  - [x] 6.5 Write property test for valid URL path format (Property 9)
    - **Property 9: Valid URL path format with non-guessable filenames** — For any stored image, the returned path SHALL match `/uploads/user-robots/{userId}/{uuid}.webp` and SHALL NOT contain `assets/robots/`. Two calls with identical content SHALL produce different filenames.
    - Generate arbitrary userId values and buffer contents; assert path format and UUID uniqueness
    - **Validates: Requirements 6.1, 6.4, 6.5, 6.6**

  - [x] 6.6 Write property test for pending upload cache TTL eviction (Property 12)
    - **Property 12: Pending upload cache TTL eviction** — For any entry, if confirmation arrives after 5-minute TTL, cache SHALL return null. Within TTL, cache SHALL return the stored buffer.
    - Use time mocking to test entries at various ages relative to TTL boundary
    - **Validates: Requirements 1.6, 1.7**

  - [x] 6.7 Write property test for orphan cleanup correctness (Property 15)
    - **Property 15: Periodic orphan cleanup correctness** — For any set of files on disk and Robot.imageUrl values, the cleanup SHALL delete exactly those files not referenced by any robot. Referenced files SHALL NOT be deleted.
    - Generate sets of file paths and referenced URL sets; assert only unreferenced files are deleted
    - **Validates: Requirements 12.1, 12.2**

- [x] 7. Implement Upload Preview and Confirm Route Handlers
  - [x] 7.1 Create upload rate limiter in `app/backend/src/services/moderation/uploadRateLimiter.ts`
    - Per-user rate limit: 5 uploads per 10-minute window using `express-rate-limit`
    - `keyGenerator` based on `req.user.userId` (runs after `authenticateToken`)
    - Return HTTP 429 with `{ error: 'Too many uploads', code: 'RATE_LIMIT_EXCEEDED', retryAfter }` on violation
    - Track violations via `securityMonitor.trackRateLimitViolation()`
    - Export the rate limiter middleware
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 7.2 Create `app/backend/src/services/moderation/imageUploadHandlers.ts`
    - Implement `handleImagePreview(req, res)` as specified in design Component 1 and the Preview Upload Algorithm
    - Middleware chain: `authenticateToken` → `uploadRateLimiter` → `multer.single('image')` → `validateRequest` → handler
    - Ownership check: verify `robot.userId === req.user.userId`, return 403 `ROBOT_NOT_OWNED` if not
    - No file: return 400
    - File too large: Multer rejects with 400 `FILE_TOO_LARGE`
    - Delegate to `fileValidationService.validateImage()` → 400 on failure
    - Delegate to `contentModerationService.classifyImage()` → 422 `IMAGE_MODERATION_FAILED` on NSFW (hard block), dual-log to AuditLog + SecurityMonitor (severity: medium)
    - If `robotLikely: false` and no `?acknowledgeRobotLikeness=true`: return 422 `LOW_ROBOT_LIKENESS`, log warning to AuditLog + SecurityMonitor (severity: low, event type `image_robot_likeness_warning`)
    - If `robotLikely: false` and `?acknowledgeRobotLikeness=true`: skip robot-likeness, log override to AuditLog + SecurityMonitor (severity: low, event type `image_robot_likeness_override`), still enforce NSFW
    - If moderation unavailable: return 503 `MODERATION_UNAVAILABLE`
    - Process image via `imageProcessingService.processImage()`
    - Store in `pendingUploadCache` with UUID confirmation token
    - Return 200 `{ preview: "data:image/webp;base64,...", confirmationToken }`
    - No disk writes in this handler
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 2.5, 3.3, 3.4, 4.3, 4.4, 4.5, 4.6, 7.1, 7.2, 7.4, 7.5_

  - [x] 7.3 Implement `handleImageConfirm(req, res)` in the same file
    - As specified in design Component 1b and the Confirm Upload Algorithm
    - Middleware chain: `authenticateToken` → `validateRequest` → handler
    - Ownership check: verify robot belongs to user
    - Retrieve from `pendingUploadCache` → 410 `PREVIEW_EXPIRED` if null
    - Verify pending entry's userId and robotId match request
    - Store via `fileStorageService.storeImage()`
    - Delete old custom image if `robot.imageUrl` starts with `/uploads/`
    - Update `robot.imageUrl` in database
    - Log `image_upload_success` to AuditLog with userId, robotId, imageUrl, fileSize
    - Remove cache entry
    - Return 200 `{ success: true, robot: updatedRobot }`
    - _Requirements: 1.5, 1.6, 6.2, 7.3_

  - [x] 7.4 Register routes in `app/backend/src/routes/robots.ts`
    - Add `POST /:id/image` with middleware chain: `authenticateToken`, `uploadRateLimiter`, `multer.single('image')`, `validateRequest({ params, query })`, `handleImagePreview`
    - Add `PUT /:id/image/confirm` with middleware chain: `authenticateToken`, `validateRequest({ params, body })`, `handleImageConfirm`
    - Define Zod schemas: `imageParamsSchema` (id: positiveIntParam), `imageQuerySchema` (acknowledgeRobotLikeness: optional enum 'true'), `confirmBodySchema` (confirmationToken: z.string().uuid())
    - _Requirements: 1.1, 1.5_

  - [x] 7.5 Write unit tests for preview and confirm handlers
    - Create `app/backend/src/services/moderation/__tests__/imageUploadHandlers.test.ts`
    - Mock all downstream services (fileValidationService, contentModerationService, imageProcessingService, pendingUploadCache, fileStorageService, eventLogger, securityMonitor, prisma)
    - Test happy path: valid file → 200 with preview + token
    - Test ownership denial: wrong user → 403 `ROBOT_NOT_OWNED`
    - Test no file: → 400
    - Test validation failure: → 400 `INVALID_IMAGE`
    - Test NSFW rejection: → 422 `IMAGE_MODERATION_FAILED`, verify dual audit log (AuditLog + SecurityMonitor)
    - Test robot-likeness warning without acknowledge: → 422 `LOW_ROBOT_LIKENESS`, verify warning logged
    - Test robot-likeness override with acknowledge: → 200, verify override logged, NSFW still enforced
    - Test moderation unavailable: → 503 `MODERATION_UNAVAILABLE`
    - Test confirm happy path: valid token → 200, file stored, robot updated, old image deleted, cache entry removed
    - Test confirm expired token: → 410 `PREVIEW_EXPIRED`
    - Test confirm ownership mismatch: → 403
    - Verify no disk writes occur during preview handler
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 3.3, 3.4, 4.3, 4.4, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 7.6 Write property test for ownership isolation (Property 1)
    - **Property 1: Ownership isolation** — For any user ID that does not match the robot's owner, uploading (preview or confirm) SHALL return 403 and produce no side effects
    - Generate random non-owner user IDs; assert 403 with no cache entries, no disk writes, no audit logs
    - **Validates: Requirements 1.3**

  - [x] 7.7 Write property test for preview produces no disk writes (Property 2)
    - **Property 2: Preview produces no disk writes** — For any preview request outcome (success, validation failure, moderation rejection), no image file SHALL be written to `uploads/`
    - Run preview handler with various inputs; assert uploads directory is unchanged after each call
    - **Validates: Requirements 1.1, 1.8**

  - [x] 7.8 Write property test for no score leakage (Property 6)
    - **Property 6: No score leakage** — For any NSFW rejection (422 `IMAGE_MODERATION_FAILED`) or robot-likeness warning (422 `LOW_ROBOT_LIKENESS`), the response body SHALL NOT contain any NSFW category scores or numeric robot-likeness score
    - Generate various rejection/warning scenarios; parse response JSON; assert no score fields present
    - **Validates: Requirements 3.3, 4.3**

  - [x] 7.9 Write property test for dual audit logging (Property 10)
    - **Property 10: Dual audit logging for NSFW rejections** — For any NSFW rejection, BOTH an AuditLog entry (event type `image_moderation_rejection`) AND a SecurityMonitor event (severity `medium`) SHALL be created with userId, robotId, and reason
    - Mock AuditLog and SecurityMonitor; trigger NSFW rejections; assert both are called with correct parameters
    - **Validates: Requirements 7.1, 7.4**

  - [x] 7.10 Write property test for robot-likeness override still enforces NSFW (Property 16)
    - **Property 16: Robot-likeness override still enforces NSFW** — For any upload with `?acknowledgeRobotLikeness=true` where NSFW fails, the handler SHALL still return 422 `IMAGE_MODERATION_FAILED`. The acknowledge flag SHALL only bypass robot-likeness, never NSFW.
    - Generate NSFW-failing score sets with acknowledgeRobotLikeness=true; assert 422 `IMAGE_MODERATION_FAILED`
    - **Validates: Requirements 4.4, 3.3**

- [x] 8. Checkpoint — Ensure all backend handler tests pass
  - Run `cd app/backend && npx jest --testPathPattern="services/moderation" --no-coverage` and ensure all tests pass
  - Ask the user if questions arise

- [x] 9. Implement Orphan Cleanup Job and Eager Cleanup Hooks
  - [x] 9.1 Create `app/backend/src/services/moderation/orphanCleanupJob.ts`
    - Implement `runOrphanCleanup()` as specified in design Component 7 and the Orphan Cleanup Algorithm
    - Query all `Robot.imageUrl` values starting with `/uploads/` from database
    - Recursively scan `uploads/user-robots/` for all `.webp` files
    - Cross-reference: delete files not in the referenced set
    - Return `{ filesDeleted, bytesReclaimed, errors }` — log errors for individual file failures without aborting
    - Log results via `logger.info()`
    - _Requirements: 12.1, 12.2, 12.3, 12.6_

  - [x] 9.2 Integrate orphan cleanup as Step 15 in `app/backend/src/services/admin/adminCycleService.ts`
    - Add Step 15 after the cycle snapshot step (Step 14) inside `executeBulkCycles()`
    - Import and call `runOrphanCleanup()` from `orphanCleanupJob.ts`
    - Log step completion via `eventLogger.logCycleStepComplete(currentCycleNumber, 'orphan_image_cleanup', 15, duration, { filesDeleted, bytesReclaimed })`
    - Follow the existing step pattern (step start time, try/catch, logger.info)
    - _Requirements: 12.5_

  - [x] 9.3 Add eager cleanup hooks for robot image changes
    - In the robot update route handler (or service): when `imageUrl` changes from a `/uploads/` path to a preset path or null, call `fileStorageService.deleteImage(oldImageUrl)`
    - In the robot deletion route handler (or service): when a robot with `imageUrl` starting with `/uploads/` is deleted, call `fileStorageService.deleteImage(robot.imageUrl)`
    - _Requirements: 6.7, 6.8_

  - [x] 9.4 Write unit tests for orphan cleanup and eager cleanup
    - Create `app/backend/src/services/moderation/__tests__/orphanCleanupJob.test.ts`
    - Test cleanup deletes unreferenced files and keeps referenced ones
    - Test cleanup handles individual file deletion errors gracefully
    - Test cleanup returns correct `filesDeleted` and `bytesReclaimed` counts
    - Test eager cleanup on preset switch: old custom file deleted
    - Test eager cleanup on robot deletion: custom file deleted
    - _Requirements: 12.1, 12.2, 12.3, 12.6, 6.7, 6.8_

  - [x] 9.5 Write property test for orphaned image cleanup on preset switch (Property 13)
    - **Property 13: Orphaned image cleanup on preset switch** — For any robot whose imageUrl changes from `/uploads/` to a preset path or null, the old file SHALL be deleted from disk
    - Generate old imageUrl paths starting with `/uploads/`; simulate switch to preset; assert old file no longer exists
    - **Validates: Requirement 6.7**

  - [x] 9.6 Write property test for orphaned image cleanup on robot deletion (Property 14)
    - **Property 14: Orphaned image cleanup on robot deletion** — For any robot with a custom uploaded image that is deleted, the file SHALL be deleted from disk
    - Generate robots with `/uploads/` imageUrls; simulate deletion; assert file no longer exists
    - **Validates: Requirement 6.8**

- [x] 10. Implement Admin Endpoints
  - [x] 10.1 Create admin uploads handler in `app/backend/src/services/moderation/adminUploadsHandler.ts`
    - Implement `handleAdminUploads(req, res)` as specified in design Component 8 and the Admin Uploads Query Algorithm
    - Query `AuditLog` where `eventType = 'image_upload_success'`
    - Support filtering by `userId`, `startDate`, `endDate` query parameters
    - Paginate with `page` (default 1) and `limit` (default 50, max 200)
    - Join with User and Robot tables to resolve `username` and `robotName`
    - Return `{ uploads, total, page, limit }`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 10.2 Create admin cleanup handler in the same file
    - Implement `handleAdminCleanup(req, res)` that calls `runOrphanCleanup()` and returns the result
    - _Requirements: 12.4_

  - [x] 10.3 Register admin routes
    - Add `GET /api/admin/uploads` with middleware: `authenticateToken`, `requireAdmin`, `validateRequest`, `handleAdminUploads`
    - Add `POST /api/admin/uploads/cleanup` with middleware: `authenticateToken`, `requireAdmin`, `handleAdminCleanup`
    - Define Zod schemas for admin uploads query params (page, limit, userId, startDate, endDate)
    - Return 403 for non-admin users (handled by `requireAdmin` middleware)
    - _Requirements: 12.4, 13.6_

  - [x] 10.4 Write unit tests for admin endpoints
    - Create `app/backend/src/services/moderation/__tests__/adminUploadsHandler.test.ts`
    - Test pagination: correct page/limit behavior, default limit 50, max limit 200
    - Test filtering by userId
    - Test filtering by date range (startDate, endDate)
    - Test response format matches spec (userId, username, robotId, robotName, imageUrl, fileSize, uploadDate)
    - Test admin-only access: non-admin user → 403
    - Test cleanup endpoint calls `runOrphanCleanup()` and returns result
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 12.4_

  - [x] 10.5 Write property test for admin uploads pagination consistency (Property 17)
    - **Property 17: Admin uploads pagination consistency** — For any set of `image_upload_success` AuditLog entries and valid pagination params, the handler SHALL return exactly `min(limit, remaining)` entries and `total` SHALL equal the total matching entries
    - Generate varying counts of audit log entries and pagination params; assert page sizes and totals are consistent
    - **Validates: Requirements 13.1, 13.5**

- [x] 11. Checkpoint — Ensure all backend tests pass
  - Run `cd app/backend && npx jest --testPathPattern="services/moderation" --no-coverage` and ensure all tests pass
  - Ask the user if questions arise

- [x] 12. Initialize Content Moderation Service at Application Startup
  - In `app/backend/src/index.ts` (or the main app initialization file), import `contentModerationService` and call `contentModerationService.initialize()` during startup
  - Log success/failure of model loading
  - Ensure the app still starts if model loading fails (fail-closed: uploads will be rejected, but other features work)
  - _Requirements: 3.4_

- [x] 13. Implement Frontend Upload Tab in RobotImageSelector
  - [x] 13.1 Extend `app/frontend/src/components/RobotImageSelector.tsx` with tab navigation
    - Add tab UI: "Preset Images" tab (existing grid) and "Upload Custom Image" tab
    - Use state to track active tab
    - Preserve all existing preset image selection functionality
    - _Requirements: 9.1_

  - [x] 13.2 Implement upload tab component within RobotImageSelector
    - Create the upload flow UI as specified in design Component 6
    - File input with `accept="image/jpeg,image/png,image/webp"` for camera roll access on mobile
    - Client-side validation: reject non-JPEG/PNG/WebP files and files > 2 MB before upload
    - Client-side 512×512 center-crop preview using canvas (`drawImage` with center-crop math) immediately after file selection
    - Show "Upload" button to submit and "Cancel" button to discard
    - _Requirements: 9.2, 9.3, 9.4_

  - [x] 13.3 Implement server preview and confirmation flow
    - On "Upload" click: send file to `POST /api/robots/:id/image` via FormData, show loading indicator, disable submit button
    - On success: display server-returned base64 preview for final confirmation with "Confirm" and "Cancel" buttons
    - On confirm: send `PUT /api/robots/:id/image/confirm` with confirmation token, update displayed robot image to new URL
    - On reject: discard preview, return to file selection state
    - _Requirements: 9.5, 9.6, 9.10, 9.11_

  - [x] 13.4 Implement error handling in upload flow
    - `IMAGE_MODERATION_FAILED` (422): show "This image was not approved. Please choose a different image." — no override option
    - `LOW_ROBOT_LIKENESS` (422): show warning "This doesn't look like a robot — are you sure?" with "Upload anyway" button
    - On "Upload anyway" click: re-send same file with `?acknowledgeRobotLikeness=true`
    - `PREVIEW_EXPIRED` (410): show "Preview expired, please re-upload the image"
    - `RATE_LIMIT_EXCEEDED` (429): show rate limit message
    - Generic errors: show user-friendly error message
    - _Requirements: 9.7, 9.8, 9.9, 9.12_

  - [x] 13.5 Implement mobile-responsive layout
    - Touch-friendly tap targets: minimum 44×44px for all interactive elements
    - Responsive modal layout that works on small screens without horizontal scrolling or clipped content
    - Preview image scales to fit viewport on mobile
    - File picker accesses device camera roll on iOS/Android via `accept="image/*"` attribute
    - _Requirements: 9.13, 9.14_

  - [x] 13.6 Write property test for frontend file validation mirrors backend (Property 11)
    - **Property 11: Frontend file validation mirrors backend constraints** — For any file selected in the upload UI, the frontend SHALL reject files not JPEG/PNG/WebP and files > 2 MB before sending to server
    - Create test files with various types and sizes; assert client-side validation rejects invalid files
    - Use Vitest + fast-check
    - **Validates: Requirement 9.2**

- [x] 14. Configure Caddy Static File Serving
  - Update `app/Caddyfile` to add static file serving for `/uploads/*`
    - `root * /path/to/app/backend`
    - `file_server`
    - `header Cache-Control "public, max-age=86400"`
    - `header X-Content-Type-Options "nosniff"`
  - _Requirements: 10.1, 10.2_

- [x] 15. Checkpoint — Ensure frontend builds and all tests pass
  - Run `cd app/frontend && npm run build` and ensure it succeeds
  - Run `cd app/backend && npx jest --testPathPattern="services/moderation" --no-coverage` and ensure all tests pass
  - Ask the user if questions arise

- [x] 16. Update Documentation
  - [x] 16.1 Update `docs/guides/SECURITY.md`
    - Add Security Playbook entry for "Image Upload Content Moderation"
    - Cover: fail-closed moderation pattern, NSFW hard block vs robot-likeness soft warning with `?acknowledgeRobotLikeness=true` override, two-step preview/confirm flow, client-side crop preview, magic byte validation, non-guessable UUID URLs, separate storage path, dual audit logging (including `image_robot_likeness_override` events), confirmation token security, PendingUploadCache memory limits, file upload rate limiting
    - _Requirements: 11.1_

  - [x] 16.2 Update `docs/guides/DEPLOYMENT.md`
    - Add instructions for creating `uploads/user-robots/` directory with correct permissions
    - Document Caddy static file serving configuration for `/uploads/*`
    - _Requirements: 11.2_

  - [x] 16.3 Update `docs/prd_core/ARCHITECTURE.md`
    - Add `moderation` service directory to Backend Service Architecture table (list all files: `contentModerationService.ts`, `fileValidationService.ts`, `fileStorageService.ts`, `imageProcessingService.ts`, `pendingUploadCache.ts`, `orphanCleanupJob.ts`, `uploadRateLimiter.ts`, `imageUploadHandlers.ts`, `adminUploadsHandler.ts`)
    - Add API routes: `POST /api/robots/:id/image`, `PUT /api/robots/:id/image/confirm`, `GET /api/admin/uploads`, `POST /api/admin/uploads/cleanup`
    - Update Dependencies section for nsfwjs, @tensorflow/tfjs-node, sharp, multer
    - _Requirements: 11.3_

  - [x] 16.4 Update `docs/prd_core/DATABASE_SCHEMA.md`
    - Document audit log event types: `image_moderation_rejection`, `image_robot_likeness_warning`, `image_robot_likeness_override`, `image_upload_success`
    - Include payload structure for each event type
    - _Requirements: 11.4, 11.8_

  - [x] 16.5 Update `docs/prd_pages/PRD_ROBOT_DETAIL_PAGE.md`
    - Document the "Upload Custom Image" tab in RobotImageSelector modal
    - Cover: client-side crop preview, two-step preview/confirm flow, robot-likeness warning with "Upload anyway" override, mobile-responsive behavior
    - _Requirements: 11.5_

  - [x] 16.6 Update `docs/guides/ERROR_CODES.md`
    - Add error codes: `IMAGE_MODERATION_FAILED`, `INVALID_IMAGE`, `INVALID_IMAGE_FORMAT`, `MODERATION_UNAVAILABLE`, `FILE_TOO_LARGE`, `PREVIEW_EXPIRED`, `LOW_ROBOT_LIKENESS`, `ROBOT_NOT_OWNED`, `RATE_LIMIT_EXCEEDED`
    - _Requirements: 11.6_

  - [x] 16.7 Update `.kiro/steering/coding-standards.md`
    - Add content moderation service initialization pattern (singleton, loaded at startup, fail-closed)
    - Add upload rate limiter pattern (per-user, runs after authenticateToken)
    - Add PendingUploadCache pattern (in-memory Map with TTL, per-user limits)
    - _Requirements: 11.7_

- [x] 17. Final verification — Run verification criteria and confirm spec delivery
  - Run all verification criteria from the requirements document to confirm the spec delivered what it promised:
    - `ls app/backend/src/services/moderation/` shows `contentModerationService.ts`, `fileValidationService.ts`, `fileStorageService.ts`, `imageProcessingService.ts`, `pendingUploadCache.ts`
    - `grep -c "POST.*image" app/backend/src/routes/robots.ts` returns at least 1
    - `grep -c "PUT.*image/confirm" app/backend/src/routes/robots.ts` returns at least 1
    - `grep -c "nsfwjs" app/backend/package.json` returns 1
    - `grep -c "multer" app/backend/package.json` returns 1
    - `grep -c "sharp" app/backend/package.json` returns 1
    - `grep -rn "IMAGE_MODERATION_FAILED\|MODERATION_UNAVAILABLE\|INVALID_IMAGE\|FILE_TOO_LARGE\|PREVIEW_EXPIRED" app/backend/src/ --include="*.ts" | wc -l` returns at least 5
    - `grep -c "image_moderation_rejection" app/backend/src/ -r --include="*.ts"` returns at least 1
    - `grep -c "uploadRateLimiter\|upload.*rate" app/backend/src/ -r --include="*.ts"` returns at least 1
    - `grep -rn "securityMonitor.*image\|trackImageModeration\|image_moderation" app/backend/src/ --include="*.ts" | wc -l` returns at least 1
    - `grep -rn "user-robots\|userRobots\|user_robots" app/backend/src/ --include="*.ts" | wc -l` returns at least 1
    - `grep -rn "uuid\|randomUUID\|crypto.randomUUID" app/backend/src/services/moderation/ --include="*.ts" | wc -l` returns at least 1
    - `grep -rn "512" app/backend/src/services/moderation/imageProcessingService.ts | wc -l` returns at least 1
    - `find app/frontend/src -name "*.tsx" | xargs grep -l "Upload\|upload.*image" | wc -l` returns at least 1
    - `grep -rn "LOW_ROBOT_LIKENESS\|acknowledgeRobotLikeness" app/backend/src/ --include="*.ts" | wc -l` returns at least 2
    - `grep -rn "confirmationToken\|pendingUpload" app/backend/src/ --include="*.ts" | wc -l` returns at least 2
    - `cd app/backend && npm test` passes all tests
    - `cd app/frontend && npm run build` succeeds
    - `grep -c "Image Upload" docs/guides/SECURITY.md` returns at least 1
    - `grep -c "uploads/user-robots" docs/guides/DEPLOYMENT.md` returns at least 1
    - `grep -rn "orphan\|cleanup" app/backend/src/services/moderation/ --include="*.ts" -i | wc -l` returns at least 1
    - `grep -rn "admin/uploads" app/backend/src/routes/ --include="*.ts" | wc -l` returns at least 1
    - `grep -rn "image_robot_likeness_override" app/backend/src/ --include="*.ts" | wc -l` returns at least 1
    - `find app/frontend/src -name "*.tsx" | xargs grep -l "crop.*preview\|object-fit.*cover\|canvas.*512" | wc -l` returns at least 1
  - Ensure all tests pass, ask the user if questions arise
  - _Requirements: All (1–13)_

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate the 17 correctness properties defined in the design document
- All tasks are mandatory — none are optional
- The design uses TypeScript throughout; all implementation follows existing project conventions
- No Prisma migration needed — Robot already has `imageUrl` field