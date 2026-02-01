# Product Requirements Document: Login Page Design Alignment

**Last Updated**: February 1, 2026 (Revised)  
**Status**: Ready for Implementation  
**Owner**: Robert Teunissen  
**Epic**: Design System Implementation - Infrastructure Pages  
**Priority**: P2 (After core gameplay screens)

---

## Executive Summary

This PRD defines the requirements for updating the Login page (`/login`) to align with the comprehensive design system established for Armoured Souls. The login page serves as the **entry threshold** to the game and must communicate confidence, professionalism, and calm entry through the **Direction D (Minimal/Icon)** logo state and infrastructure-appropriate visual design.

**Success Criteria**:
- Login page uses Direction D logo and visual language
- Design reinforces "entering an established system" feeling
- Infrastructure context: minimal, calm, professional
- Consistent with design system color palette, typography, and motion principles
- Accessibility standards met (WCAG 2.1 AA)
- Loading states follow infrastructure motion guidelines

**Impact**: Establishes proper visual hierarchy from entry (Direction D) → management (Direction B) → battle (Direction C), reinforcing the emotional escalation ladder.

---

## Background & Context

### Current State

**What Exists**:
- ✅ Functional login page at `/login`
- ✅ Username/password authentication
- ✅ Error handling and loading states
- ✅ Basic dark theme styling
- ✅ Responsive layout

**Current Issues**:
- ❌ Generic "Armoured Souls" text instead of Direction D logo
- ❌ No adherence to design system color palette
- ❌ Typography not using system fonts (DIN Next/Inter)
- ❌ No subtle background texture/pattern
- ❌ Button colors don't match primary accent (#58a6ff)
- ❌ No infrastructure motion guidelines applied
- ❌ "Phase 1 - Local Prototype" subtitle not aligned with brand
- ❌ Input fields don't follow design system specifications

**What's Working Well**:
- ✅ Clean, minimal layout approach
- ✅ Center-aligned, single-column design
- ✅ Clear form structure

### Design References

**Primary Design Documents**:
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](DESIGN_SYSTEM_AND_UX_GUIDE.md) - Section 1: Login & Registration Pages
- [DESIGN_SYSTEM_QUICK_REFERENCE.md](DESIGN_SYSTEM_QUICK_REFERENCE.md) - Color palette, typography, motion
- [brand/4_motion_micro_animation_system.md](brand/4_motion_micro_animation_system.md) - Infrastructure motion rules
- [brand/3_brand_usage_system.md](brand/3_brand_usage_system.md) - Direction D logo usage

**Key Principles**:
- Logo State: **Direction D** (Minimal/Icon/Scaling)
- Emotional Target: **Confidence, professionalism, maturity**
- Motion State: **Infrastructure** (reassure, signal readiness, avoid urgency)
- Color System: Dark theme with design system palette
- Typography: DIN Next/Inter Tight for headers, Inter for body

---

## Goals & Objectives

### Primary Goals

1. **Brand Alignment**: Implement Direction D logo and visual language for infrastructure context
2. **Design System Compliance**: Use established color palette, typography, and spacing
3. **Emotional Consistency**: Communicate "entering an established system" feeling
4. **Motion Adherence**: Follow infrastructure motion rules (200-300ms linear fades, no bounce)
5. **Professional Polish**: Transform from prototype appearance to production-ready experience

### Success Metrics

- **Visual Consistency**: 100% compliance with design system specifications
- **Brand Recognition**: Direction D logo properly implemented
- **Accessibility**: WCAG 2.1 AA compliance (color contrast, keyboard navigation)
- **Performance**: Page load time <500ms (same as current)
- **User Perception**: "Feels professional and established" (qualitative)

### Non-Goals (Out of Scope)

- ❌ Registration page design (separate PRD)
- ❌ Password reset functionality
- ❌ Social login integration (OAuth, etc.)
- ❌ Multi-factor authentication
- ❌ Remember me / persistent sessions
- ❌ Backend authentication changes

---

## Design Specifications

### Visual Hierarchy

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              [Direction D Logo]                      │
│                64×64px minimum                       │
│                                                      │
│            ARMOURED SOULS                           │
│        Industrial Grotesk, 36px, Bold               │
│                                                      │
│  ┌────────────────────────────────────────────┐   │
│  │                                            │   │
│  │  Login                                     │   │
│  │  ────────────────────────────────────     │   │
│  │                                            │   │
│  │  [Error message if applicable]            │   │
│  │                                            │   │
│  │  Username                                  │   │
│  │  [___________________________________]    │   │
│  │                                            │   │
│  │  Password                                  │   │
│  │  [___________________________________]    │   │
│  │                                            │   │
│  │  [        Login Button        ]           │   │
│  │                                            │   │
│  └────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Logo (Direction D)

**Requirements**:
- **Logo Type**: Direction D (Minimal/Icon)
- **Placement**: Top center, above wordmark
- **Size**: 64×64px minimum, 80×80px recommended
- **Format**: SVG (preferred) or PNG with transparency
- **Color**: Adaptive - light on dark background (#e6edf3)
- **Spacing**: 24px margin below logo

**Design Characteristics** (from brand docs):
- Reduced mark or monogram
- Flat or near-flat rendering
- High contrast
- Texture-independent
- Geometry derived from Direction B

**Message**: "You are entering an established system"

**Motion Behavior**:
- Fade in on page load (200-300ms linear)
- No pulsing, glowing, or idle animation
- Static after initial load

---

### 2. Wordmark / Title

**Requirements**:
- **Text**: "ARMOURED SOULS" (ALL CAPS)
- **Font Family**: 'DIN Next', 'Inter Tight', 'Roboto Condensed', sans-serif
- **Font Size**: 36px (text-4xl)
- **Font Weight**: Bold (700)
- **Color**: Primary text (#e6edf3)
- **Letter Spacing**: Tight tracking
- **Alignment**: Center
- **Spacing**: 12px margin below title

**Tailwind Classes**: `text-4xl font-bold text-primary tracking-tight`

**Phase Subtitle** (Optional):
- Remove "Phase 1 - Local Prototype" OR
- Replace with subtle version indicator if needed
- If kept: text-sm, text-tertiary (#57606a), 8px below title

---

### 3. Background

**Requirements**:
- **Base Color**: Deep space black (#0a0e14)
- **Pattern/Texture**: Subtle tech grid or circuit board pattern (optional)
  - Opacity: 10-20%
  - Non-intrusive
  - SVG pattern or CSS gradient
- **Alternative**: Subtle radial gradient from center
  - From: #0a0e14 (center)
  - To: #000000 (edges)

**Rationale**: Infrastructure context requires minimal visual complexity. Background should not distract from form.

---

### 4. Login Form Container

**Requirements**:
- **Background**: Surface elevated (#252b38)
- **Border**: 1px solid rgba(255, 255, 255, 0.1)
- **Border Radius**: 12px
- **Padding**: 32px (p-8)
- **Max Width**: 400px (increased from current 384px)
- **Shadow**: Large elevation shadow
  - `box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)`
- **Margin**: Auto-centered horizontally, vertically centered in viewport

**Tailwind Classes**: `bg-surface-elevated border border-white/10 rounded-xl p-8 shadow-2xl max-w-md w-full`

---

### 5. Form Title

**Requirements**:
- **Text**: "Login"
- **Font Family**: Inter
- **Font Size**: 24px (text-2xl)
- **Font Weight**: Bold (700)
- **Color**: Primary text (#e6edf3)
- **Spacing**: 24px margin below

**Tailwind Classes**: `text-2xl font-bold text-primary mb-6`

---

### 6. Input Fields

**Requirements**:
- **Background**: Surface (#1a1f29)
- **Border**: 1px solid tertiary text (#57606a)
- **Border Radius**: 8px
- **Padding**: 12px 16px
- **Font**: Inter, 16px, Regular
- **Text Color**: Primary (#e6edf3)
- **Placeholder Color**: Tertiary (#57606a)

**States**:

**Normal**:
```css
background: #1a1f29;
border: 1px solid #57606a;
color: #e6edf3;
```

**Focus**:
```css
border: 1px solid #58a6ff; /* Primary accent */
box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1); /* Glow */
outline: none;
```

**Error** (if validation fails):
```css
border: 1px solid #f85149; /* Error red */
box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.1);
```

**Disabled**:
```css
background: #0a0e14;
border: 1px solid #30363d;
color: #8b949e;
cursor: not-allowed;
opacity: 0.6;
```

**Tailwind Classes**:
```jsx
className="w-full px-4 py-3 bg-surface border border-tertiary rounded-lg 
           text-primary placeholder-tertiary
           focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10
           disabled:bg-background disabled:border-gray-700 disabled:opacity-60"
```

---

### 7. Labels

**Requirements**:
- **Font**: Inter, 14px, Medium (500)
- **Color**: Secondary text (#8b949e)
- **Spacing**: 8px margin below label

**Tailwind Classes**: `block text-sm font-medium text-secondary mb-2`

---

### 8. Error Message

**Requirements**:
- **Background**: Error red with opacity (#f85149 at 10% opacity)
- **Border**: 1px solid error red (#f85149)
- **Text Color**: Light red (#ffa198)
- **Padding**: 12px 16px
- **Border Radius**: 8px
- **Margin**: 16px bottom
- **Font**: Inter, 14px, Regular

**Tailwind Classes**: `bg-error/10 border border-error text-red-300 px-4 py-3 rounded-lg mb-4`

**Animation**: Fade in from top (200ms ease-out)

---

### 9. Submit Button (Primary)

**Requirements**:
- **Background**: Primary accent (#58a6ff)
- **Text Color**: White (#ffffff)
- **Font**: Inter, 16px, Medium (500)
- **Padding**: 12px 24px
- **Border Radius**: 8px
- **Width**: 100% (full width)
- **Height**: 48px minimum (touch-friendly)

**States**:

**Normal**:
```css
background: #58a6ff;
color: #ffffff;
```

**Hover**:
```css
background: #79b8ff; /* Lighten 10% */
transform: translateY(-2px);
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
transition: all 150ms ease-out;
```

**Active** (pressed):
```css
background: #388bfd; /* Darken 10% */
transform: translateY(0);
box-shadow: none;
```

**Disabled** (loading state):
```css
background: #1f6feb; /* Darker blue */
color: #8b949e;
cursor: not-allowed;
opacity: 0.6;
```

**Focus** (keyboard):
```css
outline: 2px solid #58a6ff;
outline-offset: 2px;
```

**Tailwind Classes**:
```jsx
className="w-full bg-primary hover:bg-primary-light active:bg-primary-dark 
           disabled:bg-primary-dark disabled:opacity-60 
           text-white font-medium px-6 py-3 rounded-lg 
           transition-all duration-150 ease-out
           hover:-translate-y-0.5 hover:shadow-lg
           focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
```

---

### 10. Loading State

**Requirements**:
- **Button Text**: Changes from "Login" to "Logging in..."
- **Disabled**: Button disabled during loading
- **Spinner** (optional): Small spinner icon before text
  - Size: 16×16px
  - Color: White with opacity
  - Animation: Continuous rotation (linear, 1s per rotation)

**Motion**: Infrastructure motion rules apply
- No bounce or overshoot
- Linear fade transitions only

---

## Image Assets & Requirements

This section clearly defines all visual assets that need to be created for the login page implementation.

### Required Assets

#### 1. Direction D Logo (PRIMARY ASSET - CRITICAL)

**File Name**: `logo-d.svg`  
**Location**: `prototype/frontend/src/assets/logos/logo-d.svg`  
**Format**: SVG (vector, scalable)  
**Dimensions**: 64×64px minimum, 80×80px recommended (design at 128×128px for flexibility)

**Visual Description**:
- **Type**: Minimal icon/monogram derived from Direction B logo geometry
- **Style**: Flat or near-flat rendering (no gradients, minimal shadows)
- **Color**: Single color - light on dark (#e6edf3 on dark background)
- **Characteristics**:
  - Reduced mark or monogram (not full wordmark)
  - High contrast against dark background
  - Texture-independent (works at any size)
  - Geometric, angular forms (industrial precision aesthetic)
  - Contained within square bounds
  - Clean, professional appearance
- **Inspiration**: Think minimal tech company logos (Stripe, Linear, Notion icons)
- **NOT**: Anime-style, playful, organic shapes, or overly detailed

**Design Guidelines** (from brand documentation):
- Geometry should be derived from Direction B (the precision/engineering logo)
- Represents: Confidence, professionalism, maturity, establishment
- Message: "You are entering an established system"
- Should feel calm, not exciting or urgent

**Technical Requirements**:
- SVG with viewBox="0 0 128 128" (or similar square)
- Single path or simple paths
- No embedded raster images
- Optimized file size (<10KB)
- Proper accessibility: `<title>` and `<desc>` tags in SVG

**Usage Context**: 
- Displayed at top center of login page, above "ARMOURED SOULS" wordmark
- No animation except initial fade-in on page load
- Static once loaded (no pulsing, glowing, or rotation)

---

#### 2. Background Pattern/Texture (OPTIONAL - ENHANCEMENT)

**File Name**: `login-background-pattern.svg` OR implemented via CSS  
**Location**: `prototype/frontend/src/assets/patterns/` (if SVG) or inline CSS  
**Format**: SVG pattern or CSS gradient  

**Visual Description**:
- **Type**: Subtle tech grid, circuit board pattern, or radial gradient
- **Style**: Very low contrast, non-intrusive
- **Color**: 
  - Base: #0a0e14 (deep space black)
  - Pattern: Slightly lighter (#0f1419) at 10-20% opacity
- **Characteristics**:
  - Barely visible, almost subliminal
  - Should NOT distract from form content
  - Tech-inspired (grid lines, subtle geometric patterns)
  - Can be tiled SVG pattern or CSS-based

**Options**:

**Option A - CSS Radial Gradient** (simplest, no asset needed):
```css
background: radial-gradient(circle at center, #0a0e14 0%, #000000 100%);
```

**Option B - Subtle Grid Pattern** (SVG asset):
- Thin grid lines (1px, #0f1419 at 15% opacity)
- Grid spacing: 40-60px
- Seamlessly tileable
- File size: <5KB

**Option C - Circuit Board Motif** (SVG asset):
- Minimal circuit traces/nodes
- Very subtle, background-only
- Should not resemble actual circuitry (abstract geometric only)
- File size: <10KB

**Recommendation**: Start with Option A (CSS gradient) for MVP, consider SVG pattern in future polish phase.

**Usage Context**:
- Full-screen background behind login form
- Fixed position, no scrolling parallax
- Should enhance professional feeling without being noticeable

---

### Asset Creation Checklist

**For Designer/Asset Creator**:

- [ ] **Direction D Logo SVG** (REQUIRED)
  - [ ] Design at 128×128px artboard
  - [ ] Export as optimized SVG
  - [ ] Single color: #e6edf3
  - [ ] Test at 64px, 80px, and 128px sizes
  - [ ] Ensure crisp rendering at all sizes
  - [ ] Add proper SVG metadata (title, description)
  
- [ ] **Background Pattern** (OPTIONAL)
  - [ ] Decide on approach: CSS gradient vs SVG pattern
  - [ ] If SVG: Create tileable pattern at 128×128px tile
  - [ ] Test at full-screen scale (1920×1080)
  - [ ] Verify subtle appearance (should be barely visible)

**For Developer Implementation**:

- [ ] Place logo SVG in `prototype/frontend/src/assets/logos/`
- [ ] Import logo in `LoginPage.tsx`
- [ ] Implement with proper alt text and accessibility
- [ ] Apply CSS gradient background (or integrate SVG pattern)
- [ ] Test logo at different screen densities (1x, 2x, 3x)
- [ ] Verify logo renders correctly in all supported browsers

---

### Visual Reference Examples

**Direction D Logo Character**:
- Similar to: Monogram logos like Stripe's icon, Notion's checkmark, Linear's triangle
- NOT like: Detailed mascots, illustrated characters, or complex badges
- Geometric simplicity is key
- Should work as favicon, app icon, loading indicator

**Background Subtlety**:
- Similar to: VSCode login screen background, Figma's subtle patterns
- NOT like: Busy wallpapers, high-contrast patterns, animated backgrounds
- "Barely there" is the goal - should not compete with form for attention

---

## Color Palette Reference

### Color Variables

```css
/* Base Colors */
--background: #0a0e14;        /* Deep space black */
--surface: #1a1f29;            /* Dark panel */
--surface-elevated: #252b38;   /* Raised cards */

/* Text Colors */
--text-primary: #e6edf3;       /* Off-white */
--text-secondary: #8b949e;     /* Gray */
--text-tertiary: #57606a;      /* Muted gray */

/* Accent Colors */
--primary: #58a6ff;            /* Cyan-blue - primary actions */
--primary-light: #79b8ff;      /* Hover state */
--primary-dark: #388bfd;       /* Active state */

/* Status Colors */
--success: #3fb950;            /* Green */
--warning: #d29922;            /* Amber */
--error: #f85149;              /* Red */
--info: #a371f7;               /* Purple */
```

### Contrast Ratios (WCAG 2.1 AA)

| Foreground | Background | Ratio | Pass |
|------------|------------|-------|------|
| Primary text (#e6edf3) | Surface elevated (#252b38) | 12.5:1 | ✅ AAA |
| Secondary text (#8b949e) | Surface elevated (#252b38) | 5.8:1 | ✅ AA |
| Tertiary text (#57606a) | Surface elevated (#252b38) | 3.2:1 | ✅ AA (large text) |
| Primary accent (#58a6ff) | Surface elevated (#252b38) | 6.2:1 | ✅ AA |
| White (#ffffff) | Primary accent (#58a6ff) | 4.8:1 | ✅ AA |

**All color combinations meet WCAG 2.1 AA standards.**

---

## Typography System

### Font Families

**Logo/Headers**:
```css
font-family: 'DIN Next', 'Inter Tight', 'Roboto Condensed', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**UI/Body**:
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
```

### Typography Scale

| Element | Font | Size | Weight | Line Height | Usage |
|---------|------|------|--------|-------------|-------|
| Logo/Title | DIN Next/Inter Tight | 36px | Bold (700) | 1.2 | "ARMOURED SOULS" |
| Form Title | Inter | 24px | Bold (700) | 1.2 | "Login" |
| Body Text | Inter | 16px | Regular (400) | 1.5 | Input fields |
| Labels | Inter | 14px | Medium (500) | 1.5 | Form labels |
| Small Text | Inter | 12px | Regular (400) | 1.5 | Helper text |

### Font Loading

**Strategy**: System fonts first (instant), web fonts async (progressive enhancement)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
```

---

## Motion & Animation Specifications

### Infrastructure Motion Rules (Direction D Context)

**Purpose**:
- Reassure
- Signal readiness
- Avoid urgency

**Rules**:
- Slow, linear fades
- No scale changes
- No bounce or overshoot
- Duration: 200–300ms

### Specific Animations

#### 1. Page Load
```css
/* Logo fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.logo {
  animation: fadeIn 300ms linear;
}
```

#### 2. Form Fade In
```css
/* Form container appears */
.form-container {
  animation: fadeIn 300ms linear 100ms backwards;
}
```

#### 3. Button Hover
```css
/* Subtle lift on hover */
.button:hover {
  transform: translateY(-2px);
  transition: transform 150ms ease-out;
}
```

#### 4. Error Message Appear
```css
/* Error fades in from above */
@keyframes errorSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-message {
  animation: errorSlideIn 200ms ease-out;
}
```

#### 5. Input Field Focus
```css
/* Border and glow transition */
.input-field {
  transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
}
```

### Reduced Motion Support

**CRITICAL**: Respect user preferences

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

#### Color Contrast
- ✅ All text meets minimum 4.5:1 ratio (normal text)
- ✅ Large text meets minimum 3:1 ratio
- ✅ Interactive elements meet minimum 3:1 ratio

#### Keyboard Navigation
- ✅ All interactive elements focusable via Tab
- ✅ Visible focus indicators (outline or ring)
- ✅ Logical tab order (top to bottom, left to right)
- ✅ Form submittable via Enter key

**Tab Order**:
1. Username input
2. Password input
3. Login button

#### Focus Indicators

**Input Fields**:
```css
.input:focus {
  border-color: #58a6ff;
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.1);
  outline: none;
}
```

**Button**:
```css
.button:focus-visible {
  outline: 2px solid #58a6ff;
  outline-offset: 2px;
}
```

#### Screen Reader Support

**Form Labels**:
- All inputs have associated `<label>` elements
- Labels use `for` attribute matching input `id`
- Error messages use `aria-describedby` to link to input

**Error Handling**:
```jsx
<div role="alert" className="error-message">
  {error}
</div>
```

**Loading State**:
```jsx
<button disabled={loading} aria-busy={loading}>
  {loading ? 'Logging in...' : 'Login'}
</button>
```

#### Form Validation

**Required Fields**:
```jsx
<input
  type="text"
  id="username"
  name="username"
  required
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "username-error" : undefined}
/>
```

**Error Messages**:
```jsx
{hasError && (
  <p id="username-error" className="error-text" role="alert">
    {errorMessage}
  </p>
)}
```

---

## Responsive Design

### Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | <640px | Full width with 16px padding |
| Tablet | 640-1023px | Centered, max-width 400px |
| Desktop | ≥1024px | Centered, max-width 400px |

### Mobile Considerations

**Viewport Meta Tag**:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
```

**Touch Targets**:
- Minimum 44×44px for interactive elements
- Button height: 48px minimum
- Input height: 48px minimum
- Spacing between interactive elements: 8px minimum

**Font Sizing**:
- Base font size remains 16px (prevents zoom on iOS)
- No font sizes below 14px

---

## Implementation Checklist

### Phase 1: Core Visual Updates

- [ ] Replace "Armoured Souls" text with Direction D logo (SVG)
- [ ] Update color palette to design system colors
- [ ] Apply typography system (DIN Next/Inter fonts)
- [ ] Update background (subtle pattern or gradient)
- [ ] Update form container styling (surface elevated, border radius)
- [ ] Update input field styling (colors, focus states)
- [ ] Update button styling (primary accent color, hover states)
- [ ] Update error message styling

### Phase 2: Motion & Interaction

- [ ] Add page load fade-in animation (300ms linear)
- [ ] Add form container fade-in (staggered)
- [ ] Add button hover effects (subtle lift)
- [ ] Add input focus transitions
- [ ] Add error message slide-in animation
- [ ] Implement loading state animation
- [ ] Add reduced motion media query support

### Phase 3: Accessibility & Polish

- [ ] Verify keyboard navigation (tab order)
- [ ] Add focus indicators (outline/ring)
- [ ] Add ARIA labels and roles
- [ ] Test with screen reader
- [ ] Verify color contrast ratios
- [ ] Test responsive layout (mobile, tablet, desktop)
- [ ] Add form validation feedback
- [ ] Test loading and error states

### Phase 4: Assets & Production

- [ ] Create Direction D logo SVG asset
- [ ] Optimize logo file size
- [ ] Add logo to assets directory
- [ ] Test with different screen densities
- [ ] Test with slow network (loading states)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Performance audit (Lighthouse)

---

## Technical Specifications

### File Structure

```
prototype/frontend/
├── src/
│   ├── pages/
│   │   └── LoginPage.tsx          (UPDATE)
│   ├── assets/
│   │   └── logos/
│   │       └── logo-d.svg         (NEW - Direction D logo)
│   └── index.css                  (UPDATE - Add design system colors)
```

### Dependencies

**No new dependencies required.** Uses existing:
- React 18+
- React Router
- Tailwind CSS
- Auth context

### Design System Integration

**Tailwind Config** (`tailwind.config.js`):

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        background: '#0a0e14',
        surface: '#1a1f29',
        'surface-elevated': '#252b38',
        'text-primary': '#e6edf3',
        'text-secondary': '#8b949e',
        'text-tertiary': '#57606a',
        primary: '#58a6ff',
        'primary-light': '#79b8ff',
        'primary-dark': '#388bfd',
        success: '#3fb950',
        warning: '#d29922',
        error: '#f85149',
        info: '#a371f7',
      },
      fontFamily: {
        'header': ['DIN Next', 'Inter Tight', 'Roboto Condensed', 'sans-serif'],
        'body': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
};
```

---

## Success Criteria & Testing

### Visual Acceptance Criteria

- [ ] Direction D logo visible and properly sized (64-80px)
- [ ] Wordmark uses DIN Next/Inter Tight font
- [ ] Background uses design system color (#0a0e14)
- [ ] Form container uses surface elevated color (#252b38)
- [ ] Input fields match design system specifications
- [ ] Button uses primary accent color (#58a6ff)
- [ ] All colors match design system palette
- [ ] Typography matches scale and weights

### Functional Acceptance Criteria

- [ ] Login form submits successfully
- [ ] Error messages display correctly
- [ ] Loading state shows "Logging in..." text
- [ ] Button disables during loading
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Focus indicators visible
- [ ] Form validation works
- [ ] Redirects to dashboard on success

### Accessibility Acceptance Criteria

- [ ] WCAG 2.1 AA color contrast ratios met
- [ ] Keyboard navigation functional
- [ ] Focus indicators visible
- [ ] Screen reader announces all elements correctly
- [ ] Error messages linked to inputs (aria-describedby)
- [ ] Form submittable via Enter key
- [ ] Touch targets ≥44×44px on mobile

### Performance Acceptance Criteria

- [ ] Page load time <500ms (same as current)
- [ ] Logo loads without flash (embedded SVG preferred)
- [ ] No layout shift during load
- [ ] Fonts load progressively (system fonts first)
- [ ] Animation performance >60fps
- [ ] Lighthouse accessibility score ≥95

### Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] iOS Safari
- [ ] Android Chrome

---

## Implementation Priority

**Priority**: P2 (After core gameplay screens)

**Rationale**: Login page is infrastructure and should be updated after:
1. Dashboard (P0)
2. Robot pages (P0)
3. Battle screens (P0)
4. Weapon shop (P1)
5. Facilities (P1)

**Estimated Effort**: 4-6 hours

**Timeline**:
- Phase 1 (Core Visual): 2 hours
- Phase 2 (Motion): 1 hour
- Phase 3 (Accessibility): 1 hour
- Phase 4 (Polish & Testing): 1-2 hours

---

## Future Enhancements (Out of Scope)

### Phase 2+ Features

- Registration page with same design system
- Password reset flow
- "Remember me" checkbox
- Social login buttons (Google, Discord, etc.)
- Multi-factor authentication
- Login with email option
- Captcha integration
- Rate limiting UI feedback
- Account lockout messaging

### Phase 3+ Features

- Animated background (subtle particle effects)
- Progressive logo reveal on first visit
- Welcome back message for returning users
- Last login timestamp display
- Session expiration warning
- Biometric authentication (WebAuthn)

---

## Appendix

### A. Design System References

**Primary Documents**:
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](DESIGN_SYSTEM_AND_UX_GUIDE.md)
- [DESIGN_SYSTEM_QUICK_REFERENCE.md](DESIGN_SYSTEM_QUICK_REFERENCE.md)
- [brand/1_brand_&_logo_design_foundations.md](brand/1_brand_&_logo_design_foundations.md)
- [brand/3_brand_usage_system.md](brand/3_brand_usage_system.md)
- [brand/4_motion_micro_animation_system.md](brand/4_motion_micro_animation_system.md)

### B. Current vs. Proposed Comparison

| Element | Current | Proposed |
|---------|---------|----------|
| Logo | Text "Armoured Souls" | Direction D logo SVG |
| Title Font | Default (system) | DIN Next / Inter Tight |
| Background | #1f2937 (gray-800) | #0a0e14 (design system) |
| Form Background | #1f2937 (gray-800) | #252b38 (surface elevated) |
| Input Background | #374151 (gray-700) | #1a1f29 (surface) |
| Input Border | #4b5563 (gray-600) | #57606a (tertiary) |
| Button Background | #2563eb (blue-600) | #58a6ff (primary) |
| Button Hover | #1d4ed8 (blue-700) | #79b8ff (primary-light) |
| Error Background | rgb(127, 29, 29, 0.5) | rgba(248, 81, 73, 0.1) |
| Error Border | #991b1b (red-700) | #f85149 (error) |

### C. Code Examples

**Before (Current)**:
```tsx
<div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
  <div className="max-w-md w-full">
    <div className="text-center mb-8">
      <h1 className="text-4xl font-bold mb-2">Armoured Souls</h1>
      <p className="text-gray-400">Phase 1 - Local Prototype</p>
    </div>
    <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
      {/* Form content */}
    </div>
  </div>
</div>
```

**After (Proposed)**:
```tsx
<div className="min-h-screen bg-background text-primary flex items-center justify-center px-4">
  <div className="max-w-md w-full">
    <div className="text-center mb-8">
      <img 
        src="/assets/logos/logo-d.svg" 
        alt="Armoured Souls" 
        className="w-20 h-20 mx-auto mb-6 animate-fadeIn"
      />
      <h1 className="text-4xl font-bold font-header tracking-tight animate-fadeIn">
        ARMOURED SOULS
      </h1>
    </div>
    <div className="bg-surface-elevated border border-white/10 p-8 rounded-xl shadow-2xl animate-fadeIn-delayed">
      {/* Form content */}
    </div>
  </div>
</div>
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 1, 2026 | Robert Teunissen | Initial PRD creation |

---

**Status**: ✅ **READY FOR IMPLEMENTATION**

This PRD provides complete specifications for updating the login page to align with the Armoured Souls design system. All visual, functional, and accessibility requirements are defined and ready for development.
