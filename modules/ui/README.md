# UI Module

## Overview

This module contains all user interface components and client-side logic for Armoured Souls.

## Status

🚧 **Planning Phase** - No implementation yet

## Responsibilities

- Component library development
- State management (client-side)
- Client-side routing
- API client integration
- Asset management
- Responsive design
- Accessibility compliance

## Technologies (Proposed)

### Web Platform
- **Framework**: React 18+ with TypeScript
- **State Management**: Redux Toolkit or Zustand
- **Styling**: Tailwind CSS or Material-UI
- **Build Tool**: Vite
- **Routing**: React Router

### Mobile Platform (Future)
- **Cross-platform**: React Native (recommended for code sharing)
- **Alternative**: Flutter or Native (Swift/Kotlin)

See [PORTABILITY.md](../../docs/PORTABILITY.md) for detailed mobile strategy.

## Structure

```
ui/
├── web/                # Web application
│   ├── components/     # React components
│   │   ├── common/     # Shared components
│   │   ├── robot/      # Robot-specific UI
│   │   ├── battle/     # Battle UI
│   │   └── auth/       # Authentication UI
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── store/          # Redux store
│   ├── services/       # API services
│   └── assets/         # Images, fonts, etc.
├── mobile/             # Mobile app (future)
│   ├── screens/
│   └── components/
└── shared/             # Shared code
    ├── types/          # TypeScript types
    ├── utils/          # Utilities
    └── constants/      # Constants
```

## Design Principles

### Component Design
- Small, focused components
- Reusable and composable
- Props for customization
- Typescript for type safety

### State Management
- Global state for shared data (user, settings)
- Local state for component-specific data
- Async state for API calls

### Performance
- Code splitting and lazy loading
- Memoization for expensive computations
- Virtual scrolling for long lists
- Image optimization

## Accessibility (a11y)

- WCAG 2.1 Level AA compliance
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation
- Screen reader support
- Color contrast compliance

## Responsive Design

- Mobile-first approach
- Breakpoints: mobile (< 640px), tablet (640-1024px), desktop (> 1024px)
- Touch-friendly on mobile
- Optimized layouts for each size

## UI Components (Planned)

### Common Components
- Button, Input, Select, Checkbox, Radio
- Modal, Dialog, Tooltip
- Card, Panel, Accordion
- Table, List, Grid
- Tabs, Pagination
- Loading indicators
- Error boundaries

### Game-Specific Components
- RobotCard - Display robot stats and image
- BattleArena - Battle visualization
- StableManager - Manage robot collection
- StatBar - Health/energy bars
- UpgradeTree - Skill/upgrade visualization

## API Integration

```typescript
// Example API service
class RobotService {
  async getRobots(): Promise<Robot[]> {
    return apiClient.get('/api/v1/robots');
  }
  
  async createRobot(data: CreateRobotDto): Promise<Robot> {
    return apiClient.post('/api/v1/robots', data);
  }
}
```

## Testing Strategy

- **Unit Tests**: Component logic (Jest/Vitest)
- **Component Tests**: React Testing Library
- **E2E Tests**: Playwright or Cypress
- **Visual Tests**: Chromatic or Percy

## Dependencies

- API module (backend communication)
- None for UI logic (self-contained)

## Documentation

- Component Storybook (future)
- Style guide
- Design system documentation

## Future Development

UI development will begin after:
1. Technology stack is finalized
2. Design mockups are created
3. API contracts are defined