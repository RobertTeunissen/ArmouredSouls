# Training Academy Cap GUI Fix

## Problem Description

After implementing backend enforcement of Training Academy caps (verified by integration tests), users reported that the GUI was not reflecting these changes properly. Specifically:

1. When upgrading a Training Academy to level 1, the GUI still showed "Attribute Cap: 10"
2. Users could not upgrade attributes beyond level 10 even after upgrading the academy
3. The message "(Upgrade Combat Training Academy to increase)" remained visible

## Root Cause Analysis

The issue was with React component lifecycle and state management:

### Scenario

1. User views Robot Detail page (Component mounts, fetches data)
2. User clicks "Facilities" in navigation (React Router navigates, may keep component in memory)
3. User upgrades Combat Training Academy from level 0 → 1
4. User navigates back to Robot Detail page
5. **Problem**: Component doesn't re-mount, useEffect doesn't re-run, stale data displayed

### Technical Details

**Original useEffect**:
```typescript
useEffect(() => {
  fetchRobotAndWeapons(); // Fetches robot and academy levels
}, [id]); // Only re-runs when robot ID changes
```

**Issues**:
- React Router keeps component instances alive for performance
- Navigating away and back doesn't change the `id` parameter
- useEffect doesn't re-run, so academy levels aren't refreshed
- `visibilitychange` event doesn't fire for in-app navigation (only for tab switches)

## Solution

Implemented a three-layered approach for reliable data refresh:

### 1. Location-Based Refresh (Primary Fix)

```typescript
import { useLocation } from 'react-router-dom';

const location = useLocation();

useEffect(() => {
  fetchRobotAndWeapons();
  // ... event listeners ...
}, [id, location]); // Now also triggers on route changes
```

**How it works**:
- `useLocation()` returns current route location object
- When you navigate back to Robot Detail, `location` changes
- useEffect detects the change and re-runs `fetchRobotAndWeapons()`
- Fresh academy levels are fetched from the API

### 2. Window Focus Refresh (Secondary Reliability)

```typescript
const handleFocus = () => {
  fetchRobotAndWeapons();
};

window.addEventListener('focus', handleFocus);
```

**Benefits**:
- Catches cases where user switches browser tabs/windows
- Provides additional refresh trigger beyond route changes
- Ensures data is fresh when returning to the application

### 3. Manual Refresh Button (User Control)

```tsx
<button
  onClick={() => {
    setLoading(true);
    fetchRobotAndWeapons();
  }}
  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
  title="Refresh robot data and academy levels"
>
  🔄 Refresh
</button>
```

**Purpose**:
- Gives users explicit control to refresh data
- Useful if automatic refresh doesn't trigger for some reason
- Provides visual feedback via loading state

## Changes Made

**File**: `prototype/frontend/src/pages/RobotDetailPage.tsx`

### Imports
```typescript
// Added useLocation import
import { useParams, useNavigate, useLocation } from 'react-router-dom';
```

### State
```typescript
const location = useLocation(); // Track route location changes
```

### Effect Hook
```typescript
useEffect(() => {
  fetchRobotAndWeapons();

  // Existing: Refresh on visibility change (tab switch)
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      fetchRobotAndWeapons();
    }
  };

  // NEW: Refresh on window focus
  const handleFocus = () => {
    fetchRobotAndWeapons();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
  };
}, [id, location]); // NEW: Added location dependency
```

### UI Enhancement
```tsx
{/* NEW: Refresh button in header */}
<div className="flex justify-between items-start">
  <div>
    <button onClick={() => navigate('/robots')}>← Back to Robots</button>
    <h2>{robot.name}</h2>
  </div>
  <button onClick={() => { setLoading(true); fetchRobotAndWeapons(); }}>
    🔄 Refresh
  </button>
</div>
```

## Expected Behavior (After Fix)

### Test Scenario

1. **Initial State**
   - User views robot with combatPower at level 10
   - Combat Training Academy is at level 0
   - GUI shows: "Attribute Cap: 10 (Upgrade Combat Training Academy to increase)"
   - Upgrade button is disabled or shows "Upgrade Academy"

2. **Upgrade Academy**
   - User navigates to Facilities page
   - User upgrades Combat Training Academy to level 1
   - Backend updates academy level in database

3. **Return to Robot**
   - User navigates back to Robot Detail page
   - **NEW**: `location` change triggers useEffect
   - `fetchRobotAndWeapons()` runs automatically
   - Fresh data is fetched, including academy level 1

4. **Updated Display**
   - GUI shows: "Attribute Cap: 15"
   - Message "(Upgrade Combat Training Academy to increase)" is hidden (academyLevel is now 1, not 0)
   - Upgrade button is now enabled with cost
   - User can successfully upgrade combatPower from 10 → 11

## Verification

### Backend Tests (Already Passing)

The integration tests in `tests/trainingAcademyCaps.test.ts` verify:
- ✅ Base cap of 10 without academy
- ✅ Cap increases to 15 with academy level 1
- ✅ All 4 academies control their respective attributes
- ✅ Maximum cap of 50 at academy level 10

### Manual GUI Testing

To verify the fix:

1. **Setup**
   ```bash
   cd prototype/backend && npm run dev
   cd prototype/frontend && npm run dev
   ```

2. **Test Steps**
   - Open http://localhost:3000
   - Login with test account (admin/admin123)
   - Navigate to a robot detail page
   - Note current attribute caps (should show 10 for all categories)
   - Click "Facilities" in navigation
   - Upgrade Combat Training Academy to level 1
   - Navigate back to robot detail page
   - **Verify**: Cap automatically updates to 15
   - **Verify**: Message about upgrading academy disappears
   - **Verify**: Can now upgrade combatPower from 10 to 11

3. **Alternative Verification**
   - If automatic refresh doesn't trigger, click 🔄 Refresh button
   - Should see the same updates

## Technical Benefits

1. **Reliability**: Three independent refresh mechanisms ensure data freshness
2. **Performance**: Only refreshes when actually needed (route changes, focus)
3. **User Control**: Manual refresh button provides explicit control
4. **Maintainability**: Clean, React-idiomatic solution using hooks
5. **Compatibility**: Works with React Router v6 patterns

## Related Files

- Backend: `prototype/backend/src/routes/robots.ts` (cap enforcement logic)
- Backend Tests: `prototype/backend/tests/trainingAcademyCaps.test.ts`
- Frontend: `prototype/frontend/src/pages/RobotDetailPage.tsx` (this fix)
- Documentation: `docs/STABLE_SYSTEM.md` (cap progression table)
