# Implementation Plan: Player Profile Editor

## Overview

This implementation plan breaks down the player profile editor feature into discrete coding tasks. The approach follows a bottom-up strategy: database schema first, then backend API with validation, then frontend components, and finally integration and testing. Each task builds on previous work to ensure incremental progress with no orphaned code.

## Tasks

- [ ] 1. Database schema migration and validation service
  - [x] 1.1 Create Prisma migration to add profile fields to User model
    - Add stableName (nullable, unique, varchar(30))
    - Add profileVisibility (default 'public', varchar(10))
    - Add notificationsBattle (default true, boolean)
    - Add notificationsLeague (default true, boolean)
    - Add themePreference (default 'dark', varchar(20))
    - Add check constraints for profileVisibility and themePreference
    - Run migration and verify schema changes
    - _Requirements: 1.1, 4.1, 5.1, 5.2_
  
  - [x] 1.2 Create validation utility module
    - Create `prototype/backend/src/utils/validation.ts`
    - Implement `validateStableName(name: string)` function
    - Implement `isStableNameUnique(name: string, userId: number)` function
    - Implement `validatePassword(password: string)` function
    - Implement `containsProfanity(text: string)` function with basic word list
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 3.3, 3.4, 3.5, 3.6_
  
  - [x] 1.3 Write property tests for validation service
    - **Property 1: Valid stable names are accepted**
    - **Property 4: Password validation enforces all strength requirements**
    - Test with fast-check generators for valid/invalid inputs
    - _Requirements: 1.2, 1.4, 1.5, 3.3, 3.4, 3.5, 3.6_
  
  - [x] 1.4 Write unit tests for validation edge cases
    - Test profanity filter with known bad words
    - Test stable name uniqueness check
    - Test boundary conditions (exactly 3 chars, exactly 30 chars)
    - _Requirements: 1.4, 1.5, 1.7_

- [ ] 2. Backend API endpoints
  - [x] 2.1 Extend GET /api/user/profile endpoint
    - Update `prototype/backend/src/routes/user.ts`
    - Add new profile fields to the select statement
    - Return stableName, profileVisibility, notificationsBattle, notificationsLeague, themePreference
    - Handle null stableName (return username as fallback in response)
    - _Requirements: 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  
  - [x] 2.2 Write property test for profile API response
    - **Property 3: Profile API returns all required fields**
    - Verify all fields are present in response for any authenticated user
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  
  - [x] 2.3 Implement PUT /api/user/profile endpoint
    - Add PUT route handler in `prototype/backend/src/routes/user.ts`
    - Extract userId from JWT token (req.user.userId)
    - Parse request body for optional fields: stableName, profileVisibility, notificationsBattle, notificationsLeague, themePreference, currentPassword, newPassword
    - Validate all provided fields using validation service
    - If stableName provided: check uniqueness and format
    - If password change: verify currentPassword with bcrypt, hash newPassword
    - Update database with Prisma (only provided fields)
    - Return updated profile data
    - Handle errors with appropriate status codes (400, 401, 409, 500)
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.5, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  
  - [x] 2.4 Write property tests for profile update endpoint
    - **Property 2: Stable name update round-trip**
    - **Property 5: Password change round-trip**
    - **Property 6: Visibility setting round-trip**
    - **Property 8: Partial updates preserve unchanged fields**
    - **Property 9: Successful update returns updated profile**
    - _Requirements: 1.3, 3.8, 4.5, 6.5, 6.6_
  
  - [x] 2.5 Write unit tests for profile update error cases
    - Test unauthenticated request returns 401
    - Test incorrect current password returns 401
    - Test duplicate stable name returns 409
    - Test invalid data returns 400 with validation errors (Property 7)
    - Test default visibility for new users
    - _Requirements: 3.2, 6.2, 6.3, 6.4, 4.2_

- [x] 3. Checkpoint - Backend API complete
  - Ensure all backend tests pass
  - Manually test endpoints with curl or Postman
  - Verify database migrations applied correctly
  - Ask the user if questions arise

- [ ] 4. Frontend API client
  - [x] 4.1 Extend user API utilities
    - Update `prototype/frontend/src/utils/userApi.ts`
    - Add ProfileData interface with all profile fields
    - Add ProfileUpdateRequest interface
    - Implement `getProfile()` function (already exists, verify it returns new fields)
    - Implement `updateProfile(updates: ProfileUpdateRequest)` function
    - _Requirements: 6.1, 6.2, 6.5, 6.6_
  
  - [x] 4.2 Write unit tests for API client
    - Test getProfile makes correct API call
    - Test updateProfile sends correct request body
    - Test error handling for network failures
    - _Requirements: 6.2, 6.4, 6.6_

- [ ] 5. Frontend ProfilePage component
  - [x] 5.1 Create ProfilePage component structure
    - Create `prototype/frontend/src/pages/ProfilePage.tsx`
    - Set up component state: profile, editedProfile, passwordData, errors, loading, saveSuccess
    - Implement useEffect to fetch profile data on mount
    - Create section layout: Account Info, Stable Identity, Statistics, Privacy, Preferences, Security
    - Use Material-UI Card components for sections
    - _Requirements: 7.1, 7.2, 7.8_
  
  - [x] 5.2 Implement read-only sections
    - Account Information section: display username, role, join date, account ID
    - Statistics section: display currency, prestige, battles, wins, ELO, titles
    - Format dates and numbers appropriately
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  
  - [x] 5.3 Implement editable form fields
    - Stable Identity section: TextField for stable name with character counter
    - Privacy Settings section: Switch for profile visibility
    - Display Preferences section: Switches for notifications, Select for theme
    - Security section: TextField for current password, TextField for new password
    - Track form dirty state (enable save button when changed)
    - _Requirements: 1.2, 1.3, 3.1, 4.5, 5.7, 7.3_
  
  - [x] 5.4 Implement client-side validation
    - Create validateStableNameFormat function
    - Create validatePasswordFormat function
    - Display inline error messages for invalid input
    - Validate in real-time as user types
    - Prevent form submission if validation errors exist
    - _Requirements: 8.1, 8.2, 8.5, 8.6_
  
  - [x] 5.5 Implement form submission and error handling
    - Handle save button click: call updateProfile API
    - Display loading state during API call
    - On success: show success message, update profile state, clear dirty flag
    - On error: display API error messages near relevant fields
    - Handle network errors with user-friendly messages
    - _Requirements: 7.4, 7.5, 7.6, 8.3, 8.4_
  
  - [x] 5.6 Implement unsaved changes warning
    - Track form dirty state
    - Add beforeunload event listener to warn on page close
    - Add navigation guard to prompt confirmation when navigating away
    - _Requirements: 7.7_
  
  - [x] 5.7 Write unit tests for ProfilePage component
    - Test component renders all sections
    - Test form validation displays errors
    - Test save button enabled when form is dirty
    - Test successful save shows success message
    - Test API errors display error messages
    - _Requirements: 7.2, 7.3, 7.5, 7.6, 8.1_

- [ ] 6. Navigation and routing integration
  - [x] 6.1 Enable profile link in navigation
    - Update `prototype/frontend/src/components/Navigation.tsx`
    - Remove disabled flag from /profile navigation item
    - _Requirements: 7.1_
  
  - [x] 6.2 Add profile route to App
    - Update `prototype/frontend/src/App.tsx`
    - Add route: `<Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />`
    - _Requirements: 7.1_

- [x] 7. Final checkpoint and integration testing
  - Ensure all tests pass (backend and frontend)
  - Test complete user flow: login → navigate to profile → edit fields → save → verify changes
  - Test error scenarios: duplicate stable name, weak password, unauthenticated access
  - Test edge cases: null stable name displays username, default values for new users
  - Verify UI matches design system (Material-UI styling)
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Database migration must be completed before backend API work
- Backend API must be completed before frontend work
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- The profanity filter uses a basic word list - production systems should use more sophisticated filtering
