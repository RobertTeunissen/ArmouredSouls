---
inclusion: always
---

# Frontend Standards

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

### Context API

**Use for**:
- Global application state
- User authentication
- Theme preferences
- Shared data across many components

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
- Frequently changing data (causes re-renders)
- Data needed by only 2-3 components (use props)
- Performance-critical updates

## API Integration

### API Service Layer

**Centralized API Client**:
```typescript
// services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
});

// Request interceptor (add auth token)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor (handle errors)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

**API Methods**:
```typescript
// services/robotService.ts
import api from './api';

export const robotService = {
  getAll: () => api.get<Robot[]>('/robots'),
  getById: (id: number) => api.get<Robot>(`/robots/${id}`),
  create: (data: CreateRobotDto) => api.post<Robot>('/robots', data),
  update: (id: number, data: UpdateRobotDto) => api.put<Robot>(`/robots/${id}`, data),
  delete: (id: number) => api.delete(`/robots/${id}`),
};
```

### Custom Hooks for Data Fetching

**useRobots Hook**:
```typescript
function useRobots() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    robotService.getAll()
      .then(response => setRobots(response.data))
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
