# Requirements Document

## Introduction

Add the ability for players to upload custom images for their robots, with automated content moderation using `nsfwjs` on a TensorFlow.js CPU backend and a lightweight robot-likeness check. Currently, robots can only use bundled static preset images (512×512 WebP files in `app/frontend/src/assets/robots/`) selected from a grid. This feature introduces a two-step upload flow: (1) the player uploads an image via `POST /api/robots/:id/image` — the backend validates, moderates, and processes it to 512×512 WebP, then returns a base64 preview with a confirmation token without storing the image; (2) the player reviews the server-processed crop preview and confirms via `PUT /api/robots/:id/image/confirm` — the backend stores the already-processed image and updates the robot's `imageUrl`. This prevents "trash" images from being stored — every image on disk is one the user confirmed. Pending uploads are held in an in-memory cache with a 5-minute TTL.

NSFW content is a hard block (HTTP 422, `IMAGE_MODERATION_FAILED`) with full audit logging — this is non-negotiable. Robot-likeness below threshold is a soft warning — the preview endpoint returns HTTP 422 with error code `LOW_ROBOT_LIKENESS` and a warning message on the first attempt. The frontend shows this warning with an "Upload anyway" button. If the user confirms, the frontend re-sends the upload with `?acknowledgeRobotLikeness=true`, and the backend skips the robot-likeness check while still enforcing NSFW. Both initial warnings and acknowledged overrides are logged to AuditLog for tracking.

Before uploading, the frontend renders a client-side 512×512 center-crop preview (using canvas or CSS `object-fit: cover` on a square container) so the player can see exactly what the server will produce and decide if the crop looks good before submitting. This prevents "trash" uploads — every image stored on disk is one the user intentionally confirmed.

Orphaned images (files on disk not referenced by any robot's `imageUrl`) are cleaned up as a step in the daily settlement cycle (`adminCycleService.executeBulkCycles`, Step 15) and on-demand via an admin endpoint. The cleanup job scans `uploads/user-robots/` and cross-references against `Robot.imageUrl` in the database. Additionally, when a robot is deleted or switches from a custom image to a preset, the old file is eagerly removed from disk.

Server-side file validation (magic bytes, dimensions), content moderation (fail-closed), server-side conversion to 512×512 WebP via `sharp`, and local filesystem storage under `uploads/user-robots/` with UUID-based non-guessable filenames. A frontend upload tab is added to the existing `RobotImageSelector` modal with mobile-responsive design. Uploaded images are served as static files by Caddy. Moderation rejections are dual-logged to both the persistent `AuditLog` database table (via EventLogger) and the in-memory `SecurityMonitor` for real-time admin dashboard visibility. An admin endpoint (`GET /api/admin/uploads`) provides paginated visibility into all uploaded images by querying existing AuditLog data. No moderation scores are exposed to clients.

> **Future Enhancement (Backlog):** AI-powered robot image generation in the style of existing presets, using robot context (weapon loadout, attributes) to create unique images. This is out of scope for this spec and tracked separately.

## Glossary

- **Content_Moderation_Service**: Singleton service that loads the `nsfwjs` model at application startup and classifies uploaded images against configurable NSFW thresholds, plus a lightweight robot-likeness heuristic using the nsfwjs score distribution.
- **Image_Processing_Service**: Service that uses `sharp` to resize uploaded images to 512×512 pixels (fit: `cover` for center-crop of non-square images) and convert to WebP format (quality: 80).
- **File_Validation_Service**: Service that verifies uploaded files are genuine images by checking magic bytes, MIME type consistency, and pixel dimensions.
- **File_Storage_Service**: Service that manages writing, naming (UUID-based), and deleting uploaded image files on the local filesystem under `uploads/user-robots/`.
- **Upload_Preview_Handler**: Express route handler at `POST /api/robots/:id/image` that orchestrates file validation, content moderation, and image processing, then returns a base64 preview of the processed image with a confirmation token — without storing the image to disk. Accepts an optional `?acknowledgeRobotLikeness=true` query parameter to skip the robot-likeness check on re-upload after the user acknowledges the warning.
- **Upload_Confirm_Handler**: Express route handler at `PUT /api/robots/:id/image/confirm` that accepts a confirmation token, retrieves the pending processed image from the Pending_Upload_Cache, stores it to disk, and updates the robot's `imageUrl`.
- **Pending_Upload_Cache**: In-memory `Map` with 5-minute TTL that holds processed image buffers keyed by confirmation token. Entries are automatically evicted after TTL expiry. Prevents storing images that users never confirm.
- **RobotImageSelector**: Existing React modal component for choosing a robot's image from preset assets; extended with a new "Upload Custom Image" tab with mobile-responsive layout and a crop preview confirmation step.
- **Moderation_Threshold**: Configurable probability cutoff for each NSFW category (porn: 0.3, hentai: 0.3, sexy: 0.5) above which an image is hard-blocked.
- **Robot_Likeness_Score**: A heuristic derived from nsfwjs scores — images that score very low on both "drawing" and "neutral" categories trigger a soft warning (HTTP 422 with `LOW_ROBOT_LIKENESS`). The user can override by re-uploading with `?acknowledgeRobotLikeness=true`.
- **Orphan_Cleanup_Job**: A cleanup step integrated into the daily settlement cycle (Step 15 in `adminCycleService.executeBulkCycles`) that scans `uploads/user-robots/` and cross-references files against `Robot.imageUrl` in the database, deleting any file not referenced by any robot. Also executable on-demand via admin endpoint.
- **Admin_Uploads_Handler**: Express route handler at `GET /api/admin/uploads` that returns a paginated list of all uploaded images by querying `AuditLog` entries with event type `image_upload_success`. Supports filtering by userId and date range.
- **Magic_Bytes**: The first bytes of a file that identify its true format, independent of the declared MIME type or file extension.
- **Audit_Log**: Existing `AuditLog` database model used to record security-relevant events including moderation rejections and successful uploads.
- **SecurityMonitor**: Existing in-memory security event tracker that exposes events via `GET /api/admin/security/events` for real-time admin dashboard visibility.

## Expected Contribution

This spec adds a new user-facing feature (custom robot images) while establishing the project's first content moderation pipeline, image processing pipeline, and file upload infrastructure. It addresses the gap that players currently have no way to personalize their robots beyond selecting from a fixed set of bundled images.

1. **New upload capability**: Players gain the ability to upload custom JPEG, PNG, or WebP images (up to 2 MB, 64×64 to 4096×4096 input) for their robots. All uploads are server-side converted to uniform 512×512 WebP, matching the existing preset image format exactly.
2. **Content moderation pipeline**: The project gains a reusable, self-hosted NSFW classification service (`nsfwjs` + TensorFlow.js CPU) with a robot-likeness heuristic that can be extended to other user-generated content in the future. Zero external API dependencies.
3. **Image processing pipeline**: Server-side `sharp`-based resize and WebP conversion ensures all stored images are uniform (512×512 WebP, quality 80), reducing storage footprint and guaranteeing consistent display across the UI.
4. **Secure, non-guessable storage**: Uploaded images are stored in `uploads/user-robots/{userId}/{uuid}.webp` — separate from preset assets, with UUID-based filenames that cannot be enumerated or guessed.
5. **Security hardening**: Magic byte validation prevents disguised file uploads, fail-closed moderation blocks all uploads when the model is unavailable, and dedicated rate limiting (5 uploads/10 min) prevents resource exhaustion on the 2GB VPS.
6. **Dual audit trail for moderation**: Every rejection is logged to both the persistent `AuditLog` database (via EventLogger) for permanent history and the in-memory `SecurityMonitor` for real-time visibility in the admin Security dashboard. Robot-likeness overrides are also tracked.
7. **Mobile-responsive upload UI**: The upload interface works on desktop and mobile browsers with touch-friendly file picker, responsive modal layout, camera roll access on iOS/Android, client-side crop preview before upload, and server-processed preview that scales on small screens.
8. **Static file serving**: Caddy configuration for `/uploads/*` with cache headers and `X-Content-Type-Options: nosniff` establishes the pattern for serving user-uploaded content safely.
9. **Orphaned image cleanup**: A cleanup step integrated into the daily settlement cycle (Step 15) scans `uploads/user-robots/` and cross-references against `Robot.imageUrl` in the database, deleting unreferenced files and logging results via `eventLogger.logCycleStepComplete()`. Also runnable on-demand via admin endpoint.
10. **Admin uploads visibility**: An admin endpoint (`GET /api/admin/uploads`) provides paginated, filterable visibility into all uploaded images by querying existing AuditLog data — no new database tables needed.

### Verification Criteria

1. `ls app/backend/src/services/moderation/` shows `contentModerationService.ts`, `fileValidationService.ts`, `fileStorageService.ts`, `imageProcessingService.ts`, and `pendingUploadCache.ts`
2. `grep -c "POST.*image" app/backend/src/routes/robots.ts` returns at least 1 (preview upload route exists)
3. `grep -c "PUT.*image/confirm" app/backend/src/routes/robots.ts` returns at least 1 (confirm route exists)
4. `grep -c "nsfwjs" app/backend/package.json` returns 1 (dependency installed)
5. `grep -c "multer" app/backend/package.json` returns 1 (dependency installed)
6. `grep -c "sharp" app/backend/package.json` returns 1 (dependency installed)
7. `grep -rn "IMAGE_MODERATION_FAILED\|MODERATION_UNAVAILABLE\|INVALID_IMAGE\|FILE_TOO_LARGE\|PREVIEW_EXPIRED" app/backend/src/ --include="*.ts" | wc -l` returns at least 5 (error codes used in handlers)
8. `grep -c "image_moderation_rejection" app/backend/src/ -r --include="*.ts"` returns at least 1 (audit logging for rejections)
9. `grep -c "uploadRateLimiter\|upload.*rate" app/backend/src/ -r --include="*.ts"` returns at least 1 (rate limiter exists)
10. `grep -rn "securityMonitor.*image\|trackImageModeration\|image_moderation" app/backend/src/ --include="*.ts" | wc -l` returns at least 1 (SecurityMonitor integration exists)
11. `grep -rn "user-robots\|userRobots\|user_robots" app/backend/src/ --include="*.ts" | wc -l` returns at least 1 (separate upload directory used)
12. `grep -rn "uuid\|randomUUID\|crypto.randomUUID" app/backend/src/services/moderation/ --include="*.ts" | wc -l` returns at least 1 (UUID-based filenames)
13. `grep -rn "512" app/backend/src/services/moderation/imageProcessingService.ts | wc -l` returns at least 1 (512×512 output dimensions)
14. `find app/frontend/src -name "*.tsx" | xargs grep -l "Upload\|upload.*image" | wc -l` returns at least 1 (frontend upload component exists)
15. `grep -rn "LOW_ROBOT_LIKENESS\|acknowledgeRobotLikeness" app/backend/src/ --include="*.ts" | wc -l` returns at least 2 (robot-likeness warning-with-override flow implemented)
16. `grep -rn "confirmationToken\|pendingUpload" app/backend/src/ --include="*.ts" | wc -l` returns at least 2 (two-step flow implemented)
17. `cd app/backend && npm test` passes all tests
18. `cd app/frontend && npm run build` succeeds
19. `grep -c "Image Upload" docs/guides/SECURITY.md` returns at least 1 (security docs updated)
20. `grep -c "uploads/user-robots" docs/guides/DEPLOYMENT.md` returns at least 1 (deployment docs updated)
21. `grep -rn "orphan\|cleanup" app/backend/src/services/moderation/ --include="*.ts" -i | wc -l` returns at least 1 (orphan cleanup job exists)
22. `grep -rn "admin/uploads" app/backend/src/routes/ --include="*.ts" | wc -l` returns at least 1 (admin uploads endpoint exists)
23. `grep -rn "image_robot_likeness_override" app/backend/src/ --include="*.ts" | wc -l` returns at least 1 (override audit logging exists)
24. `find app/frontend/src -name "*.tsx" | xargs grep -l "crop.*preview\|object-fit.*cover\|canvas.*512" | wc -l` returns at least 1 (client-side crop preview exists)

## Requirements

### Requirement 1: Two-Step Upload Flow (Preview + Confirm)

**User Story:** As a player, I want to preview the server-processed crop of my uploaded image before it is stored, so that I can confirm the result looks good and avoid storing images I don't want.

#### Acceptance Criteria

1. WHEN a player sends a POST request with a multipart file to `/api/robots/:id/image`, THE Upload_Preview_Handler SHALL accept the file, validate it, moderate it (NSFW hard block + robot-likeness soft warning), and process it to 512×512 WebP, then return the processed image as a base64 data URL along with a confirmation token — without storing the image to disk.
2. WHEN the uploaded file passes all validation, NSFW moderation, and robot-likeness check (or `?acknowledgeRobotLikeness=true` is set), THE Upload_Preview_Handler SHALL return HTTP 200 with `{ preview: string, confirmationToken: string }`.
3. WHEN the requesting user does not own the specified robot, THE Upload_Preview_Handler SHALL return HTTP 403 with error code `ROBOT_NOT_OWNED` and produce no side effects.
4. WHEN the request contains no file attachment, THE Upload_Preview_Handler SHALL return HTTP 400 with a descriptive error.
5. WHEN a player sends a PUT request to `/api/robots/:id/image/confirm` with a valid confirmation token, THE Upload_Confirm_Handler SHALL retrieve the processed image from the Pending_Upload_Cache, store it to disk, update the robot's `imageUrl`, and return HTTP 200 with the updated robot object.
6. WHEN the confirmation token is expired or invalid, THE Upload_Confirm_Handler SHALL return HTTP 410 with error code `PREVIEW_EXPIRED` and a message asking the user to re-upload.
7. THE Pending_Upload_Cache SHALL hold processed image buffers in memory with a 5-minute TTL, automatically evicting entries after expiry.
8. WHEN any step in the preview pipeline fails, THE Upload_Preview_Handler SHALL clean up all temporary state before returning the error response.

### Requirement 2: File Validation

**User Story:** As a system operator, I want uploaded files validated by their actual content (not just declared MIME type), so that disguised or malformed files are rejected before reaching the moderation pipeline.

#### Acceptance Criteria

1. WHEN an uploaded file's magic bytes match JPEG, PNG, or WebP format, THE File_Validation_Service SHALL report the file as valid and return the detected MIME type and pixel dimensions.
2. WHEN an uploaded file's magic bytes do not match any supported image format, THE File_Validation_Service SHALL reject the file with error code `INVALID_IMAGE_FORMAT`.
3. WHEN an uploaded file's declared MIME type does not match the magic-byte-detected format, THE File_Validation_Service SHALL use the magic-byte-detected format as the authoritative type.
4. WHEN an uploaded image's dimensions are below 64×64 pixels or above 4096×4096 pixels, THE File_Validation_Service SHALL reject the file with error code `INVALID_IMAGE`.
5. WHEN an uploaded file exceeds 2 MB, THE Upload_Preview_Handler SHALL reject the file with error code `FILE_TOO_LARGE` before it reaches the validation service.

### Requirement 3: Content Moderation

**User Story:** As a system operator, I want every uploaded image classified for NSFW content before it is stored, so that the platform remains safe and kid-friendly.

#### Acceptance Criteria

1. WHEN the Content_Moderation_Service classifies an image, IT SHALL return scores for all five nsfwjs categories (neutral, drawing, hentai, porn, sexy) and a boolean `safe` determination.
2. WHEN an image's porn score is at or above 0.3, OR hentai score is at or above 0.3, OR sexy score is at or above 0.5, THE Content_Moderation_Service SHALL mark the image as unsafe.
3. WHEN an image is marked as unsafe, THE Upload_Preview_Handler SHALL return HTTP 422 with error code `IMAGE_MODERATION_FAILED` and SHALL NOT include the moderation scores in the response.
4. WHEN the nsfwjs model is not loaded or unavailable, THE Content_Moderation_Service SHALL reject all classification requests with reason `moderation_unavailable`, and THE Upload_Preview_Handler SHALL return HTTP 503 with error code `MODERATION_UNAVAILABLE`.
5. WHEN the Content_Moderation_Service processes an image, IT SHALL dispose of all TensorFlow tensors after classification to prevent memory leaks.

### Requirement 4: Robot-Likeness Soft Warning with Override

**User Story:** As a system operator, I want uploaded images checked for robot-like content with a warning shown to the user, so that players are encouraged to upload thematic images while still having the freedom to override the suggestion.

#### Acceptance Criteria

1. WHEN the Content_Moderation_Service classifies an image, IT SHALL compute a Robot_Likeness_Score based on the nsfwjs "drawing" and "neutral" category scores.
2. WHEN an image's combined "drawing" + "neutral" score is below 0.6, THE Content_Moderation_Service SHALL flag the image with `robotLikely: false`.
3. WHEN an image is flagged with `robotLikely: false` and the request does not include `?acknowledgeRobotLikeness=true`, THE Upload_Preview_Handler SHALL return HTTP 422 with error code `LOW_ROBOT_LIKENESS` and a warning message ("This doesn't look like a robot").
4. WHEN a player re-uploads with `?acknowledgeRobotLikeness=true`, THE Upload_Preview_Handler SHALL skip the robot-likeness check but SHALL still enforce NSFW moderation, and SHALL return the preview response normally on success.
5. WHEN an image triggers a robot-likeness warning (initial 422), THE Upload_Preview_Handler SHALL log the warning to both the Audit_Log and SecurityMonitor with severity `low` and event type `image_robot_likeness_warning`.
6. WHEN a player overrides a robot-likeness warning by re-uploading with `?acknowledgeRobotLikeness=true`, THE Upload_Preview_Handler SHALL log the override to both the Audit_Log and SecurityMonitor with event type `image_robot_likeness_override` and severity `low`.
7. THE Robot_Likeness_Score threshold SHALL be configurable independently of the NSFW thresholds.

### Requirement 5: Image Processing

**User Story:** As a system operator, I want all uploaded images converted to a uniform 512×512 WebP format, so that stored images are consistent with preset images and optimized for display.

#### Acceptance Criteria

1. WHEN an image passes validation and moderation, THE Image_Processing_Service SHALL resize it to 512×512 pixels using `sharp` with fit mode `cover` (center-crop for non-square images).
2. WHEN the Image_Processing_Service converts an image, IT SHALL output WebP format with quality 80.
3. THE Image_Processing_Service SHALL process the image before it is passed to the File_Storage_Service, ensuring only the processed 512×512 WebP buffer is stored.
4. WHEN the input image is already 512×512 WebP, THE Image_Processing_Service SHALL still process it through the pipeline to ensure consistent quality settings.

### Requirement 6: File Storage and Orphan Cleanup

**User Story:** As a player, I want my uploaded robot image stored reliably with non-guessable URLs and served efficiently, so that it loads quickly, persists across sessions, and cannot be enumerated by other users. As a system operator, I want orphaned images cleaned up both eagerly and periodically so disk space is not wasted on files no longer referenced by any robot.

#### Acceptance Criteria

1. WHEN an approved and processed image is stored, THE File_Storage_Service SHALL write it to `uploads/user-robots/{userId}/{uuid}.webp` using a UUID-based filename.
2. WHEN a robot already has a custom uploaded image and a new image is uploaded, THE File_Storage_Service SHALL delete the previous uploaded file from disk after the new file is stored.
3. WHEN the storage directory for a user does not exist, THE File_Storage_Service SHALL create it before writing the file.
4. THE File_Storage_Service SHALL return a relative URL path (e.g., `/uploads/user-robots/42/550e8400-e29b-41d4-a716-446655440000.webp`) suitable for direct storage in the robot's `imageUrl` database field.
5. THE File_Storage_Service SHALL store uploaded images in a directory separate from the bundled preset robot images (`app/frontend/src/assets/robots/`), ensuring user uploads and preset assets are never co-located.
6. WHEN generating a filename, THE File_Storage_Service SHALL use `crypto.randomUUID()` to produce non-guessable, non-enumerable file paths.
7. WHEN a robot's `imageUrl` changes from a `/uploads/` path to a preset image path or null, THE system SHALL delete the old uploaded file from disk.
8. WHEN a robot with a custom uploaded image (`imageUrl` starting with `/uploads/`) is deleted, THE system SHALL delete the uploaded file from disk.

### Requirement 7: Audit Logging

**User Story:** As an administrator, I want all image upload outcomes logged to both persistent storage and the real-time security dashboard, so that I can review moderation rejections historically and monitor them in real time.

#### Acceptance Criteria

1. WHEN an image is rejected by NSFW content moderation, THE Upload_Preview_Handler SHALL create an Audit_Log entry with event type `image_moderation_rejection` containing the user ID, robot ID, moderation scores, and rejection reason, and SHALL record the event in the SecurityMonitor with severity `medium`.
2. WHEN an image triggers a robot-likeness warning (initial 422), THE Upload_Preview_Handler SHALL create an Audit_Log entry with event type `image_robot_likeness_warning` containing the user ID, robot ID, and robot-likeness score, and SHALL record the event in the SecurityMonitor with severity `low`.
3. WHEN an image is successfully stored (after confirmation), THE Upload_Confirm_Handler SHALL create an Audit_Log entry with event type `image_upload_success` containing the user ID, robot ID, image URL, and file size.
4. WHEN an image is rejected by NSFW content moderation, THE Upload_Preview_Handler SHALL record the event in the SecurityMonitor for real-time visibility in the admin Security dashboard via `GET /api/admin/security/events`.
5. WHEN a player overrides a robot-likeness warning by re-uploading with `?acknowledgeRobotLikeness=true`, THE Upload_Preview_Handler SHALL create an Audit_Log entry with event type `image_robot_likeness_override` containing the user ID, robot ID, and robot-likeness score, and SHALL record the event in the SecurityMonitor with severity `low`.

### Requirement 8: Rate Limiting

**User Story:** As a system operator, I want upload requests rate-limited per user, so that the 2GB VPS is protected from resource exhaustion by rapid repeated uploads.

#### Acceptance Criteria

1. THE Upload_Preview_Handler SHALL enforce a per-user rate limit of 5 uploads per 10-minute window.
2. WHEN a user exceeds the upload rate limit, THE Upload_Preview_Handler SHALL return HTTP 429 with error code `RATE_LIMIT_EXCEEDED` and a `retryAfter` value.
3. WHEN a rate limit violation occurs, THE Upload_Preview_Handler SHALL track the violation via the existing SecurityMonitor.

### Requirement 9: Frontend Upload Interface

**User Story:** As a player, I want a mobile-responsive upload tab in the robot image selector modal with a client-side crop preview before upload and a server-processed preview after upload, so that I can see exactly how my image will look before committing it.

#### Acceptance Criteria

1. WHEN a player opens the RobotImageSelector modal, THE modal SHALL display an "Upload Custom Image" tab alongside the existing preset image grid tab.
2. WHEN a player selects a file in the upload tab, THE frontend SHALL validate that the file is JPEG, PNG, or WebP and under 2 MB before sending it to the server.
3. WHEN a player selects a valid file, THE frontend SHALL immediately render a client-side 512×512 center-crop preview (using canvas or CSS `object-fit: cover` on a 512×512 container) showing the player what the server will produce, before the upload is submitted.
4. WHEN the client-side crop preview is displayed, THE frontend SHALL show a "Upload" button to submit the image and a "Cancel" button to discard and return to file selection.
5. WHEN the player submits the upload, THE frontend SHALL send the file to the preview endpoint and display the server-returned base64 crop preview for final confirmation.
6. WHEN an upload is in progress, THE frontend SHALL display a loading indicator and disable the submit button.
7. WHEN the server returns error code `IMAGE_MODERATION_FAILED`, THE frontend SHALL display a user-friendly message asking the player to choose a different image.
8. WHEN the server returns error code `LOW_ROBOT_LIKENESS`, THE frontend SHALL display a warning message ("This doesn't look like a robot — are you sure?") with an "Upload anyway" button.
9. WHEN the player clicks "Upload anyway" after a `LOW_ROBOT_LIKENESS` warning, THE frontend SHALL re-send the same file to the preview endpoint with `?acknowledgeRobotLikeness=true` to bypass the robot-likeness check.
10. WHEN the player confirms the server-returned crop preview, THE frontend SHALL send the confirmation token to the confirm endpoint and update the displayed robot image to the new URL.
11. WHEN the player rejects the crop preview, THE frontend SHALL discard the preview and return to the file selection state without sending a confirm request.
12. WHEN the confirm endpoint returns error code `PREVIEW_EXPIRED`, THE frontend SHALL display a message asking the player to re-upload the image.
13. WHEN the upload interface is viewed on a mobile device, THE modal SHALL use a responsive layout with touch-friendly tap targets (minimum 44×44px), a file picker that accesses the device camera roll on iOS/Android, and a preview image that scales to fit the viewport.
14. THE upload interface SHALL function correctly on both desktop browsers and mobile browsers without horizontal scrolling or clipped content.

### Requirement 10: Static File Serving

**User Story:** As a system operator, I want uploaded images served efficiently by Caddy with appropriate security headers, so that images load fast and cannot be exploited.

#### Acceptance Criteria

1. THE Caddy configuration SHALL serve files under `/uploads/*` as static files with `Cache-Control: public, max-age=86400`.
2. THE Caddy configuration SHALL include `X-Content-Type-Options: nosniff` on all responses from `/uploads/*`.

### Requirement 11: Documentation Updates

**User Story:** As a developer onboarding to the project, I want documentation to accurately describe the new upload, moderation, and image processing systems, so that I can maintain and extend them correctly.

#### Acceptance Criteria

1. WHEN the feature is complete, `docs/guides/SECURITY.md` SHALL contain a Security Playbook entry for "Image Upload Content Moderation" covering the fail-closed pattern, magic byte validation, robot-likeness heuristic, non-guessable URLs, and audit logging.
2. WHEN the feature is complete, `docs/guides/DEPLOYMENT.md` SHALL contain instructions for creating the `uploads/user-robots/` directory and the Caddy static file serving configuration.
3. WHEN the feature is complete, `docs/prd_core/ARCHITECTURE.md` SHALL list the `moderation` service directory and the `POST /api/robots/:id/image` route.
4. WHEN the feature is complete, `docs/prd_core/DATABASE_SCHEMA.md` SHALL document the `image_moderation_rejection` and `image_upload_success` audit log event types.
5. WHEN the feature is complete, `docs/prd_pages/PRD_ROBOT_DETAIL_PAGE.md` SHALL document the "Upload Custom Image" tab in the RobotImageSelector modal.
6. WHEN the feature is complete, `docs/guides/ERROR_CODES.md` SHALL include error codes `IMAGE_MODERATION_FAILED`, `INVALID_IMAGE`, `INVALID_IMAGE_FORMAT`, `MODERATION_UNAVAILABLE`, `FILE_TOO_LARGE`, `PREVIEW_EXPIRED`, and `LOW_ROBOT_LIKENESS`.
7. WHEN the feature is complete, `.kiro/steering/coding-standards.md` SHALL document the content moderation service initialization pattern and the upload rate limiter pattern.
8. WHEN the feature is complete, `docs/prd_core/DATABASE_SCHEMA.md` SHALL document the `image_robot_likeness_override` audit log event type alongside the existing moderation event types.

### Requirement 12: Orphaned Image Cleanup Job

**User Story:** As a system operator, I want orphaned uploaded images cleaned up automatically as part of the daily settlement cycle, so that disk space is not wasted on files no longer referenced by any robot.

#### Acceptance Criteria

1. THE Orphan_Cleanup_Job SHALL scan all files in `uploads/user-robots/` and cross-reference each file against `Robot.imageUrl` values in the database.
2. WHEN a file on disk is not referenced by any robot's `imageUrl`, THE Orphan_Cleanup_Job SHALL delete that file.
3. THE Orphan_Cleanup_Job SHALL log cleanup results including the number of files deleted and total disk space reclaimed.
4. THE Orphan_Cleanup_Job SHALL be executable on-demand via an admin endpoint (`POST /api/admin/uploads/cleanup`).
5. THE Orphan_Cleanup_Job SHALL run as Step 15 in the daily settlement cycle (`adminCycleService.executeBulkCycles`), after the cycle snapshot step, using the existing `eventLogger.logCycleStepComplete()` pattern to log step duration and results.
6. WHEN the Orphan_Cleanup_Job completes, IT SHALL return a summary with `{ filesDeleted: number, bytesReclaimed: number, errors: string[] }`.

### Requirement 13: Admin Uploads View

**User Story:** As an administrator, I want to see which images have been uploaded and by whom, so that I can monitor user-uploaded content and investigate issues.

#### Acceptance Criteria

1. WHEN an admin sends a GET request to `/api/admin/uploads`, THE Admin_Uploads_Handler SHALL return a paginated list of all uploaded images.
2. THE Admin_Uploads_Handler SHALL query the Audit_Log table for entries with event type `image_upload_success` and return userId, username, robotId, robotName, imageUrl, fileSize, and uploadDate for each entry.
3. WHEN the request includes a `userId` query parameter, THE Admin_Uploads_Handler SHALL filter results to only show uploads from that user.
4. WHEN the request includes `startDate` and/or `endDate` query parameters, THE Admin_Uploads_Handler SHALL filter results to only show uploads within the specified date range.
5. THE Admin_Uploads_Handler SHALL support pagination via `page` and `limit` query parameters with a default limit of 50 and a maximum limit of 200.
6. THE Admin_Uploads_Handler SHALL require admin authentication and return HTTP 403 for non-admin users.
