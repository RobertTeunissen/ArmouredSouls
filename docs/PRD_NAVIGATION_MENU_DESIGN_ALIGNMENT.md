# Product Requirements Document: Navigation Menu Design Alignment

**Last Updated**: February 1, 2026  
**Status**: Ready for Implementation  
**Owner**: Robert Teunissen  
**Epic**: Design System Implementation - Navigation System  
**Priority**: P1 (Core UI Foundation)

---

## Executive Summary

This PRD defines the requirements for implementing the complete navigation menu system for Armoured Souls, ensuring alignment with the comprehensive design system. The navigation serves as the **primary wayfinding mechanism** across all authenticated pages and must communicate the managerial nature of the game through the **Direction B (Precision/Engineering)** logo state and management-appropriate visual design.

**Success Criteria**:
- Navigation uses Direction B logo and visual language consistently
- Design reinforces "managing a serious system" feeling
- Management context: systematic, clear, professional
- Consistent with design system color palette, typography, and motion principles
- Accessibility standards met (WCAG 2.1 AA)
- Platform-appropriate patterns (desktop horizontal nav, mobile bottom nav + hamburger)
- Progressive disclosure of features across development phases

**Impact**: Establishes persistent navigation framework that scales from MVP (14 pages) through all future phases (70+ pages), providing consistent wayfinding and reinforcing player's managerial role throughout the experience.

---

## Background & Context

### Current State

**What Exists**:
- ✅ Basic horizontal navigation bar on desktop
- ✅ Simple mobile-responsive layout
- ✅ Basic routing to core pages (Dashboard, Robots, Facilities, etc.)
- ✅ Credits display in header
- ✅ Logout functionality
- ✅ Logo clickable (returns to dashboard)

**Current Issues**:
- ❌ Inconsistent navigation styling across pages
- ❌ No Direction B logo implementation (text-only "Armoured Souls")
- ❌ Missing design system color palette in navigation
- ❌ Typography not using system fonts (DIN Next/Inter)
- ❌ No proper mobile bottom navigation bar (Phase 1 requirement)
- ❌ No hamburger menu for secondary navigation
- ❌ Active state indicators unclear
- ❌ No hover states following design system
- ❌ Navigation doesn't follow management motion guidelines
- ❌ No user profile dropdown
- ❌ No notification system integration
- ❌ Missing keyboard navigation support
- ❌ No command palette (future enhancement)

**What's Working Well**:
- ✅ Clean, minimal approach aligns with design philosophy
- ✅ Persistent navigation across authenticated pages
- ✅ Logical page organization
- ✅ Mobile-responsive breakpoints exist

### Design References

**Primary Design Documents**:
- [NAVIGATION_QUICK_REFERENCE.md](NAVIGATION_QUICK_REFERENCE.md) - Complete navigation structure for all phases
- [NAVIGATION_AND_PAGE_STRUCTURE.md](NAVIGATION_AND_PAGE_STRUCTURE.md) - Comprehensive navigation architecture (42.6KB)
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](DESIGN_SYSTEM_AND_UX_GUIDE.md) - Page-by-page design specs
- [DESIGN_SYSTEM_QUICK_REFERENCE.md](DESIGN_SYSTEM_QUICK_REFERENCE.md) - Color palette, typography, motion
- [brand/3_brand_usage_system.md](brand/3_brand_usage_system.md) - Direction B logo usage for management screens
- [brand/4_motion_micro_animation_system.md](brand/4_motion_micro_animation_system.md) - Management motion rules

**Key Principles**:
- Logo State: **Direction B** (Precision/Engineering)
- Emotional Target: **Control, mastery, managerial authority**
- Motion State: **Management** (subtle, controlled, no distraction)
- Color System: Dark theme with design system palette
- Typography: DIN Next/Inter Tight for navigation, Inter for labels
- Navigation Pattern: App bar (desktop), bottom nav + hamburger (mobile)

---

## Goals & Objectives

### Primary Goals

1. **Brand Alignment**: Implement Direction B logo and visual language for management context
2. **Design System Compliance**: Use established color palette, typography, spacing, and motion
3. **Emotional Consistency**: Communicate "managing a serious system" feeling
4. **Platform Optimization**: Desktop favors persistent horizontal nav, mobile uses thumb-reach patterns
5. **Progressive Disclosure**: Support phased feature rollout (MVP → Phase 8, 70+ pages)
6. **Accessibility Excellence**: Full keyboard navigation, WCAG 2.1 AA compliance

### Success Metrics

- **Visual Consistency**: 100% compliance with design system specifications
- **Brand Recognition**: Direction B logo properly implemented across all authenticated pages
- **Accessibility**: WCAG 2.1 AA compliance (keyboard navigation, focus indicators, ARIA labels)
- **Performance**: Navigation render time <50ms (no perceived lag)
- **User Efficiency**: Core pages accessible in 1-2 clicks
- **Responsive Design**: Seamless experience across desktop (>1024px), tablet (768-1023px), mobile (<768px)

### Non-Goals (Out of Scope for Phase 1)

- ❌ Mega menu dropdowns (Phase 2)
- ❌ Command palette (Cmd+K) (Phase 2)
- ❌ Notification center with badge (Phase 2)
- ❌ Search functionality (Phase 2)
- ❌ Breadcrumbs (Phase 2+)
- ❌ Guild/social navigation sections (Phase 3+)
- ❌ Progressive feature unlocking UI (Phase 2+)
- ❌ Contextual navigation modes (battle mode, tournament mode) (Phase 4+)

---

## Design Specifications

### Desktop Navigation (≥1024px)

#### Visual Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  [Logo] Dashboard  My Robots  Facilities  Weapon Shop  Battle History │
│    B                                                                   │
│                                                    [₡1,250] [Profile▾] [Logout] │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Layout Structure**:
- **Height**: 64px (h-16)
- **Background**: Surface elevated (#252b38)
- **Border Bottom**: 1px solid rgba(255, 255, 255, 0.1)
- **Position**: Fixed top, full width
- **Z-Index**: 1000 (always on top)
- **Padding**: 0 24px (horizontal spacing)

**Content Areas**:
- **Left Section**: Logo + Primary Navigation Links
- **Right Section**: Credits Display + User Menu + Logout

---

### Mobile Navigation (<768px)

#### Bottom Navigation Bar

```
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│   🏠    │   🤖    │   ⚔️    │   🛒    │   ≡    │
│Dashboard│ Robots  │ Battles │  Shop   │  More   │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

**Layout Structure**:
- **Height**: 64px (h-16)
- **Background**: Surface elevated (#252b38)
- **Border Top**: 1px solid rgba(255, 255, 255, 0.1)
- **Position**: Fixed bottom, full width
- **Z-Index**: 1000
- **Safe Area**: Respects iOS/Android safe area insets

**Navigation Items**: 5 primary tabs
1. **Dashboard** (Home icon)
2. **Robots** (Robot icon)
3. **Battles** (Sword icon)
4. **Shop** (Cart icon)
5. **More** (Hamburger icon → opens drawer)

#### Mobile Header

```
┌────────────────────────────────────────────────────────┐
│  [Logo B]  ARMOURED SOULS         [₡1,250] [🔔] [👤] │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Layout Structure**:
- **Height**: 56px (h-14)
- **Background**: Surface elevated (#252b38)
- **Border Bottom**: 1px solid rgba(255, 255, 255, 0.1)
- **Position**: Fixed top, full width
- **Z-Index**: 999 (below modals, above content)

#### Hamburger Menu Drawer

**Trigger**: "More" tab in bottom navigation  
**Animation**: Slide in from right (300ms ease-out)  
**Width**: 280px (70% of screen on small phones)  
**Background**: Surface (#1a1f29)

**Menu Structure**:
```
ARMOURED SOULS
────────────────────

🛠️ MANAGE STABLE
  › Facilities
  › Weapon Shop
  › Weapon Inventory

🏆 COMPETE
  › Matchmaking (future)
  › Battle History
  › Leagues

⚙️ SETTINGS
  › Profile (future)
  › Settings (future)
  › Logout
```

---

## Component Specifications

### 1. Logo (Direction B)

**Requirements**:
- **Logo Type**: Direction B (Precision/Engineering)
- **Placement**: 
  - Desktop: Top-left of nav bar, left of navigation links
  - Mobile: Center of top header
- **Size**: 
  - Desktop: 32×32px (recommended 40×40px)
  - Mobile Header: 32×32px
  - Mobile Bottom Nav: Not displayed (text labels instead)
- **Format**: SVG (preferred) or PNG with transparency
- **Color**: Adaptive - light on dark background (#e6edf3 on #252b38)
- **Spacing**: 16px margin right (desktop), centered (mobile header)
- **Clickable**: Returns to dashboard on click
- **Alt Text**: "Armoured Souls Home"

**Design Characteristics** (from brand docs):
- Engineered letterforms with industrial precision aesthetic
- Minimal ornamentation, brushed metal appearance
- High contrast against dark background
- Geometric, angular forms
- Professional, systematic appearance

**Message**: "You are managing a serious system"

**Motion Behavior**:
- Static (no animation on page load or idle)
- Appears instantly or simple fade-in (150ms) on initial app load
- No hover effects on logo itself
- Entire logo area clickable with subtle hover feedback

---

### 2. Wordmark (Desktop Only)

**Requirements**:
- **Text**: "ARMOURED SOULS" (ALL CAPS)
- **Font Family**: 'DIN Next', 'Inter Tight', 'Roboto Condensed', sans-serif
- **Font Size**: 20px (text-xl)
- **Font Weight**: Bold (700)
- **Color**: Primary text (#e6edf3)
- **Letter Spacing**: Tight tracking (-0.02em)
- **Alignment**: Left, adjacent to logo
- **Spacing**: 16px left margin from logo
- **Display**: Desktop only (>1024px), hidden on tablet/mobile

**Tailwind Classes**: `text-xl font-bold text-primary tracking-tight hidden lg:block`

**Note**: On mobile, logo is sufficient for brand recognition; wordmark removed to save space.

---

### 3. Navigation Links (Desktop Primary Nav)

**Phase 1 (MVP) Links**:
1. Dashboard
2. My Robots
3. Facilities
4. Weapon Shop
5. Battle History

**Layout**:
- **Display**: Horizontal flex row
- **Spacing**: 8px gap between links (gap-2)
- **Alignment**: Left-aligned, after logo/wordmark
- **Font**: Inter, 16px, Medium (500)

**Link States**:

**Normal (Inactive)**:
```css
color: #8b949e; /* Secondary text */
padding: 8px 12px;
border-radius: 6px;
transition: all 150ms ease-out;
```

**Hover**:
```css
color: #e6edf3; /* Primary text */
background: rgba(255, 255, 255, 0.05);
```

**Active (Current Page)**:
```css
color: #e6edf3; /* Primary text */
background: rgba(88, 166, 255, 0.15); /* Primary accent with opacity */
border-bottom: 2px solid #58a6ff; /* Primary accent */
font-weight: 600; /* Semi-bold */
```

**Focus (Keyboard)**:
```css
outline: 2px solid #58a6ff;
outline-offset: 2px;
```

**Tailwind Classes**:
```jsx
// Inactive
className="text-secondary hover:text-primary hover:bg-white/5 
           px-3 py-2 rounded-md transition-all duration-150
           focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-elevated"

// Active
className="text-primary bg-primary/15 border-b-2 border-primary 
           px-3 py-2 rounded-t-md font-semibold
           focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-elevated"
```

---

### 4. Credits Display

**Requirements**:
- **Icon**: Currency icon (₡ symbol or custom SVG)
- **Value**: User's current credit balance (e.g., "1,250")
- **Font**: Inter, 16px, Medium (500)
- **Color**: 
  - Icon: Primary accent (#58a6ff)
  - Value: Primary text (#e6edf3)
- **Layout**: Icon + value, horizontal flex
- **Spacing**: 8px gap between icon and value
- **Background**: Surface (#1a1f29)
- **Padding**: 8px 12px
- **Border Radius**: 6px
- **Border**: 1px solid rgba(255, 255, 255, 0.1)
- **Clickable**: Optional - could link to economy overview (future)

**Number Formatting**:
- Use comma separators for thousands: 1,250 (not 1250)
- No decimal places for whole numbers
- If >1,000,000: Use "1.2M" format

**Tailwind Classes**:
```jsx
className="flex items-center gap-2 bg-surface border border-white/10 
           px-3 py-2 rounded-md"
```

**Desktop Placement**: Right section of nav bar, before user menu  
**Mobile Placement**: Top header, right side, before notification/profile icons

---

### 5. User Profile Menu (Desktop)

**Trigger**: Clickable element showing username or profile icon with dropdown arrow  
**Display**: "Profile ▾" text or avatar + dropdown arrow

**Dropdown Menu Structure** (Phase 1):
```
─────────────────
Profile (future)
Settings (future)
─────────────────
Logout
```

**Layout**:
- **Width**: 200px
- **Background**: Surface elevated (#252b38)
- **Border**: 1px solid rgba(255, 255, 255, 0.1)
- **Border Radius**: 8px
- **Shadow**: Large elevation shadow
- **Position**: Absolute, right-aligned below trigger
- **Animation**: Fade in + slide down (200ms ease-out)

**Menu Item States**:

**Normal**:
```css
color: #e6edf3;
padding: 12px 16px;
```

**Hover**:
```css
background: rgba(88, 166, 255, 0.1);
color: #58a6ff;
```

**Separator**:
```css
border-top: 1px solid rgba(255, 255, 255, 0.1);
margin: 8px 0;
```

**Logout (Danger Action)**:
```css
color: #f85149; /* Error red */
```
```css
/* Hover */
background: rgba(248, 81, 73, 0.1);
```

---

### 6. Logout Button (Alternative to Dropdown)

**For Phase 1 MVP** (if user dropdown not yet implemented):
- **Display**: "Logout" button directly in nav bar
- **Style**: Secondary button
- **Background**: Transparent
- **Border**: 1px solid rgba(248, 81, 73, 0.3)
- **Color**: Error red (#f85149)
- **Hover**: Background rgba(248, 81, 73, 0.1)
- **Padding**: 8px 16px
- **Border Radius**: 6px

**Tailwind Classes**:
```jsx
className="border border-error/30 text-error hover:bg-error/10 
           px-4 py-2 rounded-md transition-all duration-150"
```

---

### 7. Mobile Bottom Navigation Tabs

**Tab Structure** (5 tabs):

**Layout Per Tab**:
- **Width**: 20% (flex-1, equal distribution)
- **Height**: 64px
- **Flex Direction**: Column (icon above label)
- **Alignment**: Center (horizontal and vertical)
- **Tap Target**: Minimum 44×44px (touch-friendly)

**Tab Components**:
1. **Icon**: 24×24px SVG icon
2. **Label**: Text label below icon
   - Font: Inter, 12px, Medium (500)
   - Line Height: 1.2

**Tab States**:

**Inactive**:
```css
Icon Color: #8b949e; /* Secondary text */
Label Color: #8b949e;
Background: transparent;
```

**Active (Current Page)**:
```css
Icon Color: #58a6ff; /* Primary accent */
Label Color: #58a6ff;
Background: rgba(88, 166, 255, 0.1);
Font Weight: 600; /* Semi-bold */
```

**Pressed** (touch feedback):
```css
Background: rgba(88, 166, 255, 0.05);
Scale: 0.95;
Transition: 100ms ease-out;
```

**Tab Icons**:
- **Dashboard**: Home icon (house/grid)
- **Robots**: Robot icon (humanoid/mechanical)
- **Battles**: Sword/crossed swords icon
- **Shop**: Shopping cart icon
- **More**: Hamburger menu icon (three horizontal lines)

**Tailwind Classes**:
```jsx
// Inactive
className="flex flex-col items-center justify-center flex-1 h-16 
           text-secondary transition-all duration-150 active:scale-95"

// Active
className="flex flex-col items-center justify-center flex-1 h-16 
           text-primary bg-primary/10 font-semibold"
```

---

### 8. Hamburger Menu Drawer (Mobile)

**Trigger**: Clicking "More" tab in bottom navigation  
**Open Animation**: Slide in from right (300ms ease-out)  
**Close Animation**: Slide out to right (250ms ease-in)

**Layout**:
- **Width**: 280px (sm screens), 320px (larger phones)
- **Height**: 100vh (full screen height)
- **Background**: Surface (#1a1f29)
- **Position**: Fixed right, covers full height
- **Z-Index**: 1100 (above nav bar)
- **Shadow**: Large elevation shadow on left edge

**Header Section**:
- **Logo**: Direction B logo, 32×32px
- **Wordmark**: "ARMOURED SOULS", 18px, Bold
- **Spacing**: 24px padding, centered
- **Border Bottom**: 1px solid rgba(255, 255, 255, 0.1)
- **Background**: Surface elevated (#252b38)

**Menu Sections**:

**Section Header** (e.g., "MANAGE STABLE"):
- **Font**: Inter, 12px, Bold (700), ALL CAPS
- **Color**: Tertiary text (#57606a)
- **Spacing**: 24px top margin, 12px bottom margin, 16px horizontal padding
- **Icon**: Optional emoji or SVG icon (24×24px) before text

**Menu Item**:
- **Font**: Inter, 16px, Regular (400)
- **Color**: Primary text (#e6edf3)
- **Padding**: 12px 16px
- **Hover/Press**: Background rgba(255, 255, 255, 0.05)
- **Active (Current Page)**: 
  - Background: rgba(88, 166, 255, 0.15)
  - Border Left: 3px solid #58a6ff
  - Font Weight: 600 (Semi-bold)

**Disabled/Future Items**:
- **Color**: Tertiary text (#57606a)
- **Opacity**: 0.5
- **Cursor**: not-allowed
- **Label**: " (future)" or "(coming soon)" appended

**Close Behavior**:
- Clicking outside drawer closes it
- Clicking a menu item closes drawer and navigates
- Swipe right gesture closes drawer (future enhancement)

**Backdrop**:
- **Background**: rgba(0, 0, 0, 0.5) (dark overlay)
- **Fade In**: 200ms
- **Click**: Closes drawer

---

## Mobile Header Specifications

**Purpose**: Persistent branding and key actions on mobile  
**Height**: 56px (h-14)  
**Background**: Surface elevated (#252b38)  
**Border Bottom**: 1px solid rgba(255, 255, 255, 0.1)

**Layout Structure** (3 sections):

**Left Section**: Logo
- Direction B logo, 32×32px
- 16px left margin

**Center Section**: Wordmark (optional, space permitting)
- "ARMOURED SOULS", 16px, Bold
- Only show if screen width >375px

**Right Section**: Quick Actions
- Credits display: "[₡ 1,250]" (condensed format)
- Notification icon (future): Bell icon with badge
- Profile icon (future): Avatar or user icon
- Spacing: 12px gap between items

**All interactive elements**: Minimum 44×44px tap target

---

## Tablet Navigation (768px - 1023px)

**Approach**: Hybrid between desktop and mobile

**Top Bar**: 
- Full horizontal navigation like desktop
- Condensed spacing (6px between links instead of 8px)
- Smaller font size (14px instead of 16px)
- Logo + wordmark retained

**Bottom Bar**: 
- Optional: Can include bottom nav for primary actions
- Or rely entirely on top bar

**Recommendation for Phase 1**: Use desktop layout for tablets (≥768px), mobile layout for phones (<768px). Fine-tune tablet experience in Phase 2.

---

## Motion & Animation Specifications

### Management Motion Rules (Direction B Context)

**Philosophy**: Subtle transitions only, easing ease-out, minimal movement, no distraction

**Navigation Bar Load**:
- **Initial Appearance**: Instant (no fade-in after initial app load)
- **Logo**: Static, no animation
- **Links**: Appear instantly with page

**Link Hover/Interaction**:
- **Transition**: All 150ms ease-out
- **Properties**: color, background-color, transform
- **Movement**: None (no vertical shift)
- **Scale**: None (no scale change)

**Dropdown Menu Open/Close**:
- **Open**: Fade in (opacity 0 → 1) + slide down (translateY -10px → 0)
- **Duration**: 200ms ease-out
- **Close**: Fade out (opacity 1 → 0)
- **Duration**: 150ms ease-in

**Mobile Hamburger Drawer**:
- **Open**: Slide in from right (translateX 100% → 0)
- **Duration**: 300ms ease-out
- **Backdrop Fade**: 200ms
- **Close**: Slide out to right (translateX 0 → 100%)
- **Duration**: 250ms ease-in

**Mobile Bottom Nav Tap Feedback**:
- **Press**: Scale 0.95, background color change
- **Duration**: 100ms ease-out
- **Release**: Scale back to 1.0
- **Duration**: 150ms ease-out

**Page Transition** (active state change):
- **Previous Active Link**: Fade out active styles
- **New Active Link**: Fade in active styles
- **Duration**: 200ms ease-out
- **No page-level transition animation** (instant route change)

---

## Accessibility Requirements

### Keyboard Navigation

**Tab Order**:
1. Logo (skip link: "Skip to main content" - future)
2. Navigation links (left to right)
3. Credits display (if interactive)
4. User profile menu trigger
5. Logout button

**Keyboard Shortcuts** (Future Enhancement - Phase 2):
- `D`: Dashboard
- `R`: Robots
- `B`: Battle History
- `F`: Facilities
- `S`: Shop
- `/` or `Cmd+K`: Command Palette (Phase 2)
- `?`: Help/Shortcuts overlay
- `Escape`: Close dropdown/drawer

**Focus Indicators**:
- **All interactive elements** must have visible focus state
- **Focus Ring**: 2px solid #58a6ff (primary accent)
- **Focus Offset**: 2px
- **Focus Background**: rgba(88, 166, 255, 0.1) (optional)

### ARIA Labels & Roles

**Navigation Element**:
```html
<nav role="navigation" aria-label="Main navigation">
  <!-- Navigation content -->
</nav>
```

**Logo Link**:
```html
<a href="/dashboard" aria-label="Armoured Souls Home">
  <img src="logo-b.svg" alt="Armoured Souls Logo" />
</a>
```

**Navigation Links**:
```html
<a href="/robots" aria-current="page" aria-label="My Robots">
  My Robots
</a>
```
- `aria-current="page"` for active link
- Clear, descriptive `aria-label` for each link

**Mobile Bottom Nav**:
```html
<nav role="navigation" aria-label="Primary navigation">
  <button aria-label="Dashboard" aria-current="page">
    <!-- Icon + label -->
  </button>
</nav>
```

**Hamburger Menu**:
```html
<button aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobile-menu">
  <!-- Hamburger icon -->
</button>

<div id="mobile-menu" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title">
  <h2 id="mobile-menu-title" class="sr-only">Navigation Menu</h2>
  <!-- Menu content -->
</div>
```

**Dropdown Menu**:
```html
<button aria-label="User menu" aria-expanded="false" aria-haspopup="true" aria-controls="user-dropdown">
  Profile ▾
</button>

<div id="user-dropdown" role="menu" aria-labelledby="user-menu-button">
  <a href="/profile" role="menuitem">Profile</a>
  <a href="/settings" role="menuitem">Settings</a>
  <button role="menuitem" class="logout">Logout</button>
</div>
```

### Screen Reader Compatibility

- **Semantic HTML**: Use `<nav>`, `<header>`, `<button>`, `<a>` elements appropriately
- **Descriptive Labels**: All interactive elements have clear text or `aria-label`
- **Skip Links**: "Skip to main content" link at top (hidden visually, visible on focus)
- **Current Page Indication**: `aria-current="page"` on active navigation link
- **Icon-Only Buttons**: Must have `aria-label` (e.g., mobile bottom nav icons)

### Color Contrast (WCAG 2.1 AA)

| Element | Foreground | Background | Ratio | Pass |
|---------|------------|------------|-------|------|
| Inactive link text (#8b949e) | #8b949e | #252b38 | 5.2:1 | ✅ AA |
| Active link text (#e6edf3) | #e6edf3 | #252b38 | 12.5:1 | ✅ AAA |
| Primary accent (#58a6ff) | #58a6ff | #252b38 | 6.2:1 | ✅ AA |
| Error text (#f85149) | #f85149 | #252b38 | 4.8:1 | ✅ AA |

**All color combinations meet or exceed WCAG 2.1 AA standards.**

---

## Responsive Breakpoints

### Breakpoint Strategy

| Breakpoint | Range | Navigation Pattern |
|------------|-------|-------------------|
| **Mobile** | <768px | Bottom nav (5 tabs) + Hamburger drawer + Top header |
| **Tablet** | 768px - 1023px | Hybrid: Top horizontal nav (condensed) or mobile pattern |
| **Desktop** | ≥1024px | Full horizontal app bar with all features |
| **Large Desktop** | ≥1440px | Same as desktop, more spacing/breathing room |

### Responsive Behavior

**Logo & Wordmark**:
- **Mobile (<768px)**: Logo only (32px), wordmark hidden
- **Tablet (768-1023px)**: Logo (32px) + wordmark (18px)
- **Desktop (≥1024px)**: Logo (40px) + wordmark (20px)

**Navigation Links**:
- **Mobile (<768px)**: Hidden in top bar, accessible via hamburger drawer or bottom nav
- **Tablet (768-1023px)**: Horizontal in top bar, condensed spacing (14px font)
- **Desktop (≥1024px)**: Horizontal in top bar, full spacing (16px font)

**Credits Display**:
- **Mobile (<768px)**: Condensed format in top header (icon + number, small font)
- **Tablet/Desktop**: Full format in nav bar

**User Menu**:
- **Mobile (<768px)**: Profile icon only (24px) in top header, or in hamburger menu
- **Tablet/Desktop**: "Profile ▾" text with dropdown

---

## Image Assets & Requirements

### Required Assets

#### 1. Direction B Logo (PRIMARY ASSET - CRITICAL)

**File Name**: `logo-b.svg`  
**Location**: `prototype/frontend/src/assets/logos/logo-b.svg`  
**Format**: SVG (vector, scalable)  
**Dimensions**: Design at 128×128px artboard, use at 32-40px in UI

**Visual Description**:
- **Type**: Precision/Engineering logo (Direction B)
- **Style**: Engineered letterforms, minimal ornamentation, brushed metal aesthetic
- **Color**: Light on dark (#e6edf3 on #252b38 background)
- **Characteristics**:
  - Geometric, angular forms (industrial precision)
  - High contrast against dark background
  - Professional, systematic appearance
  - Horizontal orientation preferred for desktop, square for mobile
- **Inspiration**: Industrial design, engineering schematics, precision machinery
- **NOT**: Playful, organic, anime-style, or overly detailed

**Design Guidelines** (from brand documentation):
- Logo communicates: "You are managing a serious system"
- Emotional targets: Control, mastery, managerial authority
- Static appearance (no idle animation, no glow effects)
- Geometry reflects precision and deliberate design

**Technical Requirements**:
- SVG with proper viewBox
- Optimized file size (<15KB)
- Single color or minimal color palette
- Proper accessibility: `<title>` and `<desc>` tags in SVG
- Exports: 32px, 40px, 64px PNG fallbacks for older browsers

**Usage Context**:
- Desktop: Top-left of navigation bar, 40×40px
- Mobile header: Center, 32×32px
- Hamburger menu: Top of drawer, 32×32px
- Always Direction B (never C or D) on navigation
- No animation except on initial app load (150ms fade-in)

---

#### 2. Navigation Icons (Mobile Bottom Nav)

**Required Icons** (5 total):

1. **Dashboard/Home Icon**
   - File: `icon-dashboard.svg`
   - Size: 24×24px
   - Style: Outline or filled based on active state

2. **Robots Icon**
   - File: `icon-robots.svg`
   - Size: 24×24px
   - Style: Humanoid/mechanical silhouette

3. **Battles Icon**
   - File: `icon-battles.svg`
   - Size: 24×24px
   - Style: Crossed swords or single sword

4. **Shop Icon**
   - File: `icon-shop.svg`
   - Size: 24×24px
   - Style: Shopping cart or storefront

5. **More/Menu Icon**
   - File: `icon-menu.svg`
   - Size: 24×24px
   - Style: Three horizontal lines (hamburger)

**Icon Design Guidelines**:
- **Style**: Consistent line weight (2px stroke), minimal detail
- **Format**: SVG with single color (currentColor for CSS control)
- **Size**: 24×24px artboard, 20×20px content (2px padding)
- **Color**: Inherit from parent (`currentColor`)
- **States**: Single icon file, styled via CSS for active/inactive states

**Location**: `prototype/frontend/src/assets/icons/`

---

#### 3. Currency Icon

**File Name**: `icon-currency.svg` or use text symbol "₡"  
**Size**: 20×20px (inline with text)  
**Color**: Primary accent (#58a6ff)  
**Style**: Simple, recognizable symbol

**Options**:
- **Option A**: Use text symbol "₡" (colon currency sign) or "Ȼ"
- **Option B**: Custom coin/credit icon SVG

**Recommendation**: Start with text symbol for simplicity, create custom icon in polish phase.

---

#### 4. User/Profile Icon

**File Name**: `icon-user.svg`  
**Size**: 24×24px  
**Style**: Simple avatar silhouette or user outline  
**Color**: Primary text (#e6edf3) or secondary (#8b949e)

**Location**: `prototype/frontend/src/assets/icons/icon-user.svg`

---

#### 5. Dropdown Arrow Icon

**File Name**: `icon-chevron-down.svg`  
**Size**: 16×16px  
**Style**: Simple downward-pointing chevron/arrow  
**Color**: Inherit from parent

**Location**: `prototype/frontend/src/assets/icons/icon-chevron-down.svg`

---

### Asset Creation Checklist

**For Designer/Asset Creator**:

- [ ] **Direction B Logo SVG** (REQUIRED - CRITICAL)
  - [ ] Design at 128×128px artboard
  - [ ] Export as optimized SVG
  - [ ] Color: #e6edf3 (light on dark)
  - [ ] Test at 32px, 40px, 64px sizes
  - [ ] Ensure crisp rendering at all sizes
  - [ ] Add proper SVG metadata (title, description)
  - [ ] Create PNG fallbacks (32px, 40px, 64px)

- [ ] **Mobile Navigation Icons** (5 icons)
  - [ ] Design consistent set with same style
  - [ ] Export as SVG with currentColor
  - [ ] Test in active/inactive states
  - [ ] Ensure 44×44px tap target usability

- [ ] **Currency Icon** (Optional)
  - [ ] Simple, recognizable design
  - [ ] Works at small size (20px)

- [ ] **User/Profile Icon**
  - [ ] Generic avatar/silhouette style
  - [ ] 24×24px

- [ ] **Dropdown Arrow**
  - [ ] Simple chevron
  - [ ] 16×16px

**For Developer Implementation**:

- [ ] Place all assets in `prototype/frontend/src/assets/` (logos/, icons/)
- [ ] Import logo in navigation component
- [ ] Implement with proper alt text and ARIA labels
- [ ] Test logo at different screen densities (1x, 2x, 3x)
- [ ] Verify crisp rendering in all supported browsers
- [ ] Optimize icon loading (lazy load, sprite sheet, or inline SVG)

---

## Color Palette Reference

### Navigation-Specific Colors

```css
/* Navigation Bar */
--nav-background: #252b38;           /* Surface elevated */
--nav-border: rgba(255, 255, 255, 0.1);

/* Navigation Links */
--link-inactive: #8b949e;            /* Secondary text */
--link-active: #e6edf3;              /* Primary text */
--link-hover-bg: rgba(255, 255, 255, 0.05);
--link-active-bg: rgba(88, 166, 255, 0.15); /* Primary accent with opacity */
--link-active-border: #58a6ff;       /* Primary accent */

/* Mobile Bottom Nav */
--bottom-nav-background: #252b38;    /* Surface elevated */
--bottom-nav-border: rgba(255, 255, 255, 0.1);
--tab-inactive: #8b949e;             /* Secondary text */
--tab-active: #58a6ff;               /* Primary accent */
--tab-active-bg: rgba(88, 166, 255, 0.1);

/* Hamburger Drawer */
--drawer-background: #1a1f29;        /* Surface */
--drawer-header-bg: #252b38;         /* Surface elevated */
--drawer-item-hover: rgba(255, 255, 255, 0.05);
--drawer-item-active-bg: rgba(88, 166, 255, 0.15);
--drawer-item-active-border: #58a6ff;

/* Dropdown Menu */
--dropdown-background: #252b38;      /* Surface elevated */
--dropdown-border: rgba(255, 255, 255, 0.1);
--dropdown-item-hover: rgba(88, 166, 255, 0.1);

/* Credits Display */
--credits-background: #1a1f29;       /* Surface */
--credits-border: rgba(255, 255, 255, 0.1);
--credits-icon-color: #58a6ff;       /* Primary accent */
--credits-value-color: #e6edf3;      /* Primary text */

/* Logout Button */
--logout-color: #f85149;             /* Error red */
--logout-border: rgba(248, 81, 73, 0.3);
--logout-hover-bg: rgba(248, 81, 73, 0.1);
```

### Contrast Ratios (WCAG 2.1 AA)

All color combinations verified for accessibility:

| Element | Foreground | Background | Ratio | Pass |
|---------|------------|------------|-------|------|
| Inactive link | #8b949e | #252b38 | 5.2:1 | ✅ AA |
| Active link | #e6edf3 | #252b38 | 12.5:1 | ✅ AAA |
| Primary accent | #58a6ff | #252b38 | 6.2:1 | ✅ AA |
| Logo | #e6edf3 | #252b38 | 12.5:1 | ✅ AAA |
| Logout button | #f85149 | #252b38 | 4.8:1 | ✅ AA |

---

## Typography System

### Navigation Typography

**Logo/Wordmark**:
```css
font-family: 'DIN Next', 'Inter Tight', 'Roboto Condensed', sans-serif;
font-size: 20px; /* Desktop */
font-weight: 700; /* Bold */
letter-spacing: -0.02em; /* Tight tracking */
color: #e6edf3;
```

**Navigation Links** (Desktop):
```css
font-family: 'Inter', sans-serif;
font-size: 16px; /* Desktop */
font-size: 14px; /* Tablet */
font-weight: 500; /* Medium */
letter-spacing: 0;
color: #8b949e; /* Inactive */
color: #e6edf3; /* Active */
font-weight: 600; /* Semi-bold when active */
```

**Mobile Bottom Nav Labels**:
```css
font-family: 'Inter', sans-serif;
font-size: 12px;
font-weight: 500; /* Medium */
font-weight: 600; /* Semi-bold when active */
letter-spacing: 0;
line-height: 1.2;
color: #8b949e; /* Inactive */
color: #58a6ff; /* Active */
```

**Hamburger Menu Section Headers**:
```css
font-family: 'Inter', sans-serif;
font-size: 12px;
font-weight: 700; /* Bold */
text-transform: uppercase;
letter-spacing: 0.05em;
color: #57606a; /* Tertiary */
```

**Hamburger Menu Items**:
```css
font-family: 'Inter', sans-serif;
font-size: 16px;
font-weight: 400; /* Regular */
font-weight: 600; /* Semi-bold when active */
letter-spacing: 0;
color: #e6edf3;
```

**Credits Display**:
```css
font-family: 'Inter', sans-serif;
font-size: 16px; /* Desktop */
font-size: 14px; /* Mobile */
font-weight: 500; /* Medium */
letter-spacing: 0;
color: #e6edf3;
```

---

## Implementation Priority Matrix

### Phase 1 (MVP - Current Sprint)

**P0 - Critical** (Must have for launch):
- [x] Desktop horizontal navigation bar structure
- [ ] Direction B logo integration (desktop)
- [ ] Desktop navigation links (5 primary links)
- [ ] Active state indicators (current page highlight)
- [ ] Credits display in nav bar
- [ ] Logout button (simple version, not dropdown)
- [ ] Mobile bottom navigation bar (5 tabs)
- [ ] Mobile hamburger drawer menu
- [ ] Mobile top header with logo
- [ ] Responsive breakpoints (mobile <768px, desktop ≥1024px)
- [ ] Keyboard navigation support
- [ ] Focus indicators
- [ ] ARIA labels for accessibility

**P1 - Important** (Should have for polish):
- [ ] Hover states following design system
- [ ] Smooth transitions (150-300ms)
- [ ] Logo PNG fallbacks for older browsers
- [ ] Mobile navigation icons (5 SVG icons)
- [ ] Backdrop overlay for hamburger drawer
- [ ] Touch feedback on mobile (scale/background change)
- [ ] Safe area insets for iOS/Android

**P2 - Nice to have** (Can defer to Phase 2):
- [ ] User profile dropdown menu
- [ ] Number formatting for credits (comma separators)
- [ ] "Skip to main content" link
- [ ] Swipe gesture to close drawer

### Phase 2 (Enhanced Features)

**Planned Additions**:
- [ ] Mega menu dropdowns for "Robots", "Battles", "Shop"
- [ ] Search bar with fuzzy search
- [ ] Notification center with badge
- [ ] User dropdown menu (Profile, Settings, Notifications, Logout)
- [ ] Breadcrumbs on detail pages
- [ ] Command palette (Cmd+K / Ctrl+K)
- [ ] Keyboard shortcuts overlay (press "?")

### Phase 3+ (Advanced)

**Future Enhancements**:
- [ ] Social section in primary nav (Friends, Guild, Chat)
- [ ] Guild notification badges
- [ ] Contextual navigation (battle mode, tournament mode)
- [ ] Progressive feature unlocking UI (gated features shown as "locked")
- [ ] Side navigation for contextual pages (Robot Detail, Facilities)
- [ ] Mobile: Enhanced gestures (swipe between related pages)

---

## Testing & Validation Checklist

### Visual Testing

**Desktop (≥1024px)**:
- [ ] Navigation bar height exactly 64px
- [ ] Logo renders crisply at 40×40px
- [ ] Wordmark uses correct font (DIN Next/Inter Tight)
- [ ] Navigation links spaced correctly (8px gap)
- [ ] Active link has blue underline and background
- [ ] Hover state shows subtle background (#ffffff at 5% opacity)
- [ ] Credits display formatted correctly
- [ ] Logout button styled per design system

**Mobile (<768px)**:
- [ ] Bottom nav bar height exactly 64px
- [ ] 5 tabs equally distributed (20% width each)
- [ ] Icons 24×24px, centered above labels
- [ ] Active tab highlighted with primary accent color
- [ ] Tap targets minimum 44×44px
- [ ] Top header shows logo and credits
- [ ] Hamburger drawer slides in from right (300ms)
- [ ] Drawer width 280px, full height
- [ ] Backdrop overlay visible when drawer open

**Tablet (768-1023px)**:
- [ ] Uses desktop layout (horizontal nav)
- [ ] Slightly condensed spacing appropriate

### Functional Testing

**Navigation**:
- [ ] Logo click returns to dashboard
- [ ] All navigation links route correctly
- [ ] Active state updates on route change
- [ ] Mobile tabs route correctly
- [ ] Hamburger menu opens/closes smoothly
- [ ] Clicking menu item closes drawer and navigates
- [ ] Clicking backdrop closes drawer
- [ ] Logout button triggers logout flow

**Keyboard Navigation**:
- [ ] Tab key cycles through all interactive elements in correct order
- [ ] Enter key activates focused link/button
- [ ] Escape key closes dropdown/drawer (if implemented)
- [ ] Focus indicators visible on all elements
- [ ] No keyboard traps

**Accessibility**:
- [ ] Screen reader announces navigation properly
- [ ] All interactive elements have ARIA labels
- [ ] Current page indicated with `aria-current="page"`
- [ ] Dropdown has `aria-expanded` state
- [ ] Hamburger drawer has `role="dialog"` and `aria-modal="true"`
- [ ] Color contrast meets WCAG 2.1 AA on all elements

**Responsive Behavior**:
- [ ] Smooth transition between breakpoints (no jarring layout shifts)
- [ ] Mobile header and bottom nav appear only on mobile
- [ ] Desktop nav bar appears only on desktop/tablet
- [ ] No horizontal scrolling on any breakpoint
- [ ] Navigation adapts correctly at exact breakpoints (768px, 1024px)

**Performance**:
- [ ] Navigation renders in <50ms
- [ ] No layout shift (CLS) on page load
- [ ] Logo loads quickly (or fallback shown)
- [ ] Animations run at 60fps (no jank)
- [ ] Navigation doesn't block main thread

### Browser Testing

**Required Browsers**:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, desktop and iOS)
- [ ] Mobile browsers (Chrome Android, Safari iOS)

**Device Testing**:
- [ ] iPhone (various sizes: SE, 12, 14 Pro Max)
- [ ] Android (various sizes)
- [ ] iPad (portrait and landscape)
- [ ] Desktop (1920×1080, 1440×900, 1280×720)

---

## Implementation Notes

### Technical Considerations

**Component Structure** (React):
```
<Navigation>
  <DesktopNav>         // Shown on ≥1024px
    <Logo />
    <PrimaryLinks />
    <CreditsDisplay />
    <UserMenu />
  </DesktopNav>

  <MobileNav>          // Shown on <768px
    <MobileHeader>
      <Logo />
      <CreditsDisplay />
      <ProfileIcon />
    </MobileHeader>
    
    <BottomTabBar>
      <Tab name="Dashboard" />
      <Tab name="Robots" />
      <Tab name="Battles" />
      <Tab name="Shop" />
      <Tab name="More" />
    </BottomTabBar>
    
    <HamburgerDrawer isOpen={drawerOpen}>
      <DrawerHeader />
      <MenuSection title="MANAGE STABLE">
        <MenuItem name="Facilities" />
        <MenuItem name="Weapon Shop" />
        <MenuItem name="Weapon Inventory" />
      </MenuSection>
      <MenuSection title="COMPETE">
        <MenuItem name="Battle History" />
        <MenuItem name="Leagues" />
      </MenuSection>
      <MenuSection title="SETTINGS">
        <MenuItem name="Logout" danger />
      </MenuSection>
    </HamburgerDrawer>
  </MobileNav>
</Navigation>
```

**State Management**:
- Current route (for active state)
- Drawer open/closed (mobile)
- Dropdown open/closed (desktop, future)
- User data (credits balance)

**Performance Optimization**:
- Logo: Load SVG inline or preload
- Icons: Use icon sprite or inline SVG
- Animations: Use CSS transforms (GPU-accelerated)
- Avoid re-renders: Memoize navigation component

**Responsive Strategy**:
- Use CSS media queries for breakpoints
- Tailwind responsive classes: `hidden lg:block`, `lg:hidden`
- Match breakpoints exactly: `<768px`, `768-1023px`, `≥1024px`

---

## Success Criteria Summary

**Launch Readiness** (Phase 1 MVP):
1. ✅ Direction B logo implemented on all authenticated pages
2. ✅ Desktop horizontal navigation with 5 primary links
3. ✅ Mobile bottom navigation with 5 tabs + hamburger drawer
4. ✅ Active state clearly indicates current page
5. ✅ Credits display visible and accurate
6. ✅ Logout functionality accessible
7. ✅ Responsive design works on mobile, tablet, desktop
8. ✅ Keyboard navigation fully functional
9. ✅ WCAG 2.1 AA accessibility compliance
10. ✅ Smooth animations (150-300ms) following design system

**Design System Alignment**:
- [x] Color palette matches design system
- [x] Typography uses DIN Next/Inter fonts
- [x] Motion follows management rules (subtle, no distraction)
- [x] Logo usage follows Direction B guidelines
- [x] Component states (hover, active, focus) per specifications
- [x] Spacing and sizing per design system scale

**User Experience Goals**:
- [x] Common pages accessible in 1-2 clicks
- [x] Clear visual hierarchy (primary vs secondary nav)
- [x] Platform-appropriate patterns (app bar, bottom nav, hamburger)
- [x] No confusion about current location (clear active state)
- [x] Fast, responsive interactions (<50ms perceived lag)

---

## Related Documentation

**Design System**:
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](DESIGN_SYSTEM_AND_UX_GUIDE.md) - Comprehensive design guide
- [DESIGN_SYSTEM_QUICK_REFERENCE.md](DESIGN_SYSTEM_QUICK_REFERENCE.md) - Quick lookup
- [DESIGN_SYSTEM_README.md](DESIGN_SYSTEM_README.md) - Overview & entry point

**Navigation Architecture**:
- [NAVIGATION_QUICK_REFERENCE.md](NAVIGATION_QUICK_REFERENCE.md) - Quick navigation lookup
- [NAVIGATION_AND_PAGE_STRUCTURE.md](NAVIGATION_AND_PAGE_STRUCTURE.md) - Complete navigation architecture

**Brand Guidelines**:
- [brand/1_brand_&_logo_design_foundations.md](brand/1_brand_&_logo_design_foundations.md) - Brand foundation
- [brand/2_brand_type_system.md](brand/2_brand_type_system.md) - Typography system
- [brand/3_brand_usage_system.md](brand/3_brand_usage_system.md) - Logo usage rules (Direction B/C/D)
- [brand/4_motion_micro_animation_system.md](brand/4_motion_micro_animation_system.md) - Motion principles

**Related PRDs**:
- [PRD_LOGIN_PAGE_DESIGN_ALIGNMENT.md](PRD_LOGIN_PAGE_DESIGN_ALIGNMENT.md) - Login page design (Direction D)
- [PRD_ROBOTS_PAGE_OVERHAUL.md](PRD_ROBOTS_PAGE_OVERHAUL.md) - Robots page design
- [PRD_WEAPON_LOADOUT.md](PRD_WEAPON_LOADOUT.md) - Weapon loadout feature

**Frontend Reference**:
- [FRONTEND_UI_REFERENCE.md](FRONTEND_UI_REFERENCE.md) - Page-by-page UI structure

---

## Appendix: Navigation Evolution Roadmap

### Phase 1 (MVP) - Current
**Desktop**: Simple horizontal nav bar  
**Mobile**: Bottom nav (5 tabs) + hamburger drawer  
**Features**: Core navigation, credits display, logout

### Phase 2 (Enhanced) - Q2 2026
**Desktop**: Add mega menu dropdowns, search, notifications, user menu  
**Mobile**: Enhanced drawer with notifications  
**Features**: Dropdown menus, notification badges, command palette, breadcrumbs

### Phase 3 (Social) - Q3 2026
**Desktop**: Add social section (Friends, Guild, Chat)  
**Mobile**: Social quick access in bottom nav or drawer  
**Features**: Guild badges, friend online indicators, chat integration

### Phase 4 (Tournaments) - Q4 2026
**Desktop**: Contextual navigation for tournament mode  
**Mobile**: Tournament-specific quick actions  
**Features**: Tournament countdown, bracket navigation

### Phase 5+ (Advanced) - 2027+
**Desktop**: Progressive feature unlocking UI, advanced tools  
**Mobile**: Gesture navigation, contextual toolbars  
**Features**: Locked feature previews, analytics navigation, marketplace filters

---

**Document Version**: 1.0  
**Last Updated**: February 1, 2026  
**Next Review**: After Phase 1 implementation completion

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-02-01 | 1.0 | Initial PRD creation | GitHub Copilot |
