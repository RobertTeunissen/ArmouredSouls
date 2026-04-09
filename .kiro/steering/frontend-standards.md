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
npx vitest --run          # Single run (CI-safe)
npx vitest                # Watch mode (local dev)
npx vitest --run --coverage  # With coverage report
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
