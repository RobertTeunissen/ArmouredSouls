# Implementation Plan: User Registration Module

## Overview

This implementation plan breaks down the user registration module into discrete coding tasks. The module extends the existing authentication system with registration capabilities, dual login support (username or email), and a unified front page. Implementation follows a layered approach: database migration, backend services, API endpoints, frontend components, and comprehensive testing.

## Tasks

- [x] 1. Database migration and setup
  - [x] 1.1 Create database migration to add email column to users table
    - Add email column as VARCHAR(20), initially nullable
    - Create unique index on email column
    - Add migration rollback script
    - _Requirements: 1.5, 2.2_
  
  - [x] 1.2 Create migration script to populate existing users with placeholder emails
    - Generate placeholder emails in format `{username}@legacy.local`
    - Update all existing user records
    - Add verification query to confirm all users have emails
    - _Requirements: 1.5_
  
  - [x] 1.3 Update User model/schema to include email field
    - Add email field to TypeScript User interface
    - Update database schema definition
    - Add email to user profile response type
    - _Requirements: 1.5, 8.3_

- [x] 2. Backend validation service
  - [x] 2.1 Implement username validation function
    - Validate length (3-20 characters)
    - Validate allowed characters (alphanumeric, underscore, hyphen)
    - Return ValidationResult with specific error messages
    - _Requirements: 2.3, 2.4, 2.5, 2.6_
  
  - [x] 2.2 Write property test for username validation
    - **Property 7: Valid Username Characters**
    - **Validates: Requirements 2.5, 2.6**
  
  - [x] 2.3 Implement email validation function
    - Validate length (3-50 characters)
    - Validate allowed characters (alphanumeric, underscore, hyphen)
    - Return ValidationResult with specific error messages
    - _Requirements: 2.7, 2.8, 2.9, 2.10_
  
  - [x] 2.4 Write property test for email validation
    - **Property 8: Valid Email Characters**
    - **Validates: Requirements 2.9, 2.10**
  
  - [x] 2.5 Implement password validation function
    - Validate length (8-128 characters)
    - Return ValidationResult with specific error messages
    - _Requirements: 3.1, 3.2_
  
  - [x] 2.6 Implement validateRegistrationRequest function
    - Check for missing required fields (username, email, password)
    - Call individual validation functions
    - Aggregate validation errors
    - Return comprehensive ValidationResult
    - _Requirements: 3.3, 9.2_
  
  - [x] 2.7 Write property test for missing required fields
    - **Property 9: Missing Required Fields Rejection**
    - **Validates: Requirements 3.3**
  
  - [x] 2.8 Write unit tests for validation service
    - Test boundary values (length 3, 20, 8, 128)
    - Test invalid characters
    - Test error message content
    - _Requirements: 11.2_

- [x] 3. Backend password and JWT services
  - [x] 3.1 Implement password hashing function using bcrypt
    - Use configurable salt rounds (default 10)
    - Return bcrypt hash string
    - _Requirements: 1.2_
  
  - [x] 3.2 Implement password verification function
    - Compare plaintext password with bcrypt hash
    - Return boolean result
    - _Requirements: 6.5_
  
  - [x] 3.3 Write property test for password hashing
    - **Property 2: Password Hashing**
    - **Validates: Requirements 1.2**
  
  - [x] 3.4 Write unit tests for password service
    - Verify hash format (bcrypt prefix)
    - Verify hash differs from plaintext
    - Verify verification function works correctly
    - _Requirements: 11.1_
  
  - [x] 3.5 Implement JWT token generation function
    - Include userId, username, role in payload
    - Use configurable expiration time
    - Sign with secret from environment variable
    - _Requirements: 1.3, 6.3_
  
  - [x] 3.6 Write unit tests for JWT service
    - Verify token format
    - Verify payload contents
    - Verify token signature
    - _Requirements: 11.3_

- [x] 4. Backend user service
  - [x] 4.1 Implement createUser function
    - Accept username, email, passwordHash
    - Set default values (currency, prestige, role)
    - Insert into database
    - Return created User object
    - _Requirements: 1.1, 1.6, 1.7, 1.8_
  
  - [x] 4.2 Write property test for default account values
    - **Property 4: Default Account Values**
    - **Validates: Requirements 1.6, 1.7, 1.8**
  
  - [x] 4.3 Implement findUserByUsername function
    - Query database by username
    - Return User object or null
    - _Requirements: 6.1_
  
  - [x] 4.4 Implement findUserByEmail function
    - Query database by email
    - Return User object or null
    - _Requirements: 6.2_
  
  - [x] 4.5 Implement findUserByIdentifier function
    - Try findUserByUsername first
    - If not found, try findUserByEmail
    - Return User object or null
    - _Requirements: 6.1, 6.2, 6.6_
  
  - [x] 4.6 Write integration tests for user service
    - Test user creation with valid data
    - Test duplicate username detection
    - Test duplicate email detection
    - Test findUserByIdentifier with username
    - Test findUserByIdentifier with email
    - _Requirements: 11.4, 11.5, 11.6_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Backend registration API endpoint
  - [x] 6.1 Create POST /api/auth/register endpoint handler
    - Extract username, email, password from request body
    - Call validateRegistrationRequest
    - Check for duplicate username in database
    - Check for duplicate email in database
    - Hash password using password service
    - Create user using user service
    - Generate JWT token
    - Return 201 response with token and user profile
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2_
  
  - [x] 6.2 Add error handling to registration endpoint
    - Catch validation errors → return 400 with specific message
    - Catch duplicate errors → return 400 with specific message
    - Catch database errors → return 500 with generic message
    - Log all errors server-side with full details
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 6.3 Write property test for valid registration
    - **Property 1: Valid Registration Creates Account**
    - **Validates: Requirements 1.1, 1.5**
  
  - [x] 6.4 Write property test for registration response format
    - **Property 3: Registration Response Format**
    - **Validates: Requirements 1.3, 1.4**
  
  - [x] 6.5 Write property test for duplicate username rejection
    - **Property 5: Duplicate Username Rejection**
    - **Validates: Requirements 2.1**
  
  - [x] 6.6 Write property test for duplicate email rejection
    - **Property 6: Duplicate Email Rejection**
    - **Validates: Requirements 2.2**
  
  - [x] 6.7 Write integration tests for registration endpoint
    - Test complete registration flow with valid data
    - Test rejection of invalid inputs
    - Test error response formats
    - _Requirements: 11.7_

- [x] 7. Backend enhanced login API endpoint
  - [x] 7.1 Update POST /api/auth/login endpoint to accept identifier field
    - Change request body to accept 'identifier' instead of 'username'
    - Maintain backward compatibility if needed
    - _Requirements: 6.1, 6.2, 6.6_
  
  - [x] 7.2 Update login handler to use findUserByIdentifier
    - Call findUserByIdentifier with provided identifier
    - Verify password if user found
    - Generate JWT token on success
    - Return generic error on failure (don't reveal if user exists)
    - _Requirements: 6.3, 6.4, 6.5_
  
  - [x] 7.3 Write property test for login response format
    - **Property 15: Login Response Format**
    - **Validates: Requirements 6.3, 6.4**
  
  - [x] 7.4 Write property test for invalid login credentials
    - **Property 16: Invalid Login Credentials**
    - **Validates: Requirements 6.5**
  
  - [x] 7.5 Write property test for dual login support
    - **Property 17: Dual Login Support**
    - **Validates: Requirements 6.6**
  
  - [x] 7.6 Write integration tests for enhanced login endpoint
    - Test login with username
    - Test login with email
    - Test invalid credentials handling
    - _Requirements: 11.8_

- [x] 8. Apply rate limiting to registration endpoint
  - [x] 8.1 Add existing rate limiter middleware to registration endpoint
    - Use same rate limiter as login endpoint
    - Configure appropriate limits (5 requests per hour recommended)
    - _Requirements: 7.1, 7.3_
  
  - [x] 8.2 Write property test for rate limiting
    - **Property 18: Rate Limiting Application**
    - **Validates: Requirements 7.1, 7.2**
  
  - [x] 8.3 Write integration tests for rate limiting
    - Test rate limit enforcement
    - Test 429 response when limit exceeded
    - _Requirements: 11.12_

- [x] 9. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Frontend registration form component
  - [x] 10.1 Create RegistrationForm component with form fields
    - Add username input field
    - Add email input field
    - Add password input field
    - Add password confirmation input field
    - Add submit button
    - Implement form state management
    - _Requirements: 4.1, 4.2_
  
  - [x] 10.2 Implement password confirmation validation
    - Compare password and passwordConfirmation fields
    - Display error message if they don't match
    - Prevent form submission if they don't match
    - Clear error when user modifies fields
    - _Requirements: 4.3_
  
  - [x] 10.3 Write property test for password confirmation mismatch
    - **Property 10: Password Confirmation Mismatch**
    - **Validates: Requirements 4.3**
  
  - [x] 10.4 Implement registration form submission handler
    - Call POST /api/auth/register with form data
    - Set isSubmitting state during request
    - Disable submit button while submitting
    - Display loading indicator while submitting
    - _Requirements: 4.5_
  
  - [x] 10.5 Write property test for loading state
    - **Property 12: Loading State During Submission**
    - **Validates: Requirements 4.5**
  
  - [x] 10.6 Implement error handling in registration form
    - Display error messages from API response
    - Clear errors when user modifies form fields
    - Use accessible error display (ARIA labels)
    - Match styling from existing login page
    - _Requirements: 4.4, 9.4_
  
  - [x] 10.7 Write property test for error message display
    - **Property 11: Error Message Display**
    - **Validates: Requirements 4.4, 9.4**
  
  - [x] 10.8 Implement success handling in registration form
    - Store JWT token in localStorage
    - Call onSuccess callback with token and user data
    - _Requirements: 4.6_
  
  - [x] 10.9 Write component tests for registration form
    - Test form rendering
    - Test password confirmation validation
    - Test form submission
    - Test error display
    - Test loading state
    - _Requirements: 11.9, 11.10_

- [x] 11. Frontend enhanced login form component
  - [x] 11.1 Update LoginForm component to accept identifier field
    - Change username field label to "Username or Email"
    - Update field name from 'username' to 'identifier'
    - Update API call to send 'identifier' field
    - _Requirements: 6.6_
  
  - [x] 11.2 Write component tests for enhanced login form
    - Test identifier field accepts username
    - Test identifier field accepts email
    - Test form submission with identifier
    - _Requirements: 11.8_

- [x] 12. Frontend front page component
  - [x] 12.1 Create FrontPage component with view switching
    - Add state to track current view ('register' or 'login')
    - Add navigation buttons to switch between views
    - Render RegistrationForm when view is 'register'
    - Render LoginForm when view is 'login'
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 12.2 Add branding elements to front page
    - Include existing logo
    - Apply existing design system styling
    - Ensure consistent styling with login page
    - _Requirements: 4.7, 5.5_
  
  - [x] 12.3 Write property test for view switching state preservation
    - **Property 14: View Switching State Preservation**
    - **Validates: Requirements 5.4**
  
  - [x] 12.4 Write component tests for front page
    - Test view switching
    - Test registration form rendering
    - Test login form rendering
    - Test navigation between views
    - _Requirements: 11.11_

- [x] 13. Frontend authentication context integration
  - [x] 13.1 Update AuthContext to handle registration success
    - Add registration success handler if not already present
    - Ensure updateUser function works with registration response
    - Ensure token storage works with registration response
    - _Requirements: 8.1, 8.2_
  
  - [x] 13.2 Wire registration form to AuthContext
    - Pass AuthContext update function to RegistrationForm
    - Call AuthContext update on successful registration
    - Navigate to dashboard after AuthContext update
    - _Requirements: 4.6, 8.2_
  
  - [x] 13.3 Write property test for successful registration flow
    - **Property 13: Successful Registration Flow**
    - **Validates: Requirements 4.6, 8.2**
  
  - [x] 13.4 Write property test for response format consistency
    - **Property 19: Response Format Consistency**
    - **Validates: Requirements 8.3**
  
  - [x] 13.5 Write property test for authentication equivalence
    - **Property 20: Authentication Equivalence (Round-Trip Property)**
    - **Validates: Requirements 8.4, 11.13**

- [x] 14. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Error handling property tests
  - [x] 15.1 Write property test for database error handling
    - **Property 21: Database Error Handling**
    - **Validates: Requirements 9.1**
  
  - [x] 15.2 Write property test for validation error specificity
    - **Property 22: Validation Error Specificity**
    - **Validates: Requirements 9.2**
  
  - [x] 15.3 Write property test for unexpected error handling
    - **Property 23: Unexpected Error Handling**
    - **Validates: Requirements 9.3**

- [x] 16. API documentation
  - [x] 16.1 Create OpenAPI specification for registration endpoint
    - Document POST /api/auth/register
    - Include request body schema
    - Include success response schema (201)
    - Include error response schemas (400, 429, 500)
    - Add example requests and responses
    - _Requirements: 10.1, 10.2_
  
  - [x] 16.2 Update OpenAPI specification for enhanced login endpoint
    - Document updated POST /api/auth/login
    - Update request body to show identifier field
    - Include success response schema (200)
    - Include error response schemas (401, 429, 500)
    - Add example requests and responses
    - _Requirements: 10.1_
  
  - [x] 16.3 Create error code reference documentation
    - List all error codes and HTTP status codes
    - Document error message text for each code
    - Provide recommended client handling for each error
    - Add troubleshooting guide for common issues
    - _Requirements: 10.7_

- [x] 17. Developer documentation
  - [x] 17.1 Create developer guide for user registration module
    - Document architecture overview with diagrams
    - Document data flow for registration and login
    - Document authentication flow sequence
    - Add setup instructions (environment variables, database migration)
    - _Requirements: 10.4, 10.8_
  
  - [x] 17.2 Add integration guide to developer documentation
    - Provide examples of calling registration API
    - Document integration with existing authentication system
    - Explain how to extend validation rules
    - Explain how to customize default user values
    - _Requirements: 10.5_
  
  - [x] 17.3 Add JSDoc comments to all backend code
    - Document all public functions with parameters and return values
    - Document error conditions and throws
    - Add usage examples for complex functions
    - Document validation rules in validation service
    - _Requirements: 10.3_
  
  - [x] 17.4 Add JSDoc comments to all frontend components
    - Document component props with types
    - Document state management
    - Document event handlers
    - Add usage examples for reusable components
    - _Requirements: 10.3, 10.6_
  
  - [x] 17.5 Add inline comments for complex logic
    - Comment validation logic
    - Comment security-sensitive code (password hashing, JWT)
    - Comment non-obvious business rules
    - Comment error handling strategies
    - _Requirements: 10.6_

- [x] 18. Final integration and verification
  - [x] 18.1 Wire all components together
    - Ensure FrontPage is set as landing page route
    - Ensure registration and login flows work end-to-end
    - Verify token storage and AuthContext updates
    - Verify navigation to dashboard after authentication
    - _Requirements: 4.6, 5.1, 8.1, 8.2_
  
  - [x] 18.2 Verify environment variable configuration
    - Document all required environment variables
    - Add validation for required environment variables
    - Set appropriate default values where applicable
    - _Requirements: 10.8_
  
  - [x] 18.3 Run all tests and verify coverage
    - Run all unit tests
    - Run all integration tests
    - Run all property-based tests
    - Verify test coverage meets requirements
    - _Requirements: 11.1-11.13_

- [x] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Unit and integration tests validate specific examples and edge cases
- Database migration should be run before deploying backend changes
- Environment variables must be configured before running the application
- All code should follow existing project conventions and styling
