---
inclusion: fileMatch
fileMatchPattern: "**/frontend/**,**/*.tsx,**/*.jsx,**/*.css,**/tailwind.config.*,**/vite.config.*"
---

# Frontend Standards

## Component Size Guidelines

### Maximum File Sizes
- Page components (`src/pages/*.tsx`): 300 lines max
- Layout components (`src/components/Navigation.tsx` etc.): 200 lines max
- Feature components: 300 lines max

### Extraction Pattern

When a page or component exceeds the size limit, extract inline sub-components:

1. Create a feature directory under `src/components/` named after the page (kebab-case, e.g., `practice-arena/`)
2. Move shared interfaces/types to `types.ts` in the feature directory
3. Move each sub-component to its own file with an explicit props interface
4. If the page has complex state/logic, extract a custom hook (e.g., `usePracticeArena.ts`)
5. Create an `index.ts` barrel export for clean imports
6. The page file keeps only page-level state management and sub-component composition

### Existing Feature Directories

```
src/components/
├── practice-arena/    # PracticeArenaPage sub-components + usePracticeArena hook
├── facilities/        # FacilitiesPage sub-components + useFacilities hook
├── weapon-shop/       # WeaponShopPage sub-components + useWeaponShop hook
├── hall-of-records/   # HallOfRecordsPage sub-components
├── battle-detail/     # BattleDetailPage sub-components + useBattlePlaybackData hook
├── nav/               # Navigation sub-components (NavLink, DropdownMenu, MobileTab, MobileDrawer)
├── dashboard/         # Overview_Row tiles (PrestigeTile, TodaysBattlesTile, CreditsTile, OverviewRow) + the shared DashboardTile
```

## Component Architecture

### Component Structure

**File Organization**:
```
components/
├── common/           # Reusable UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Modal.tsx
├── features/         # Feature-specific components
│   ├── battle/
│   ├── robot/
│   └── economy/
└── layout/          # Layout components
    ├── Header.tsx
    ├── Sidebar.tsx
    └── Footer.tsx
```

### Component Types

**Presentational Components**:
- Pure UI components
- Receive data via props
- No business logic
- Highly reusable

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ label, onClick, variant = 'primary', disabled }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {label}
    </button>
  );
}
```

**Container Components**:
- Handle business logic
- Fetch and manage data
- Pass data to presentational components

```typescript
export function RobotListContainer() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchRobots().then(setRobots).finally(() => setLoading(false));
  }, []);
  
  if (loading) return <LoadingSpinner />;
  
  return <RobotList robots={robots} />;
}
```

## State Management

### Local State (useState)

**Use for**:
- Component-specific UI state
- Form inputs
- Toggle states
- Temporary data

```typescript
function RobotCard({ robot }: { robot: Robot }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div>
      <h3 onClick={() => setExpanded(!expanded)}>{robot.name}</h3>
      {expanded && <RobotDetails robot={robot} />}
    </div>
  );
}
```

### Zustand Stores

**Use for**:
- Data shared across 3+ pages (robot roster, stable data)
- Cross-page mutations (e.g., currency changes after purchases)
- Expensive fetches that benefit from caching

Stores live in `src/stores/` and are re-exported from `src/stores/index.ts`. See `.kiro/steering/frontend-state-management.md` for the full decision framework and the 3-criteria rule.

**Store Selector Pattern** (always use selectors — never subscribe to the entire store):
```typescript
// GOOD — only re-renders when `robots` changes
const robots = useRobotStore(state => state.robots);
const fetchRobots = useRobotStore(state => state.fetchRobots);

// BAD — re-renders on ANY state change
const store = useRobotStore();
```

**Component using a Zustand store**:
```typescript
function RobotList() {
  const robots = useRobotStore(state => state.robots);
  const loading = useRobotStore(state => state.loading);
  const fetchRobots = useRobotStore(state => state.fetchRobots);

  useEffect(() => { fetchRobots(); }, [fetchRobots]);

  if (loading) return <LoadingSpinner />;
  return <div>{robots.map(r => <RobotCard key={r.id} robot={r} />)}</div>;
}
```

### Context API

**Use for**:
- Truly global, rarely-changing state
- User authentication (AuthContext)
- Onboarding flow state
- Theme preferences

```typescript
interface AuthContextType {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  
  const login = async (credentials: Credentials) => {
    const user = await api.login(credentials);
    setUser(user);
  };
  
  const logout = () => setUser(null);
  
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### When NOT to Use Context

**Avoid Context for**:
- Frequently changing data (causes re-renders) — use Zustand stores instead
- Data needed by only 2-3 components (use props)
- Performance-critical updates — Zustand selectors provide fine-grained subscriptions

## API Integration

### Typed API Helper

All API calls use the typed `api` helper from `src/utils/api.ts`. This helper:
- Wraps the underlying Axios client with JWT interceptors
- Returns unwrapped, typed response data (no `.data` access needed)
- Normalizes all errors into `ApiError` instances with machine-readable codes

**Standard Pattern** (use this for all new API functions):
```typescript
import { api } from './api';
import { ApiError } from './ApiError';

// GET request - returns typed data directly
export async function getRobots(): Promise<Robot[]> {
  return api.get<Robot[]>('/api/robots');
}

// POST request with body
export async function createRobot(data: CreateRobotDto): Promise<Robot> {
  return api.post<Robot>('/api/robots', data);
}

// PUT request
export async function updateRobot(id: number, data: UpdateRobotDto): Promise<Robot> {
  return api.put<Robot>(`/api/robots/${id}`, data);
}

// DELETE request
export async function deleteRobot(id: number): Promise<void> {
  return api.delete<void>(`/api/robots/${id}`);
}
```

**ApiError Class** (`src/utils/ApiError.ts`):
```typescript
class ApiError extends Error {
  code: string;       // Machine-readable error code (e.g., 'ROBOT_NOT_FOUND')
  statusCode: number; // HTTP status code
  details?: unknown;  // Optional structured data from backend
}
```

**Error Handling in Components**:
```typescript
try {
  const robot = await getRobot(robotId);
  // Handle success
} catch (err) {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'ROBOT_NOT_FOUND':
        showToast('Robot no longer exists');
        break;
      case 'UNAUTHORIZED':
        redirectToLogin();
        break;
      default:
        showToast(err.message);
    }
  }
}
```

### Domain API Modules

API functions are organized by domain in `src/utils/`:
- `robotApi.ts` - Robot CRUD and attributes
- `userApi.ts` - User profile and settings
- `matchmakingApi.ts` - League standings and matchmaking
- `financialApi.ts` - Credits, facilities, investments
- `tournamentApi.ts` - Tournament operations
- `tagTeamApi.ts` - Tag team battles
- `kothApi.ts` - King of the Hill mode
- `onboardingApi.ts` - Tutorial and account reset
- `guideApi.ts` - In-game guides
- `onboardingAnalytics.ts` - Onboarding metrics

Each module keeps its TypeScript interfaces and helper functions (formatters, color mappers) alongside the API functions.

### Custom Hooks for Data Fetching

**useRobots Hook**:
```typescript
function useRobots() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    getRobots()
      .then(setRobots)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  
  return { robots, loading, error };
}
```

## Error Handling

### Error Boundaries

**Global Error Boundary**:
```typescript
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-page">
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### API Error Handling

**Consistent Error Display**:
```typescript
function RobotList() {
  const { robots, loading, error } = useRobots();
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (robots.length === 0) return <EmptyState message="No robots found" />;
  
  return (
    <div>
      {robots.map(robot => <RobotCard key={robot.id} robot={robot} />)}
    </div>
  );
}
```

## Loading States

### Loading Indicators

**Skeleton Screens**:
```typescript
function RobotCardSkeleton() {
  return (
    <div className="robot-card skeleton">
      <div className="skeleton-avatar" />
      <div className="skeleton-text" />
      <div className="skeleton-text short" />
    </div>
  );
}

function RobotList() {
  const { robots, loading } = useRobots();
  
  if (loading) {
    return (
      <div>
        {[...Array(5)].map((_, i) => <RobotCardSkeleton key={i} />)}
      </div>
    );
  }
  
  return <div>{/* actual content */}</div>;
}
```

### Optimistic Updates

**Update UI Before API Response**:
```typescript
function RobotCard({ robot }: { robot: Robot }) {
  const [localRobot, setLocalRobot] = useState(robot);
  
  const handleUpdate = async (updates: Partial<Robot>) => {
    // Optimistic update
    setLocalRobot({ ...localRobot, ...updates });
    
    try {
      const response = await robotService.update(robot.id, updates);
      setLocalRobot(response.data);
    } catch (error) {
      // Revert on error
      setLocalRobot(robot);
      showErrorToast('Update failed');
    }
  };
  
  return <div>{/* render localRobot */}</div>;
}
```

## Form Handling

### Controlled Components

**Form with Validation**:
```typescript
function RobotForm() {
  const [formData, setFormData] = useState({
    name: '',
    armor: 100,
    speed: 50,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (formData.armor < 50 || formData.armor > 200) {
      newErrors.armor = 'Armor must be between 50 and 200';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    try {
      await robotService.create(formData);
      // Success handling
    } catch (error) {
      // Error handling
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <Input
        label="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        error={errors.name}
      />
      {/* More fields */}
      <Button type="submit" label="Create Robot" />
    </form>
  );
}
```

## Responsive Canvas/Container Sizing

### `useContainerSize` Hook

For responsive canvas or container sizing, use the `useContainerSize` hook from `src/hooks/useContainerSize.ts`. This hook uses `ResizeObserver` to track a container element's dimensions and returns clamped width/height values.

```typescript
import { useRef } from 'react';
import { useContainerSize } from '../hooks/useContainerSize';

function MyCanvasComponent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height, devicePixelRatio } = useContainerSize(containerRef, {
    minSize: 300,
    maxSize: 500,
  });

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        width={width * devicePixelRatio}
        height={height * devicePixelRatio}
        style={{ width, height }}
      />
    </div>
  );
}
```

Key behaviors:
- Returns clamped `{ width, height }` maintaining a 1:1 aspect ratio
- Falls back to 500px fixed size if `ResizeObserver` is not supported
- Falls back to `devicePixelRatio = 1` if undefined
- Prefer this over hardcoded pixel constants (e.g., `CANVAS_SIZE = 500`) for any canvas or container that needs to adapt to viewport width

## Responsive Tab Layout Pattern

### Desktop Tabs / Mobile Stacked

For pages with multiple content sections, use the tab layout pattern: desktop tabs (≥1024px) with a mobile stacked fallback (<1024px). The `TabLayout` component in `src/components/battle-detail/TabLayout.tsx` is the reference implementation.

```typescript
// Desktop (≥1024px): render TabLayout
// Mobile (<1024px): render all sections stacked vertically
const isDesktop = useMediaQuery('(min-width: 1024px)');

{isDesktop ? (
  <TabLayout activeTab={activeTab} onTabChange={setActiveTab} hasPlayback={hasPlayback}>
    {{
      overview: <OverviewContent />,
      playback: <PlaybackContent />,
      combatLog: <CombatLogContent />,
    }}
  </TabLayout>
) : (
  <>
    <OverviewContent />
    <PlaybackContent />
    <CombatLogContent />
  </>
)}
```

Guidelines:
- Tab bar uses `bg-surface-elevated` background with `border-primary` active indicator
- Active tab: `text-primary border-b-2 border-primary`; inactive: `text-secondary` with 150ms hover transition
- Respect `prefers-reduced-motion` on tab transitions
- Hide tabs that have no content (e.g., hide "Playback" when no spatial data exists)
- Tab state defaults to the first tab on initial load and persists across data refreshes via component state

## Client-Side Data Derivation Pattern

### Pure Functions for API Response Processing

When the API response contains raw data that needs aggregation or transformation for display, extract the computation into a pure function in `src/utils/`. This keeps components focused on rendering and makes the logic independently testable with unit and property-based tests.

Reference implementation: `computeBattleStatistics` in `src/utils/battleStatistics.ts`.

```typescript
// Pure function — no side effects, no hooks, no API calls
export function computeBattleStatistics(
  events: BattleLogEvent[],
  battleDuration: number,
  battleType?: string,
  tagTeamInfo?: { team1Robots: string[]; team2Robots: string[] },
  robotMaxHP?: Record<string, number>,
): BattleStatistics { /* ... */ }

// Called once when data loads, result passed as props
const statistics = useMemo(
  () => computeBattleStatistics(events, duration, battleType, tagTeamInfo, robotMaxHP),
  [events, duration, battleType, tagTeamInfo, robotMaxHP],
);
```

Guidelines:
- Keep the function pure — accept data in, return derived data out
- Wrap the call in `useMemo` at the page level to avoid recomputation on unrelated re-renders
- Pass the derived result as props to child components rather than having each child recompute
- Write property-based tests (fast-check) for invariants like conservation laws (e.g., sum of parts equals total)
- Handle edge cases explicitly: empty inputs return a safe default (e.g., `hasData: false`), division by zero returns 0 instead of NaN

## Performance Optimization

### Memoization

**useMemo for Expensive Calculations**:
```typescript
function RobotStats({ robots }: { robots: Robot[] }) {
  const stats = useMemo(() => {
    return {
      total: robots.length,
      avgElo: robots.reduce((sum, r) => sum + r.elo, 0) / robots.length,
      topRobot: robots.sort((a, b) => b.elo - a.elo)[0],
    };
  }, [robots]);
  
  return <div>{/* render stats */}</div>;
}
```

**useCallback for Event Handlers**:
```typescript
function RobotList({ robots }: { robots: Robot[] }) {
  const handleRobotClick = useCallback((robotId: number) => {
    navigate(`/robots/${robotId}`);
  }, [navigate]);
  
  return (
    <div>
      {robots.map(robot => (
        <RobotCard
          key={robot.id}
          robot={robot}
          onClick={handleRobotClick}
        />
      ))}
    </div>
  );
}
```

**React.memo for Component Memoization**:
```typescript
const RobotCard = memo(({ robot, onClick }: RobotCardProps) => {
  return (
    <div onClick={() => onClick(robot.id)}>
      <h3>{robot.name}</h3>
      <p>ELO: {robot.elo}</p>
    </div>
  );
});
```

## Routing

### Route Structure

**App Routes**:
```typescript
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="robots" element={<RobotList />} />
          <Route path="robots/:id" element={<RobotDetail />} />
          <Route path="battles" element={<BattleHistory />} />
          <Route path="facilities" element={<Facilities />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Protected Routes

**Auth Guard**:
```typescript
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Usage
<Route
  path="/robots"
  element={
    <ProtectedRoute>
      <RobotList />
    </ProtectedRoute>
  }
/>
```

## Shared Player Shell and Search Palette Composition

Use a shared route layout for authenticated player surfaces that need global navigation or an overlay entry point. The layout owns the shell-level composition; individual pages own only their route content.

### Post-Onboarding Player Route Layout

- Place every authenticated post-onboarding player route beneath one `PlayerShell` route layout.
- Keep `/onboarding`, login/register and front-page routes, `/`, `/admin`, and all admin descendants outside the player shell. The admin portal is a separate application surface and must not inherit player navigation or player overlays.
- Render route loading, error, and not-found states inside the shell so the global header and shell-owned overlays remain available while route content changes.
- Keep destination authorization and page behavior in the destination route; the shell must not add route-specific access or data-fetching rules.

### Single Shell-Level Mount

- `PlayerShell` renders exactly one `Navigation`, exactly one `SearchPalette`, and the route `Outlet`.
- Shell-managed pages must not import or render `Navigation` or `SearchPalette` themselves. `Navigation` may receive callbacks such as `onOpenSearch`, but it must not render the palette.
- Keep palette state and lifecycle in one shell-level hook or controller. Do not create a second palette instance for a page, mobile variant, loading fallback, error boundary, or not-found view.
- Keep the search surface search-only: it may show the query input, recent searches, grouped results, loading/error/empty states, and retry, but it must not become a command menu or duplicate page navigation.

### Header Search Control and Discoverability

- `Navigation` remains the global header: use the existing fixed desktop top navbar and fixed mobile top header rather than introducing a second global header.
- At widths of `1024px` and above, provide a visibly labelled `Search` control in the fixed desktop navbar and show a visible `⌘ K` or `Ctrl K` hint appropriate to the platform.
- From `320px` through `1023px`, provide a visible search icon/button in the fixed mobile top header. Do not hide the control in bottom navigation or a `More` drawer.
- Cmd/Ctrl+K is an accelerator only. The visible Search control must remain sufficient for discovery and must work with pointer, touch, and keyboard activation.
- When the palette is open, state its scope in visible text and expose an accessible name that describes the search surface.

### Responsive Overlay Rules

Use the existing `1024px` desktop/mobile breakpoint consistently:

- Desktop (`>=1024px`): render a bounded overlay while keeping the current page visible behind it.
- Mobile (`320px–1023px`): render a vertically ordered, internally scrollable sheet. Keep the input, close action, states, history, and results in a predictable vertical flow.
- Keep mobile surfaces within the viewport (`max-width: 100%`/`100vw` as appropriate), allow long labels to wrap, and set `min-width: 0` on flex/grid children that contain user or server text. Prevent horizontal page overflow; scrolling on mobile overlays should be vertical and owned by the sheet or result region.
- Use mobile-first styles and extend the existing responsive tab/layout pattern where a surface has multiple sections. Test the boundary at `1023px` and `1024px`, as well as the supported minimum width of `320px`; do not rely on a desktop layout merely shrinking until it happens to fit.

### Focus and Keyboard Interaction

Interactive overlays must implement a complete focus lifecycle:

- Use a semantic dialog (`role="dialog"`, `aria-modal="true"`) with a programmatic accessible name and a visible close control.
- On open, move focus into the dialog, normally to the search input or the first meaningful control. While open, trap `Tab` and `Shift+Tab` within the dialog and keep the focus indicator visible.
- Support `Escape` to dismiss, Arrow-key movement through result items where the result-list pattern supports it, and `Enter` to activate the focused result. Close the palette before navigating to a selected route.
- Restore focus to the Search control that opened the palette when it still exists; if it was removed or disabled, use the nearest stable shell-level fallback without throwing or leaving focus lost.
- Do not use clickable non-interactive elements for controls or results. Use native buttons/links where possible, provide an accessible name for icon-only controls, and ensure state changes are announced through appropriate labels or live-region semantics without exposing implementation errors.

### Accessible Result Lists and Touch Targets

- Render grouped results with semantic list structure and readable category headings. Each result must have a unique, descriptive accessible name and expose only the fields needed for its destination.
- Results must be operable by pointer, keyboard, and assistive technology. Use native links for direct navigation or buttons when selection performs an action; support predictable Tab order and, where Arrow-key navigation is provided, keep the active item and visible focus synchronized.
- Every Search control, close/retry/history control, clear control, pagination control, and result activation region must be at least `44px` by `44px`, including icon-only controls. Keep visible focus styles with sufficient contrast and do not remove the browser outline without an equivalent replacement.
- Keep result labels and category text readable at narrow widths. Wrap text rather than clipping it or forcing the page to scroll horizontally.

## Admin Page Responsive Conventions

Admin pages remain inside the existing admin route/layout boundary and must not be rendered through `PlayerShell`.

- At `>=1024px`, preserve the established admin layout: fixed/desktop sidebar, page title and controls, and multi-column report sections or tables where they improve scanning.
- Below `1024px` and down to `320px`, stack page sections, filters, cards, tables, and pagination vertically in a logical reading order. Keep the admin sidebar/header navigation usable without competing with page content.
- Keep the outer admin page free of horizontal overflow. For data that cannot be meaningfully reflowed, use a clearly bounded, keyboard-accessible internal table scroller or a responsive card representation; never let a wide child expand the viewport.
- Give filters, retry actions, pagination, sidebar controls, and other interactive admin controls a minimum `44px` by `44px` activation region and visible focus. Preserve labels and status/error text when controls wrap.
- Reuse `AdminLayout` title/sidebar, lazy-page outlet, loading fallback, and content error-boundary conventions. Do not create a second admin shell or duplicate navigation for a responsive variant.

## Styling Best Practices

### Tailwind CSS Usage

**Component Styling**:
```typescript
function Button({ variant = 'primary', children }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
  
  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  );
}
```

### Responsive Design

**Mobile-First Approach**:
```typescript
<div className="
  grid
  grid-cols-1
  md:grid-cols-2
  lg:grid-cols-3
  gap-4
">
  {robots.map(robot => <RobotCard key={robot.id} robot={robot} />)}
</div>
```

## Accessibility

### Semantic HTML

**Use Proper Elements**:
```typescript
// Good
<button onClick={handleClick}>Click me</button>

// Bad
<div onClick={handleClick}>Click me</div>
```

### ARIA Labels

**Screen Reader Support**:
```typescript
<button
  aria-label="Delete robot"
  onClick={handleDelete}
>
  <TrashIcon />
</button>

<input
  type="text"
  aria-label="Search robots"
  placeholder="Search..."
/>
```

### Keyboard Navigation

**Focus Management**:
```typescript
function Modal({ isOpen, onClose }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);
  
  return (
    <div role="dialog" aria-modal="true">
      <button ref={closeButtonRef} onClick={onClose}>
        Close
      </button>
      {/* Modal content */}
    </div>
  );
}
```

## Testing

### Test File Location
Place test files in a `__tests__/` subdirectory next to the source files being tested — not co-located in the same directory.

### Naming Conventions
- `*.test.ts` — unit tests for utilities and stores
- `*.test.tsx` — unit tests for React components
- `*.pbt.test.ts(x)` — property-based tests (fast-check)

### Minimum Coverage
- **Utilities and stores**: 80% code coverage
- **Components**: Baseline coverage (at least one test file per extracted directory)

### Component Tests
- Render with RTL's `render()`, query with `screen`
- Mock API calls and external dependencies with `vi.mock()`
- Test user interactions via `userEvent` (clicks, typing, toggles)
- Verify rendered output, not implementation details

### Store Tests
- Reset state in `beforeEach`: `useStore.setState(useStore.getInitialState())`
- Test actions by calling them and asserting resulting state
- Test selectors by setting state and verifying selector output

### Running Tests
```bash
cd app/frontend
pnpm exec vitest --run          # Single run (CI-safe)
pnpm exec vitest                # Watch mode (local dev)
pnpm exec vitest --run --coverage  # With coverage report
```

## Checklist

### Before Committing
- [ ] Components follow single responsibility principle
- [ ] Props have TypeScript interfaces
- [ ] Error states handled
- [ ] Loading states implemented
- [ ] No console.log statements
- [ ] Accessibility attributes added
- [ ] Responsive design tested

### Performance
- [ ] Expensive calculations memoized
- [ ] Event handlers use useCallback
- [ ] Large lists virtualized if needed
- [ ] Images optimized and lazy loaded
- [ ] Bundle size within limits
