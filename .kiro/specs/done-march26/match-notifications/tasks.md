# Implementation Plan: Match Notifications

## Overview

Add post-job teaser notifications to the cycle scheduler. Create a pluggable notification service with Discord webhook integration, hook it into the existing `runJob()` flow, and ensure notification failures never interrupt job execution.

## Tasks

- [x] 1. Create the Integration interface and types
  - [x] 1.1 Create `app/backend/src/services/notifications/integration.ts`
    - Define `NotificationResult` interface with `success`, `integrationName`, and optional `error` fields
    - Define `Integration` interface with readonly `name` property and `send(message: string): Promise<NotificationResult>` method
    - Define `JobName` type union: `'league' | 'tournament' | 'tag-team' | 'settlement'`
    - Define `JobContext` interface with `jobName`, optional `tournamentName`, `tournamentRound`, `tournamentMaxRounds`, `isEvenCycle`
    - _Requirements: 4.1_

- [x] 2. Implement the notification service
  - [x] 2.1 Create `app/backend/src/services/notifications/notification-service.ts`
    - Implement `buildSuccessMessage(context: JobContext, appBaseUrl: string): string | null` with job-specific message builders
    - League: `"League battles have been completed! 🏆 Click here to see the results! {link}"`
    - Tournament: `"{name} Round {round}/{maxRounds} has been completed! ⚔️ Click here to see the results! {link}"`
    - Tag team (odd cycle): `"Tag Team battles have been completed! 🤝 Click here to see the results! {link}"`
    - Tag team (even cycle): return `null`
    - Settlement: `"Daily settlement complete! 💰 Check your income and expenses! {link}"`
    - Implement `buildErrorMessage(jobName: string, appBaseUrl: string): string`
    - Implement `getActiveIntegrations(): Integration[]` — reads `DISCORD_WEBHOOK_URL` from env, logs warning if missing
    - Implement `dispatchNotification(message: string, integrations: Integration[]): Promise<NotificationResult[]>` — calls `send()` on each integration, catches errors per-integration, returns results array
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 4.2, 4.3, 4.4_

  - [x] 2.2 Write property test: Success message contains job-specific emoji and base URL
    - **Property 1: Success message contains job-specific emoji and base URL**
    - Generate random job types (excluding tag-team even cycle) and random base URL strings
    - Assert returned string is non-null, contains the correct emoji for the job type, and contains the base URL
    - Test file: `app/backend/tests/notifications.property.test.ts`
    - **Validates: Requirements 1.1, 1.3, 1.5, 1.6**

  - [x] 2.3 Write property test: Tournament message contains name and round info
    - **Property 2: Tournament message contains name and round info**
    - Generate random tournament name, round (1–maxRounds), maxRounds (1–20), and base URL
    - Assert returned string contains tournament name, round number, max rounds, and ⚔️ emoji
    - Test file: `app/backend/tests/notifications.property.test.ts`
    - **Validates: Requirements 1.2**

  - [x] 2.4 Write property test: Tag team even cycle produces no message
    - **Property 3: Tag team even cycle produces no message**
    - Generate random base URL strings with `isEvenCycle: true`
    - Assert `buildSuccessMessage` returns `null`
    - Test file: `app/backend/tests/notifications.property.test.ts`
    - **Validates: Requirements 1.4**

  - [x] 2.5 Write property test: Error message contains job name and base URL
    - **Property 4: Error message contains job name and base URL**
    - Generate random job name strings and random base URL strings
    - Assert returned string contains the job name, ⚠️ emoji, and base URL
    - Test file: `app/backend/tests/notifications.property.test.ts`
    - **Validates: Requirements 2.1**

  - [x] 2.6 Write property test: Notification dispatch is failure-isolated
    - **Property 5: Notification dispatch is failure-isolated**
    - Generate random message and random list of mock integrations (some throwing errors)
    - Assert `dispatchNotification` never throws and returns a results array with length equal to the number of integrations
    - Test file: `app/backend/tests/notifications.property.test.ts`
    - **Validates: Requirements 2.2, 4.3**

  - [x] 2.7 Write property test: Dispatch calls every registered integration
    - **Property 6: Dispatch calls every registered integration**
    - Generate random message and N mock integrations with random failure positions
    - Assert `send()` is called on all N integrations and exactly N results are returned
    - Test file: `app/backend/tests/notifications.property.test.ts`
    - **Validates: Requirements 4.2, 4.3**

- [x] 3. Implement Discord integration
  - [x] 3.1 Create `app/backend/src/services/notifications/discord-integration.ts`
    - Implement `DiscordIntegration` class implementing `Integration` interface
    - Constructor takes `webhookUrl: string`
    - `send()` method: POST to webhook URL with `{ content: message }` JSON body
    - Use `AbortController` with 5-second timeout
    - On non-2xx response: log error, return `{ success: false }` with HTTP status
    - On timeout/network error: catch, log, return `{ success: false }` with error message
    - On success: return `{ success: true, integrationName: 'discord' }`
    - _Requirements: 3.1, 3.3_

  - [x] 3.2 Write unit tests for Discord integration
    - Mock `fetch` globally to verify correct request shape (POST, JSON body with `content` field, correct URL)
    - Test non-2xx response returns `{ success: false }` with error info
    - Test timeout scenario returns failure result
    - Test successful webhook call returns `{ success: true }`
    - Test file: `app/backend/tests/notifications.test.ts`
    - _Requirements: 3.1, 3.3_

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate notifications into the cycle scheduler
  - [x] 5.1 Modify `execute*` functions to return `JobContext` data
    - `executeLeagueCycle()`: return `{ jobName: 'league' }`
    - `executeTournamentCycle()`: return `{ jobName: 'tournament', tournamentName, tournamentRound, tournamentMaxRounds }` from the last processed active tournament
    - `executeTagTeamCycle()`: return `{ jobName: 'tag-team', isEvenCycle }` based on cycle parity
    - `executeSettlement()`: return `{ jobName: 'settlement' }`
    - Update return types from `Promise<void>` to `Promise<JobContext>`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 5.2 Modify `runJob()` to dispatch notifications after job completion
    - Update `runJob()` signature: handler returns `Promise<JobContext>` instead of `Promise<void>`
    - After successful handler execution: call `buildSuccessMessage(jobContext, appBaseUrl)`, if non-null dispatch via `dispatchNotification`
    - After failed handler execution: call `buildErrorMessage(jobName, appBaseUrl)` and dispatch
    - Wrap entire notification block in try/catch — log and swallow any notification errors
    - Read `APP_BASE_URL` from `process.env`
    - _Requirements: 1.6, 2.1, 2.2, 3.2_

  - [x] 5.3 Write unit tests for scheduler notification integration
    - Test that `runJob()` calls notification service on success with correct `JobContext`
    - Test that `runJob()` calls notification service on failure with error message
    - Test that notification failure does not affect job completion status
    - Test that missing `DISCORD_WEBHOOK_URL` logs warning and skips Discord delivery
    - Test file: `app/backend/tests/notifications.test.ts`
    - _Requirements: 2.2, 3.2, 4.4_

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- No database migrations needed — feature uses existing models read-only
- Environment variables `APP_BASE_URL` and `DISCORD_WEBHOOK_URL` must be added to `.env` files for ACC/PRD
