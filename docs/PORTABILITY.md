# Armoured Souls - Portability Strategy

**Last Updated**: January 24, 2026

## Overview

Armoured Souls is designed from the ground up to be portable across web, iOS, and Android platforms. This document outlines our strategy for achieving true cross-platform compatibility while maintaining code quality and performance.

---

## Portability Goals

1. **Maximum Code Reuse**: Share as much code as possible across platforms
2. **Native Performance**: Deliver native-like performance on all platforms
3. **Consistent UX**: Unified experience with platform-specific adaptations
4. **Single Codebase**: Minimize platform-specific code
5. **Easy Maintenance**: Changes propagate across all platforms

---

## Platform Strategy

### Phase 1: Web (MVP)
**Priority**: High (Launch platform)  
**Timeline**: Months 1-6

**Technology Stack**:
- **Framework**: React 18+ with TypeScript
- **State Management**: Redux Toolkit or Zustand
- **Styling**: Tailwind CSS or Material-UI
- **Build Tool**: Vite or Create React App
- **PWA**: Progressive Web App capabilities

**Advantages**:
- Fastest to market
- Easy deployment and updates
- No app store approval process
- Widest accessibility (any browser)
- Lower development cost

**Platform-Specific Features**:
- Service Workers for offline support
- Web Push notifications
- LocalStorage for client-side data
- Responsive design for desktop/tablet/mobile web

---

### Phase 2: Mobile (iOS & Android)
**Priority**: Medium (Post-MVP)  
**Timeline**: Months 7-12

---

## Mobile Development Approaches

### Option 1: React Native (Recommended)

**Advantages** ✅:
- Share code with web (React components, business logic)
- Single JavaScript/TypeScript codebase
- Hot reload for fast development
- Large ecosystem and community
- Native performance with native modules
- Expo for rapid development

**Disadvantages** ⚠️:
- Some performance overhead vs native
- May need native modules for complex features
- Bridge communication can be bottleneck
- Larger app size

**Code Sharing Potential**: 70-80% code reuse from web

**Architecture**:
```
shared/
  ├── api/          # API client (100% shared)
  ├── state/        # Redux store (100% shared)
  ├── models/       # Data models (100% shared)
  ├── utils/        # Utilities (100% shared)
  └── business/     # Business logic (100% shared)

web/
  ├── components/   # Web-specific UI
  └── pages/        # Web-specific pages

mobile/
  ├── components/   # Mobile-specific UI
  ├── screens/      # Mobile-specific screens
  └── native/       # Platform-specific native code
```

---

### Option 2: Flutter

**Advantages** ✅:
- Excellent performance
- Beautiful UI out of the box
- Single codebase for iOS and Android
- Hot reload
- Growing ecosystem

**Disadvantages** ⚠️:
- Dart language (different from web)
- Less code sharing with web
- Smaller community than React Native
- Requires separate web implementation

**Code Sharing Potential**: 0-20% from web (different language)

---

### Option 3: Native Development (Swift + Kotlin)

**Advantages** ✅:
- Best performance
- Full platform API access
- Native look and feel
- Platform-specific optimizations

**Disadvantages** ⚠️:
- Two separate codebases
- Longer development time
- Higher maintenance cost
- No code sharing with web

**Code Sharing Potential**: 0% (completely separate)

---

### Recommendation: React Native

**Rationale**:
1. **Maximum Code Reuse**: Share React components structure, state management, API clients
2. **Faster Development**: Leverage existing React knowledge from web
3. **Cost Effective**: One team can work on both web and mobile
4. **Proven Track Record**: Used by Facebook, Instagram, Discord, etc.
5. **Future Flexibility**: Can add native modules if needed

---

## Shared Architecture Components

### 1. API Client (100% Shared)
```typescript
// shared/api/client.ts
class ApiClient {
  baseUrl: string;
  token?: string;
  
  async get(endpoint: string) { }
  async post(endpoint: string, data: any) { }
  // ... other methods
}
```

**Platform Adaptations**:
- Web: Axios or Fetch
- Mobile: Axios (works with React Native)

---

### 2. State Management (100% Shared)
```typescript
// shared/state/store.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import robotReducer from './slices/robotSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    robots: robotReducer,
    // ... other reducers
  },
});
```

**Works identically** on web and React Native.

---

### 3. Business Logic (100% Shared)
```typescript
// shared/business/robot.logic.ts
export class RobotLogic {
  static calculateDamage(attacker: Robot, defender: Robot): number {
    // Complex damage calculation
  }
  
  static canUpgrade(robot: Robot, player: Player): boolean {
    // Upgrade eligibility logic
  }
}
```

**Platform-agnostic** pure functions.

---

### 4. Data Models (100% Shared)
```typescript
// shared/models/Robot.ts
export interface Robot {
  id: string;
  name: string;
  level: number;
  health: number;
  attack: number;
  defense: number;
  components: Component[];
}
```

**Type definitions** shared across all platforms.

---

### 5. Utilities (100% Shared)
```typescript
// shared/utils/validation.ts
export const validateEmail = (email: string): boolean => {
  // Email validation logic
};
```

**Pure utility functions** work everywhere.

---

## Platform-Specific Implementations

### Navigation

**Web**: React Router
```typescript
// web/routes.tsx
import { BrowserRouter, Route } from 'react-router-dom';
```

**Mobile**: React Navigation
```typescript
// mobile/navigation.tsx
import { NavigationContainer } from '@react-navigation/native';
```

---

### Storage

**Web**: LocalStorage / IndexedDB
```typescript
// web/storage/localStorage.ts
export const saveToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};
```

**Mobile**: AsyncStorage / MMKV
```typescript
// mobile/storage/asyncStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveToken = async (token: string) => {
  await AsyncStorage.setItem('auth_token', token);
};
```

**Abstraction Layer**:
```typescript
// shared/storage/index.ts
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Inject platform-specific implementation
```

---

### Notifications

**Web**: Web Push API
```typescript
// web/notifications/push.ts
navigator.serviceWorker.ready.then(registration => {
  registration.pushManager.subscribe({ ... });
});
```

**Mobile**: Firebase Cloud Messaging
```typescript
// mobile/notifications/fcm.ts
import messaging from '@react-native-firebase/messaging';

messaging().onMessage(async remoteMessage => {
  // Handle notification
});
```

---

### Authentication

**Web**: OAuth redirects
```typescript
// web/auth/oauth.ts
window.location.href = `${authUrl}?redirect_uri=${window.location.origin}`;
```

**Mobile**: Deep links / App-to-app
```typescript
// mobile/auth/oauth.ts
import InAppBrowser from 'react-native-inappbrowser-reborn';

await InAppBrowser.openAuth(authUrl, redirectUrl);
```

---

## UI Component Strategy

### Approach 1: Conditional Rendering
```typescript
import { Platform } from 'react-native';

const Button = ({ title, onPress }) => {
  if (Platform.OS === 'web') {
    return <button onClick={onPress}>{title}</button>;
  }
  return <TouchableOpacity onPress={onPress}>
    <Text>{title}</Text>
  </TouchableOpacity>;
};
```

### Approach 2: Platform-Specific Files
```
Button/
  ├── Button.tsx          # Shared logic
  ├── Button.web.tsx      # Web-specific UI
  ├── Button.ios.tsx      # iOS-specific UI
  └── Button.android.tsx  # Android-specific UI
```

### Approach 3: Shared Component Library
Build platform-agnostic components that work everywhere:
```typescript
// shared/components/Button.tsx
import { TouchableOpacity, Text } from 'react-native';

// Works on web with react-native-web
const Button = ({ title, onPress }) => (
  <TouchableOpacity onPress={onPress}>
    <Text>{title}</Text>
  </TouchableOpacity>
);
```

---

## Build & Deployment Strategy

### Web Deployment
- **Build**: `npm run build:web`
- **Output**: Static files (HTML, CSS, JS)
- **Hosting**: Netlify, Vercel, AWS S3 + CloudFront
- **CI/CD**: GitHub Actions → Build → Deploy
- **Rollback**: Instant (switch version)

### iOS Deployment
- **Build**: `npm run build:ios`
- **Output**: `.ipa` file
- **Distribution**: App Store (TestFlight for beta)
- **CI/CD**: GitHub Actions → Build → Submit to App Store
- **Review Time**: 1-3 days
- **Updates**: User must update app

### Android Deployment
- **Build**: `npm run build:android`
- **Output**: `.aab` or `.apk` file
- **Distribution**: Google Play Store
- **CI/CD**: GitHub Actions → Build → Submit to Play Store
- **Review Time**: Hours to 1 day
- **Updates**: User must update app (or auto-update)

---

## Testing Strategy for Portability

### Shared Code Tests (100% coverage)
- Unit tests run on all platforms
- Business logic tests
- API client tests

### Platform-Specific Tests
- **Web**: Playwright/Cypress E2E tests
- **iOS**: XCUITest
- **Android**: Espresso
- **Cross-platform**: Detox (React Native)

### Visual Regression Tests
- Percy or Chromatic for web
- Applitools for mobile

---

## Performance Considerations

### Web Performance
- Code splitting
- Lazy loading
- Service worker caching
- CDN for assets
- Lighthouse score >90

### Mobile Performance
- Optimize bundle size
- Native modules for heavy operations
- Lazy loading screens
- Image optimization
- Memory management

### Shared Performance
- Optimize API calls
- Implement pagination
- Efficient state management
- Debounce/throttle user inputs

---

## Offline Support

### Web
- Service Worker
- IndexedDB for offline data
- Background sync

### Mobile
- AsyncStorage for critical data
- Queue failed requests
- Sync when connection restored

### Conflict Resolution
- Last-write-wins
- Operational transforms
- Manual conflict resolution UI

---

## Platform-Specific Features

### Features to Consider

**iOS Exclusive**:
- iCloud integration
- Apple Watch companion app
- Siri shortcuts
- Haptic feedback

**Android Exclusive**:
- Widgets
- Google Assistant integration
- Advanced notifications
- Split screen multitasking

**Web Exclusive**:
- No installation required
- SEO optimization
- URL-based sharing
- Keyboard shortcuts

---

## Accessibility

### Cross-Platform Standards
- WCAG 2.1 Level AA compliance
- Screen reader support
- Keyboard navigation (web)
- VoiceOver/TalkBack (mobile)
- Color contrast requirements
- Font scaling

---

## Internationalization (i18n)

### Shared Translation System
```typescript
// shared/i18n/translations.ts
export const translations = {
  en: {
    common: {
      welcome: "Welcome to Armoured Souls",
      // ...
    }
  },
  es: { /* Spanish */ },
  // ... other languages
};
```

### Platform Libraries
- **Web**: react-i18next
- **Mobile**: react-i18next (works with React Native)

---

## Monorepo Structure

```
armoured-souls/
├── packages/
│   ├── shared/           # Shared code (70-80%)
│   │   ├── api/
│   │   ├── state/
│   │   ├── models/
│   │   ├── business/
│   │   └── utils/
│   ├── web/              # Web-specific (20-30%)
│   │   ├── components/
│   │   ├── pages/
│   │   └── public/
│   └── mobile/           # Mobile-specific (20-30%)
│       ├── components/
│       ├── screens/
│       ├── ios/
│       └── android/
├── package.json
└── lerna.json / nx.json
```

**Monorepo Tools**:
- **Lerna**: Traditional monorepo management
- **Nx**: Modern monorepo with build caching
- **Yarn Workspaces**: Dependency management

---

## Migration Path

### Phase 1: Web Development (Months 1-6)
- Build web app with portability in mind
- Structure code for sharing
- Use React + TypeScript
- Implement responsive design

### Phase 2: Mobile Preparation (Month 6)
- Refactor web code to shared package
- Extract platform-specific code
- Set up monorepo structure
- Create abstraction layers

### Phase 3: Mobile Development (Months 7-9)
- Initialize React Native app
- Integrate shared packages
- Build mobile-specific UI
- Implement native features

### Phase 4: Mobile Testing (Month 10)
- Beta testing on TestFlight / Play Console
- Performance optimization
- Bug fixes
- User feedback integration

### Phase 5: Mobile Launch (Months 11-12)
- App Store submission
- Marketing and launch
- Post-launch monitoring
- Continuous improvement

---

## Risk Mitigation

### Technical Risks
- **React Native limitations**: Have escape hatch to native code
- **Performance issues**: Profile early and optimize
- **Platform-specific bugs**: Comprehensive testing on real devices

### Business Risks
- **App Store rejection**: Follow guidelines strictly
- **User adoption**: Strong web presence first
- **Maintenance burden**: Automate where possible

---

## Success Metrics

### Code Sharing
- **Target**: >70% code reuse
- **Measure**: Lines of code analysis

### Performance
- **Web**: Lighthouse score >90
- **Mobile**: Smooth 60 FPS
- **API**: <200ms response time

### User Experience
- **Cross-platform**: Consistent core experience
- **Platform-native**: Feels native on each platform
- **Rating**: >4.5 stars on app stores

---

## Conclusion

By starting with a web app and using React + TypeScript, we position ourselves perfectly for React Native mobile development. This approach maximizes code reuse, reduces development time, and ensures a consistent experience across all platforms while maintaining the flexibility to optimize for each platform's strengths.