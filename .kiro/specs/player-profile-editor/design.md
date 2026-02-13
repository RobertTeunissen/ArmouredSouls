# Design Document: Player Profile Editor

## Overview

The Player Profile Editor feature enables authenticated users to view and modify their profile information through a dedicated profile page. The system consists of three main layers: a React-based frontend interface, a RESTful API backend, and a PostgreSQL database with Prisma ORM.

The primary focus is stable name management - allowing players to set a unique display name that represents their robot stable throughout the game. Additional functionality includes password changes, display preferences (notifications and theme), and profile visibility controls for leaderboard privacy.

The design follows the existing architectural patterns in the Armoured Souls codebase: JWT-based authentication, Express route handlers with Prisma database access, and React components with TypeScript. All profile updates are authenticated and validated both client-side and server-side.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                          │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ ProfilePage    │  │ Profile API      │  │ AuthContext │ │
│  │ Component      │──│ Client           │──│             │ │
│  └────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/JSON
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Backend Layer                           │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ Auth           │  │ Profile Routes   │  │ Validation  │ │
│  │ Middleware     │──│ (Express)        │──│ Service     │ │
│  └────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Prisma ORM
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL Database                        │ │
│  │  - users table (with new fields)                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Profile View**: User navigates to /profile → Frontend fetches profile data via GET /api/user/profile → Backend queries database → Returns profile data → Frontend displays in form
2. **Profile Update**: User edits fields and clicks save → Frontend validates input → Sends PUT /api/user/profile with changes → Backend validates and updates database → Returns updated profile → Frontend displays success message
3. **Password Change**: User enters current and new password → Frontend validates format → Sends PUT /api/user/profile with password fields → Backend verifies current password with bcrypt → Hashes new password → Updates database → Returns success

### Security Model

- All profile endpoints require JWT authentication via Bearer token
- Passwords are hashed using bcrypt with salt rounds = 10
- Current password verification required for password changes
- Input validation on both frontend (immediate feedback) and backend (security)
- SQL injection prevention via Prisma parameterized queries
- Rate limiting should be applied to prevent brute force attacks (future enhancement)

## Components and Interfaces

### Database Schema Changes

Add new fields to the User model in `schema.prisma`:

```prisma
model User {
  // ... existing fields ...
  
  // NEW FIELDS
  stableName            String?  @unique @map("stable_name") @db.VarChar(30)
  profileVisibility     String   @default("public") @map("profile_visibility") @db.VarChar(10) // "public" or "private"
  notificationsBattle   Boolean  @default(true) @map("notifications_battle")
  notificationsLeague   Boolean  @default(true) @map("notifications_league")
  themePreference       String   @default("dark") @map("theme_preference") @db.VarChar(20) // "dark", "light", "auto"
  
  // ... existing relations ...
}
```

**Migration Strategy**: Create a Prisma migration to add these fields. Existing users will have `stableName = null` (displays username as fallback), default visibility = public, notifications enabled, dark theme.

### Backend API Endpoints

#### GET /api/user/profile

**Purpose**: Retrieve current user's profile information

**Authentication**: Required (JWT Bearer token)

**Request**: No body

**Response** (200 OK):
```typescript
{
  id: number;
  username: string;
  role: string;
  currency: number;
  prestige: number;
  totalBattles: number;
  totalWins: number;
  highestELO: number;
  championshipTitles: number;
  createdAt: string; // ISO 8601
  stableName: string | null;
  profileVisibility: "public" | "private";
  notificationsBattle: boolean;
  notificationsLeague: boolean;
  themePreference: "dark" | "light" | "auto";
}
```

**Error Responses**:
- 401: Missing or invalid authentication token
- 404: User not found (should not happen with valid token)
- 500: Database error

#### PUT /api/user/profile

**Purpose**: Update user profile fields

**Authentication**: Required (JWT Bearer token)

**Request Body** (all fields optional):
```typescript
{
  stableName?: string;
  profileVisibility?: "public" | "private";
  notificationsBattle?: boolean;
  notificationsLeague?: boolean;
  themePreference?: "dark" | "light" | "auto";
  currentPassword?: string; // Required if newPassword provided
  newPassword?: string;
}
```

**Validation Rules**:
- `stableName`: 3-30 characters, alphanumeric + spaces/hyphens/underscores, unique, no profanity
- `profileVisibility`: Must be "public" or "private"
- `themePreference`: Must be "dark", "light", or "auto"
- `currentPassword`: Required if `newPassword` is provided
- `newPassword`: Min 8 chars, 1 uppercase, 1 lowercase, 1 number

**Response** (200 OK):
```typescript
{
  id: number;
  username: string;
  // ... all profile fields (same as GET response)
}
```

**Error Responses**:
- 400: Validation error (with field-specific messages)
- 401: Missing/invalid token OR incorrect current password
- 409: Stable name already taken
- 500: Database error

**Example Error Response** (400):
```typescript
{
  error: "Validation failed",
  details: {
    stableName: "Stable name must be between 3 and 30 characters"
  }
}
```

### Backend Route Handler

**File**: `prototype/backend/src/routes/user.ts`

**Implementation Pattern**:
```typescript
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  // 1. Extract userId from JWT token (req.user.userId)
  // 2. Validate request body fields
  // 3. If password change: verify currentPassword, hash newPassword
  // 4. If stableName change: check uniqueness, validate format
  // 5. Update database with Prisma (only provided fields)
  // 6. Return updated profile data
  // 7. Handle errors with appropriate status codes
});
```

### Validation Service

**File**: `prototype/backend/src/utils/validation.ts` (new file)

**Functions**:

```typescript
// Validate stable name format and content
export function validateStableName(name: string): { valid: boolean; error?: string }

// Check if stable name is unique (excluding current user)
export async function isStableNameUnique(name: string, userId: number): Promise<boolean>

// Validate password strength
export function validatePassword(password: string): { valid: boolean; error?: string }

// Simple profanity filter (basic word list)
export function containsProfanity(text: string): boolean
```

**Profanity Filter**: Use a simple array of prohibited words. Check if stable name contains any prohibited words (case-insensitive). This is a basic implementation - production systems would use more sophisticated filtering.

### Frontend Components

#### ProfilePage Component

**File**: `prototype/frontend/src/pages/ProfilePage.tsx`

**State Management**:
```typescript
interface ProfileData {
  username: string;
  role: string;
  currency: number;
  prestige: number;
  totalBattles: number;
  totalWins: number;
  highestELO: number;
  championshipTitles: number;
  createdAt: string;
  stableName: string | null;
  profileVisibility: "public" | "private";
  notificationsBattle: boolean;
  notificationsLeague: boolean;
  themePreference: "dark" | "light" | "auto";
}

const [profile, setProfile] = useState<ProfileData | null>(null);
const [editedProfile, setEditedProfile] = useState<Partial<ProfileData>>({});
const [passwordData, setPasswordData] = useState({ current: "", new: "" });
const [errors, setErrors] = useState<Record<string, string>>({});
const [loading, setLoading] = useState(false);
const [saveSuccess, setSaveSuccess] = useState(false);
```

**Component Structure**:
```
ProfilePage
├── Account Information Section (read-only)
│   ├── Username
│   ├── Role
│   ├── Join Date
│   └── Account ID
├── Stable Identity Section (editable)
│   ├── Stable Name Input
│   └── Display Name Preview
├── Statistics Section (read-only)
│   ├── Currency
│   ├── Prestige
│   ├── Total Battles
│   ├── Total Wins
│   ├── Highest ELO
│   └── Championship Titles
├── Privacy Settings Section (editable)
│   └── Profile Visibility Toggle
├── Display Preferences Section (editable)
│   ├── Battle Notifications Toggle
│   ├── League Notifications Toggle
│   └── Theme Selector
├── Security Section (editable)
│   ├── Current Password Input
│   ├── New Password Input
│   └── Password Requirements Display
└── Action Buttons
    ├── Save Changes Button (enabled when dirty)
    └── Cancel Button (resets form)
```

**Styling**: Follow existing Material-UI patterns from the codebase. Use Card components for sections, TextField for inputs, Switch for toggles, Select for dropdowns.

#### Profile API Client

**File**: `prototype/frontend/src/utils/userApi.ts` (extend existing)

**New Functions**:
```typescript
export interface ProfileData {
  // ... (same as above)
}

export interface ProfileUpdateRequest {
  stableName?: string;
  profileVisibility?: "public" | "private";
  notificationsBattle?: boolean;
  notificationsLeague?: boolean;
  themePreference?: "dark" | "light" | "auto";
  currentPassword?: string;
  newPassword?: string;
}

export const getProfile = async (): Promise<ProfileData> => {
  const response = await axios.get(
    `${API_BASE_URL}/user/profile`,
    getAuthHeaders()
  );
  return response.data;
};

export const updateProfile = async (
  updates: ProfileUpdateRequest
): Promise<ProfileData> => {
  const response = await axios.put(
    `${API_BASE_URL}/user/profile`,
    updates,
    getAuthHeaders()
  );
  return response.data;
};
```

### Frontend Validation

**Real-time Validation**: As user types in stable name or password fields, validate format and display inline errors.

**Validation Functions** (in ProfilePage component):
```typescript
const validateStableNameFormat = (name: string): string | null => {
  if (name.length < 3) return "Stable name must be at least 3 characters";
  if (name.length > 30) return "Stable name must be 30 characters or less";
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
    return "Stable name can only contain letters, numbers, spaces, hyphens, and underscores";
  }
  return null;
};

const validatePasswordFormat = (password: string): string | null => {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  return null;
};
```

### Navigation Integration

**File**: `prototype/frontend/src/components/Navigation.tsx`

**Change**: Enable the /profile link (currently disabled). Update the navigation item:

```typescript
{ path: '/profile', label: 'My Profile' }, // Remove disabled flag
```

**Route**: Add route in `App.tsx`:
```typescript
<Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
```

## Data Models

### User Model (Extended)

```typescript
interface User {
  // Existing fields
  id: number;
  username: string;
  passwordHash: string;
  role: string;
  currency: number;
  prestige: number;
  totalBattles: number;
  totalWins: number;
  highestELO: number;
  championshipTitles: number;
  createdAt: Date;
  updatedAt: Date;
  
  // New fields
  stableName: string | null;
  profileVisibility: "public" | "private";
  notificationsBattle: boolean;
  notificationsLeague: boolean;
  themePreference: "dark" | "light" | "auto";
}
```

### Profile Update Request Model

```typescript
interface ProfileUpdateRequest {
  stableName?: string;
  profileVisibility?: "public" | "private";
  notificationsBattle?: boolean;
  notificationsLeague?: boolean;
  themePreference?: "dark" | "light" | "auto";
  currentPassword?: string;
  newPassword?: string;
}
```

### Validation Error Model

```typescript
interface ValidationError {
  error: string;
  details: Record<string, string>;
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Valid stable names are accepted

*For any* valid stable name (3-30 characters, alphanumeric plus spaces/hyphens/underscores), when submitted through the profile update API, the system should accept it and store it successfully.

**Validates: Requirements 1.2, 1.4, 1.5**

### Property 2: Stable name update round-trip

*For any* valid stable name, when a user updates their stable name and then fetches their profile, the returned stable name should match the submitted value.

**Validates: Requirements 1.3**

### Property 3: Profile API returns all required fields

*For any* authenticated user, when fetching their profile via GET /api/user/profile, the response should contain all required fields: username, role, createdAt, currency, prestige, totalBattles, totalWins, highestELO, championshipTitles, stableName, profileVisibility, notificationsBattle, notificationsLeague, and themePreference.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

### Property 4: Password validation enforces all strength requirements

*For any* password string, the validation service should reject it if it fails any of these requirements: minimum 8 characters, at least one uppercase letter, at least one lowercase letter, at least one number.

**Validates: Requirements 3.3, 3.4, 3.5, 3.6**

### Property 5: Password change round-trip

*For any* valid new password, when a user successfully changes their password with correct current password, they should be able to authenticate with the new password immediately.

**Validates: Requirements 3.8**

### Property 6: Visibility setting round-trip

*For any* valid visibility setting ("public" or "private"), when a user updates their profile visibility and then fetches their profile, the returned visibility should match the submitted value.

**Validates: Requirements 4.5**

### Property 7: Invalid data returns 400 with validation errors

*For any* profile update request containing invalid data (e.g., stable name too short, password too weak), the API should return a 400 status code with a response body containing field-specific validation error messages.

**Validates: Requirements 6.4**

### Property 8: Partial updates preserve unchanged fields

*For any* profile update request that modifies only a subset of editable fields, all fields not included in the request should remain unchanged in the database.

**Validates: Requirements 6.5**

### Property 9: Successful update returns updated profile

*For any* valid profile update request, the API response should contain the complete updated profile data with all modified fields reflecting their new values.

**Validates: Requirements 6.6**

## Error Handling

### Validation Errors (400 Bad Request)

**Stable Name Validation**:
- Length < 3 or > 30: "Stable name must be between 3 and 30 characters"
- Invalid characters: "Stable name can only contain letters, numbers, spaces, hyphens, and underscores"
- Contains profanity: "Stable name contains inappropriate content"

**Password Validation**:
- Length < 8: "Password must be at least 8 characters"
- Missing uppercase: "Password must contain at least one uppercase letter"
- Missing lowercase: "Password must contain at least one lowercase letter"
- Missing number: "Password must contain at least one number"

**Field Validation**:
- Invalid profileVisibility: "Profile visibility must be 'public' or 'private'"
- Invalid themePreference: "Theme must be 'dark', 'light', or 'auto'"

### Authentication Errors (401 Unauthorized)

- Missing token: "Access token required"
- Invalid token: "Invalid or expired token"
- Incorrect current password: "Current password is incorrect"

### Conflict Errors (409 Conflict)

- Duplicate stable name: "This stable name is already taken"

### Server Errors (500 Internal Server Error)

- Database connection failure: "Internal server error"
- Unexpected errors: "Internal server error"

**Error Response Format**:
```typescript
{
  error: string; // Human-readable error message
  details?: Record<string, string>; // Field-specific errors for validation
}
```

### Frontend Error Handling

- Display validation errors inline next to form fields
- Show toast/snackbar for success messages
- Show alert dialog for critical errors (network failures)
- Disable save button while request is in progress
- Clear errors when user corrects invalid input

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and error conditions
- Specific stable name examples (valid and invalid)
- Password change with correct/incorrect current password
- Unauthenticated requests
- Profanity filter with known bad words
- Default values for new users

**Property-Based Tests**: Verify universal properties across all inputs
- Random valid stable names are accepted
- Random invalid stable names are rejected
- Password validation rules hold for all generated passwords
- Partial updates preserve unchanged fields for any combination of updates
- Round-trip properties hold for all valid inputs

### Property-Based Testing Configuration

**Library**: Use `fast-check` for TypeScript/JavaScript property-based testing

**Configuration**: Each property test should run minimum 100 iterations to ensure comprehensive input coverage

**Test Tagging**: Each property test must reference its design document property:
```typescript
// Feature: player-profile-editor, Property 1: Valid stable names are accepted
test('accepts all valid stable names', () => {
  fc.assert(fc.property(validStableNameGenerator(), async (stableName) => {
    // Test implementation
  }), { numRuns: 100 });
});
```

### Backend Testing

**Test Files**:
- `prototype/backend/tests/profileUpdate.test.ts` - Profile update endpoint tests
- `prototype/backend/tests/validation.test.ts` - Validation service tests

**Test Coverage**:
- GET /api/user/profile returns all fields (Property 3)
- PUT /api/user/profile with valid stable name succeeds (Property 1)
- Stable name round-trip (Property 2)
- Password validation rules (Property 4)
- Password change round-trip (Property 5)
- Visibility setting round-trip (Property 6)
- Invalid data returns 400 with errors (Property 7)
- Partial updates preserve fields (Property 8)
- Successful update returns profile (Property 9)
- Duplicate stable name returns 409
- Unauthenticated requests return 401
- Incorrect current password returns 401
- Profanity filter rejects bad words

### Frontend Testing

**Test Files**:
- `prototype/frontend/src/pages/__tests__/ProfilePage.test.tsx` - Component tests
- `prototype/frontend/src/utils/__tests__/userApi.test.ts` - API client tests

**Test Coverage**:
- Profile page renders all sections
- Form validation displays errors
- Save button enabled when form is dirty
- Successful save shows success message
- API errors display error messages
- Unsaved changes prompt confirmation
- Real-time validation as user types

### Integration Testing

**End-to-End Scenarios**:
1. New user sets stable name for first time
2. User changes stable name to new unique value
3. User attempts duplicate stable name (should fail)
4. User changes password successfully
5. User updates multiple fields in one request
6. User updates visibility and verifies leaderboard behavior

### Test Data Generators

**For Property-Based Tests**:
```typescript
// Generate valid stable names
const validStableNameGenerator = () => 
  fc.string({ minLength: 3, maxLength: 30 })
    .filter(s => /^[a-zA-Z0-9 _-]+$/.test(s));

// Generate invalid stable names (too short)
const tooShortStableNameGenerator = () => 
  fc.string({ maxLength: 2 });

// Generate invalid stable names (invalid chars)
const invalidCharsStableNameGenerator = () => 
  fc.string({ minLength: 3, maxLength: 30 })
    .filter(s => /[^a-zA-Z0-9 _-]/.test(s));

// Generate valid passwords
const validPasswordGenerator = () => 
  fc.string({ minLength: 8 })
    .filter(s => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s));

// Generate weak passwords (missing requirements)
const weakPasswordGenerator = () => 
  fc.oneof(
    fc.string({ maxLength: 7 }), // Too short
    fc.string({ minLength: 8 }).filter(s => !/[A-Z]/.test(s)), // No uppercase
    fc.string({ minLength: 8 }).filter(s => !/[a-z]/.test(s)), // No lowercase
    fc.string({ minLength: 8 }).filter(s => !/[0-9]/.test(s))  // No number
  );
```

## Implementation Notes

### Database Migration

Create migration file: `prototype/backend/prisma/migrations/YYYYMMDDHHMMSS_add_profile_fields/migration.sql`

```sql
-- Add new profile fields to users table
ALTER TABLE users ADD COLUMN stable_name VARCHAR(30) UNIQUE;
ALTER TABLE users ADD COLUMN profile_visibility VARCHAR(10) NOT NULL DEFAULT 'public';
ALTER TABLE users ADD COLUMN notifications_battle BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN notifications_league BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN theme_preference VARCHAR(20) NOT NULL DEFAULT 'dark';

-- Add check constraint for profile_visibility
ALTER TABLE users ADD CONSTRAINT check_profile_visibility 
  CHECK (profile_visibility IN ('public', 'private'));

-- Add check constraint for theme_preference
ALTER TABLE users ADD CONSTRAINT check_theme_preference 
  CHECK (theme_preference IN ('dark', 'light', 'auto'));
```

### Profanity Filter Implementation

**Basic Word List Approach**:
```typescript
const PROFANITY_LIST = [
  'badword1', 'badword2', // ... etc
];

export function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  return PROFANITY_LIST.some(word => lowerText.includes(word));
}
```

**Note**: This is a basic implementation. Production systems should use more sophisticated filtering libraries like `bad-words` npm package or cloud-based moderation APIs.

### Security Considerations

1. **Rate Limiting**: Add rate limiting to profile update endpoint to prevent abuse (e.g., 10 requests per minute per user)
2. **Password Hashing**: Use bcrypt with salt rounds = 10 (already implemented in auth routes)
3. **SQL Injection**: Prisma ORM provides parameterized queries by default
4. **XSS Prevention**: React escapes strings by default, but sanitize stable names on backend
5. **CSRF Protection**: Consider adding CSRF tokens for state-changing operations (future enhancement)

### Performance Considerations

1. **Database Indexes**: The unique constraint on `stable_name` automatically creates an index
2. **Query Optimization**: Use Prisma's `select` to fetch only needed fields
3. **Caching**: Consider caching profile data in frontend (invalidate on update)
4. **Validation**: Perform client-side validation first to reduce unnecessary API calls

### Future Enhancements

1. **Email Verification**: Require email verification before allowing profile changes
2. **Audit Log**: Track profile changes for security and debugging
3. **Profile Pictures**: Add avatar upload functionality
4. **Social Links**: Allow users to add social media links
5. **Bio/Description**: Add a text field for stable description
6. **Stable Name History**: Track previous stable names to prevent abuse
7. **Advanced Profanity Filter**: Integrate with cloud-based content moderation API
8. **Two-Factor Authentication**: Add 2FA for password changes
