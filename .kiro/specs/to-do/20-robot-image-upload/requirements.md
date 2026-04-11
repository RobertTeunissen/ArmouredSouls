# Requirements Document

## Introduction

Add the ability for players to upload custom images for their robots, with automated content moderation using `nsfwjs` on a TensorFlow.js CPU backend and a lightweight robot-likeness check. Currently, robots can only use bundled static preset images (512×512 WebP files in `app/frontend/src/assets/robots/`) selected from a grid. This feature introduces a multipart file upload endpoint, server-side file validation (magic bytes, dimensions), content moderation (fail-closed), a robot-likeness heuristic, server-side conversion to 512×512 WebP via `sharp`, and local filesystem storage under `uploads/user-robots/` with UUID-based non-guessable filenames. A frontend upload tab is added to the existing `RobotImageSelector` modal with mobile-responsive design. Uploaded images are served as static files by Caddy. Moderation rejections are dual-logged to both the persistent `AuditLog` database table (via EventLogger) and the in-memory `SecurityMonitor` for real-time admin dashboard visibility. No moderation scores are exposed to clients.

> **Future Enhancement (Backlog):** AI-powered robot image generation in the style of existing presets, using robot context (weapon loadout, attributes) to create unique images. This is out of scope for this spec and tracked separately.

## Glossary

- **Content_Moderation_Service**: Singleton service that loads the `nsfwjs` model at application startup and classifies uploaded images against configurable NSFW thresholds, plus a lightweight robot-likeness heuristic using the nsfwjs score distribution.
- **Image_Processing_Service**: Service that uses `sharp` to resize uploaded images to 512×512 pixels (fit: `cover` for center-crop of non-square images) and convert to WebP format (quality: 80).
- **File_Validation_Service**: Service that verifies uploaded files are genuine images by checking magic bytes, MIME type consistency, and pixel dimensions.
- **File_Storage_Service**: Service that manages writing, naming (UUID-based), and deleting uploaded image files on the local filesystem under `uploads/user-robots/`.
- **Upload_Route_Handler**: Express route handler at `POST /api/robots/:id/image` that orchestrates file validation, content moderation, image processing, storage, and database update.
- **RobotImageSelector**: Existing React modal component for choosing a robot's image from preset assets; extended with a new "Upload Custom Image" tab with mobile-responsive layout.
- **Moderation_Threshold**: Configurable probability cutoff for each NSFW category (porn: 0.3, hentai: 0.3, sexy: 0.5) above which an image is rejected.
- **Robot_Likeness_Score**: A heuristic derived from nsfwjs scores — images that score very low on both "drawing" and "neutral" categories are flagged as unlikely to be robot art. This is a soft signal, not a hard block.
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
6. **Dual audit trail for moderation**: Every rejection is logged to both the persistent `AuditLog` database (via EventLogger) for permanent history and the in-memory `SecurityMonitor` for real-time visibility in the admin Security dashboard. A dedicated admin query route for historical moderation logs can be added later.
7. **Mobile-responsive upload UI**: The upload interface works on desktop and mobile browsers with touch-friendly file picker, responsive modal layout, camera roll access on iOS/Android, and preview that scales on small screens.
8. **Static file serving**: Caddy configuration for `/uploads/*` with cache headers and `X-Content-Type-Options: nosniff` establishes the pattern for serving user-uploaded content safely.

### Verification Criteria

1. `ls app/backend/src/services/moderation/` shows `contentModerationService.ts`, `fileValidationService.ts`, `fileStorageService.ts`, and `imageProcessingService.ts`
2. `grep -c "POST.*image" app/backend/src/routes/robots.ts` returns at least 1 (upload route exists)
3. `grep -c "nsfwjs" app/backend/package.json` returns 1 (dependency installed)
4. `grep -c "multer" app/backend/package.json` returns 1 (dependency installed)
5. `grep -c "sharp" app/backend/package.json` returns 1 (dependency installed)
6. `grep -rn "IMAGE_MODERATION_FAILED\|MODERATION_UNAVAILABLE\|INVALID_IMAGE\|FILE_TOO_LARGE\|LOW_ROBOT_LIKENESS" app/backend/src/ --include="*.ts" | wc -l` returns at least 5 (error codes used in handler)
7. `grep -c "image_moderation_rejection" app/backend/src/ -r --include="*.ts"` returns at least 1 (audit logging for rejections)
8. `grep -c "uploadRateLimiter\|upload.*rate" app/backend/src/ -r --include="*.ts"` returns at least 1 (rate limiter exists)
9. `grep -rn "securityMonitor.*image\|trackImageModeration\|image_moderation" app/backend/src/ --include="*.ts" | wc -l` returns at least 1 (SecurityMonitor integration exists)
10. `grep -rn "user-robots\|userRobots\|user_robots" app/backend/src/ --include="*.ts" | wc -l` returns at least 1 (separate upload directory used)
11. `grep -rn "uuid\|randomUUID\|crypto.randomUUID" app/backend/src/services/moderation/ --include="*.ts" | wc -l` returns at least 1 (UUID-based filenames)
12. `grep -rn "512" app/backend/src/services/moderation/imageProcessingService.ts | wc -l` returns at least 1 (512×512 output dimensions)
13. `find app/frontend/src -name "*.tsx" | xargs grep -l "Upload\|upload.*image" | wc -l` returns at least 1 (frontend upload component exists)
14. `cd app/backend && npm test` passes all tests
15. `cd app/frontend && npm run build` succeeds
16. `grep -c "Image Upload" docs/guides/SECURITY.md` returns at least 1 (security docs updated)
17. `grep -c "uploads/user-robots" docs/guides/DEPLOYMENT.md` returns at least 1 (deployment docs updated)

## Requirements

### Requirement 1: File Upload Endpoint

**User Story:** As a player, I want to upload a custom image for my robot via an API endpoint, so that I can personalize my robot's appearance beyond the preset options.

#### Acceptance Criteria

1. WHEN a player sends a POST request with a multipart file to `/api/robots/:id/image`, THE Upload_Route_Handler SHALL accept the file, validate it, moderate it, process it to 512×512 WebP, store it, and update the robot's `imageUrl` field.
2. WHEN the uploaded file passes all validation, moderation, and processing steps, THE Upload_Route_Handler SHALL return HTTP 200 with the updated robot object including the new `imageUrl`.
3. WHEN the requesting user does not own the specified robot, THE Upload_Route_Handler SHALL return HTTP 403 with error code `ROBOT_NOT_OWNED` and produce no side effects.
4. WHEN the request contains no file attachment, THE Upload_Route_Handler SHALL return HTTP 400 with a descriptive error.
5. WHEN any step in the upload pipeline fails, THE Upload_Route_Handler SHALL delete all temporary files before returning the error response.

### Requirement 2: File Validation

**User Story:** As a system operator, I want uploaded files validated by their actual content (not just declared MIME type), so that disguised or malformed files are rejected before reaching the moderation pipeline.

#### Acceptance Criteria

1. WHEN an uploaded file's magic bytes match JPEG, PNG, or WebP format, THE File_Validation_Service SHALL report the file as valid and return the detected MIME type and pixel dimensions.
2. WHEN an uploaded file's magic bytes do not match any supported image format, THE File_Validation_Service SHALL reject the file with error code `INVALID_IMAGE_FORMAT`.
3. WHEN an uploaded file's declared MIME type does not match the magic-byte-detected format, THE File_Validation_Service SHALL use the magic-byte-detected format as the authoritative type.
4. WHEN an uploaded image's dimensions are below 64×64 pixels or above 4096×4096 pixels, THE File_Validation_Service SHALL reject the file with error code `INVALID_IMAGE`.
5. WHEN an uploaded file exceeds 2 MB, THE Upload_Route_Handler SHALL reject the file with error code `FILE_TOO_LARGE` before it reaches the validation service.

### Requirement 3: Content Moderation

**User Story:** As a system operator, I want every uploaded image classified for NSFW content before it is stored, so that the platform remains safe and kid-friendly.

#### Acceptance Criteria

1. WHEN the Content_Moderation_Service classifies an image, IT SHALL return scores for all five nsfwjs categories (neutral, drawing, hentai, porn, sexy) and a boolean `safe` determination.
2. WHEN an image's porn score is at or above 0.3, OR hentai score is at or above 0.3, OR sexy score is at or above 0.5, THE Content_Moderation_Service SHALL mark the image as unsafe.
3. WHEN an image is marked as unsafe, THE Upload_Route_Handler SHALL return HTTP 422 with error code `IMAGE_MODERATION_FAILED` and SHALL NOT include the moderation scores in the response.
4. WHEN the nsfwjs model is not loaded or unavailable, THE Content_Moderation_Service SHALL reject all classification requests with reason `moderation_unavailable`, and THE Upload_Route_Handler SHALL return HTTP 503 with error code `MODERATION_UNAVAILABLE`.
5. WHEN the Content_Moderation_Service processes an image, IT SHALL dispose of all TensorFlow tensors after classification to prevent memory leaks.

### Requirement 4: Robot-Likeness Validation

**User Story:** As a system operator, I want uploaded images checked for robot-like content, so that players upload images that fit the game's theme rather than arbitrary photos.

#### Acceptance Criteria

1. WHEN the Content_Moderation_Service classifies an image, IT SHALL compute a Robot_Likeness_Score based on the nsfwjs "drawing" and "neutral" category scores.
2. WHEN an image's combined "drawing" + "neutral" score is below 0.6, THE Content_Moderation_Service SHALL flag the image with a `low_robot_likeness` warning.
3. WHEN an image is flagged with `low_robot_likeness`, THE Upload_Route_Handler SHALL return HTTP 422 with error code `LOW_ROBOT_LIKENESS` and a user-friendly message suggesting the player upload a robot or mech-style image.
4. THE Robot_Likeness_Score threshold SHALL be configurable independently of the NSFW thresholds.

### Requirement 5: Image Processing

**User Story:** As a system operator, I want all uploaded images converted to a uniform 512×512 WebP format, so that stored images are consistent with preset images and optimized for display.

#### Acceptance Criteria

1. WHEN an image passes validation and moderation, THE Image_Processing_Service SHALL resize it to 512×512 pixels using `sharp` with fit mode `cover` (center-crop for non-square images).
2. WHEN the Image_Processing_Service converts an image, IT SHALL output WebP format with quality 80.
3. THE Image_Processing_Service SHALL process the image before it is passed to the File_Storage_Service, ensuring only the processed 512×512 WebP buffer is stored.
4. WHEN the input image is already 512×512 WebP, THE Image_Processing_Service SHALL still process it through the pipeline to ensure consistent quality settings.

### Requirement 6: File Storage

**User Story:** As a player, I want my uploaded robot image stored reliably with non-guessable URLs and served efficiently, so that it loads quickly, persists across sessions, and cannot be enumerated by other users.

#### Acceptance Criteria

1. WHEN an approved and processed image is stored, THE File_Storage_Service SHALL write it to `uploads/user-robots/{userId}/{uuid}.webp` using a UUID-based filename.
2. WHEN a robot already has a custom uploaded image and a new image is uploaded, THE File_Storage_Service SHALL delete the previous uploaded file from disk after the new file is stored.
3. WHEN the storage directory for a user does not exist, THE File_Storage_Service SHALL create it before writing the file.
4. THE File_Storage_Service SHALL return a relative URL path (e.g., `/uploads/user-robots/42/550e8400-e29b-41d4-a716-446655440000.webp`) suitable for direct storage in the robot's `imageUrl` database field.
5. THE File_Storage_Service SHALL store uploaded images in a directory separate from the bundled preset robot images (`app/frontend/src/assets/robots/`), ensuring user uploads and preset assets are never co-located.
6. WHEN generating a filename, THE File_Storage_Service SHALL use `crypto.randomUUID()` to produce non-guessable, non-enumerable file paths.

### Requirement 7: Audit Logging

**User Story:** As an administrator, I want all image upload outcomes logged to both persistent storage and the real-time security dashboard, so that I can review moderation rejections historically and monitor them in real time.

#### Acceptance Criteria

1. WHEN an image is rejected by content moderation or robot-likeness check, THE Upload_Route_Handler SHALL create an Audit_Log entry with event type `image_moderation_rejection` containing the user ID, robot ID, moderation scores, and rejection reason.
2. WHEN an image is successfully uploaded, THE Upload_Route_Handler SHALL create an Audit_Log entry with event type `image_upload_success` containing the user ID, robot ID, image URL, and file size.
3. WHEN an image is rejected by content moderation or robot-likeness check, THE Upload_Route_Handler SHALL record the event in the SecurityMonitor for real-time visibility in the admin Security dashboard via `GET /api/admin/security/events`.

### Requirement 8: Rate Limiting

**User Story:** As a system operator, I want upload requests rate-limited per user, so that the 2GB VPS is protected from resource exhaustion by rapid repeated uploads.

#### Acceptance Criteria

1. THE Upload_Route_Handler SHALL enforce a per-user rate limit of 5 uploads per 10-minute window.
2. WHEN a user exceeds the upload rate limit, THE Upload_Route_Handler SHALL return HTTP 429 with error code `RATE_LIMIT_EXCEEDED` and a `retryAfter` value.
3. WHEN a rate limit violation occurs, THE Upload_Route_Handler SHALL track the violation via the existing SecurityMonitor.

### Requirement 9: Frontend Upload Interface

**User Story:** As a player, I want a mobile-responsive upload tab in the robot image selector modal, so that I can preview and submit a custom image from any device — desktop or mobile.

#### Acceptance Criteria

1. WHEN a player opens the RobotImageSelector modal, THE modal SHALL display an "Upload Custom Image" tab alongside the existing preset image grid tab.
2. WHEN a player selects a file in the upload tab, THE frontend SHALL validate that the file is JPEG, PNG, or WebP and under 2 MB before sending it to the server.
3. WHEN a player selects a valid file, THE frontend SHALL display a preview of the image before submission.
4. WHEN an upload is in progress, THE frontend SHALL display a loading indicator and disable the submit button.
5. WHEN the server returns error code `IMAGE_MODERATION_FAILED` or `LOW_ROBOT_LIKENESS`, THE frontend SHALL display a user-friendly message asking the player to choose a different image.
6. WHEN an upload succeeds, THE frontend SHALL update the displayed robot image to the new URL and close the upload flow.
7. WHEN the upload interface is viewed on a mobile device, THE modal SHALL use a responsive layout with touch-friendly tap targets (minimum 44×44px), a file picker that accesses the device camera roll on iOS/Android, and a preview image that scales to fit the viewport.
8. THE upload interface SHALL function correctly on both desktop browsers and mobile browsers without horizontal scrolling or clipped content.

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
6. WHEN the feature is complete, `docs/guides/ERROR_CODES.md` SHALL include error codes `IMAGE_MODERATION_FAILED`, `INVALID_IMAGE`, `INVALID_IMAGE_FORMAT`, `MODERATION_UNAVAILABLE`, `FILE_TOO_LARGE`, and `LOW_ROBOT_LIKENESS`.
7. WHEN the feature is complete, `.kiro/steering/coding-standards.md` SHALL document the content moderation service initialization pattern and the upload rate limiter pattern.
