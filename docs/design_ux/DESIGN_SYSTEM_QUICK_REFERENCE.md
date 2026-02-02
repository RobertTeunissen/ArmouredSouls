# Design System Quick Reference for Developers

**Last Updated**: February 1, 2026  
**Purpose**: Quick lookup guide for implementing visual design

---

## 📚 Full Documentation

- **Comprehensive Guide**: [DESIGN_SYSTEM_AND_UX_GUIDE.md](DESIGN_SYSTEM_AND_UX_GUIDE.md) - Complete specifications
- **Alignment Check**: [DESIGN_DOCUMENTATION_ALIGNMENT.md](DESIGN_DOCUMENTATION_ALIGNMENT.md) - Consistency verification
- **Brand Strategy**: [/docs/brand/](./brand/) - 5 brand documents (foundation, type, logo, usage, motion)

**Use this for quick lookups. Refer to full documentation for detailed specifications.**

---

## 🎨 Logo Usage (Quick Rules)

### When to Use Each Logo Variant

| Context | Logo Variant | File | Description |
|---------|-------------|------|-------------|
| **Navigation** (all pages) | Direction B | `logo-b.svg` | Precision, management |
| **Login, Loading** | Direction D | `logo-d.svg` | Minimal, infrastructure |
| **Battle Screens** (future) | Direction C | `logo-c.svg` | Energized, emotional |

**Rule**: Use Direction B by default. Direction C is earned (battles only). Direction D is for infrastructure.

---

## 🖼️ Image Sizes (Quick Reference)

### Robot Portraits

| Context | Size | Format | Usage |
|---------|------|--------|-------|
| Thumbnail | 64×64px | PNG/WebP | Leaderboards, small lists |
| Card | 256×256px | PNG/WebP | Dashboard, Robots page |
| Hero | 512×512px | PNG/WebP | Robot Detail, battle screens |

### Weapon Illustrations

| Context | Size | Format | Usage |
|---------|------|--------|-------|
| Thumbnail | 128×128px | PNG/WebP | Robot Detail weapon slots |
| Card/Catalog | 256×256px | PNG/WebP | Weapon Shop, Inventory |

### Icons

| Type | Size | Format | Usage |
|------|------|--------|-------|
| Action Icons | 20×20px | SVG | Edit, delete, view buttons |
| Navigation Icons | 24×24px | SVG | Nav menu |
| Attribute Icons | 24×24px | SVG | Robot attributes |
| Type/Category Icons | 32×32px | SVG | Weapon types, attribute categories |
| Currency Icons | 24px (inline), 48px (prominent) | SVG | Credits, Prestige |

### Facility Illustrations

| Context | Size | Format | Usage |
|---------|------|--------|-------|
| Card | 256×256px | PNG/WebP | Facilities page |

---

## 🎨 Color Palette (Quick Reference)

### Base Colors

```css
/* Copy these to your Tailwind config or CSS */
--background: #0a0e14;        /* Deep space black */
--surface: #1a1f29;            /* Dark panel */
--surface-elevated: #252b38;   /* Raised cards */
--text-primary: #e6edf3;       /* Off-white */
--text-secondary: #8b949e;     /* Gray */
--text-tertiary: #57606a;      /* Muted gray */
```

### Accent Colors

```css
--primary: #58a6ff;      /* Cyan-blue - actions, links */
--success: #3fb950;      /* Green - HP healthy, success */
--warning: #d29922;      /* Amber - HP medium, caution */
--error: #f85149;        /* Red - HP critical, errors */
--info: #a371f7;         /* Purple - prestige, special */
```

### Category Colors (Attributes)

```css
--combat: #f85149;       /* Red - Combat Systems */
--defense: #58a6ff;      /* Blue - Defensive Systems */
--chassis: #3fb950;      /* Green - Chassis & Mobility */
--ai: #d29922;           /* Yellow - AI Processing */
--team: #a371f7;         /* Purple - Team Coordination */
```

### HP Bar Colors

```css
/* Apply based on HP percentage */
100-70%: #3fb950 (Green - Healthy)
69-30%:  #d29922 (Amber - Warning)
29-1%:   #f85149 (Red - Critical)
<10%:    #f85149 (Red - Flashing)
```

---

## 📝 Typography (Quick Reference)

### Font Stack

```css
/* Logo & Headers */
font-family: 'DIN Next', 'Inter Tight', 'Roboto Condensed', sans-serif;

/* UI & Body */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Typography Scale

| Element | Class (Tailwind) | Size | Weight |
|---------|-----------------|------|--------|
| Logo | `text-4xl font-bold` | 36px | Bold |
| H1 Page Title | `text-3xl font-bold` | 30px | Bold |
| H2 Section Title | `text-2xl font-bold` | 24px | Bold |
| H3 Subsection | `text-xl font-medium` | 20px | Medium |
| Body | `text-base` | 16px | Regular |
| Label | `text-sm font-medium` | 14px | Medium |
| Small | `text-xs` | 12px | Regular |

---

## 🎬 Motion (Quick Rules)

### Do's ✅

- Fade transitions (200-300ms)
- Subtle hover lifts (2px, 150ms)
- Smooth HP bar fills (300ms)
- Scale-in modals (250ms, max 1.05×)

### Don'ts ❌

- ❌ No idle animations (pulsing, spinning)
- ❌ No bouncy effects (elastic easing)
- ❌ No rotation (except loading spinners)
- ❌ No outer glows on logos
- ❌ No screen shake

### Easing

```css
/* Use these */
ease-out               /* General transitions */
cubic-bezier(0.2, 0.8, 0.2, 1)  /* Custom ease-out */

/* Avoid */
ease-in-out           /* Feels indecisive */
elastic               /* Too playful */
```

### Respect Reduced Motion

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

## 🧩 Component Patterns (Quick Templates)

### Card Component

```jsx
<div className="bg-surface-elevated border border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow">
  {/* Thumbnail/Portrait */}
  <img src={portrait} alt={name} className="w-64 h-64 mx-auto" />
  
  {/* Title */}
  <h3 className="text-xl font-bold text-primary mt-4">{name}</h3>
  <p className="text-sm text-secondary">{subtitle}</p>
  
  {/* Status/Metadata */}
  <div className="mt-4 space-y-2">
    {/* HP Bar, stats, etc. */}
  </div>
  
  {/* Actions */}
  <div className="mt-4 flex gap-2">
    <button className="btn-primary">Action</button>
  </div>
</div>
```

### HP Bar Component

```jsx
<div className="w-full">
  <div className="flex justify-between text-sm text-secondary mb-1">
    <span>HP</span>
    <span>{currentHP}/{maxHP}</span>
  </div>
  <div className="w-full h-6 bg-surface rounded-full overflow-hidden">
    <div 
      className={`h-full transition-all duration-300 ${getHPColor(percentage)}`}
      style={{ width: `${percentage}%` }}
    />
  </div>
</div>

// Helper function
function getHPColor(percent) {
  if (percent >= 70) return 'bg-success';
  if (percent >= 30) return 'bg-warning';
  return 'bg-error';
}
```

### Button Component

```jsx
// Primary Button
<button className="bg-primary hover:bg-primary-light text-white font-medium px-6 py-3 rounded-lg transition-colors">
  Action
</button>

// Secondary Button
<button className="border border-primary text-primary hover:bg-primary/10 font-medium px-6 py-3 rounded-lg transition-colors">
  Cancel
</button>

// Icon Button
<button className="p-2 hover:bg-surface-elevated rounded-lg transition-colors">
  <Icon className="w-5 h-5" />
</button>
```

### Modal Component

```jsx
<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
  <div className="bg-surface max-w-2xl w-full rounded-xl shadow-2xl p-6 animate-scale-in">
    {/* Close Button */}
    <button className="absolute top-4 right-4 p-2 hover:bg-surface-elevated rounded">
      <X className="w-5 h-5" />
    </button>
    
    {/* Title */}
    <h2 className="text-2xl font-bold mb-4">{title}</h2>
    
    {/* Content */}
    <div className="mb-6">
      {children}
    </div>
    
    {/* Actions */}
    <div className="flex justify-end gap-2">
      <button className="btn-secondary">Cancel</button>
      <button className="btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

---

## 📁 Asset File Naming (Convention)

### Recommended Structure

```
/assets/
  /logos/
    logo-b.svg              (Direction B)
    logo-c.svg              (Direction C)
    logo-d.svg              (Direction D)
    logo-d-16.png           (Favicon 16×16)
    logo-d-32.png           (Favicon 32×32)
    logo-d-512.png          (PWA icon)
  
  /robots/
    portrait-humanoid-256.webp
    portrait-humanoid-512.webp
  
  /weapons/
    weapon-laser-rifle-256.webp
    weapon-laser-rifle-128.webp
    weapon-plasma-cannon-256.webp
    weapon-plasma-cannon-128.webp
    weapon-ion-beam-256.webp
    weapon-ion-beam-128.webp
    weapon-machine-gun-256.webp
    weapon-machine-gun-128.webp
    weapon-railgun-256.webp
    weapon-railgun-128.webp
    weapon-shotgun-256.webp
    weapon-shotgun-128.webp
    weapon-power-sword-256.webp
    weapon-power-sword-128.webp
    weapon-hammer-256.webp
    weapon-hammer-128.webp
    weapon-plasma-blade-256.webp
    weapon-plasma-blade-128.webp
    weapon-combat-shield-256.webp
    weapon-combat-shield-128.webp
    weapon-practice-sword-256.webp
    weapon-practice-sword-128.webp 
  
  /facilities/
    facility-repair-bay-256.webp
    facility-training-facility-256.webp
  
  /icons/
    /attributes/
      attr-combat-power.svg
      attr-armor-plating.svg
      attr-hull-integrity.svg
    /categories/
      cat-combat-systems.svg
      cat-defensive-systems.svg
    /navigation/
      nav-dashboard.svg
      nav-robots.svg
      nav-weapon-shop.svg
    /actions/
      action-edit.svg
      action-delete.svg
      action-view.svg
    /currency/
      currency-credits.svg
      currency-prestige.svg
```

**Naming Pattern**: `{type}-{name}-{size}.{ext}`

---

## ✅ Pre-Implementation Checklist

Before implementing a new page or component, verify:

### Brand Alignment
- [ ] Does this reinforce **mastery and pride**?
- [ ] Does this avoid **anime/whimsy aesthetics**?
- [ ] Is the **correct logo variant** used (B, C, or D)?

### Visual Consistency
- [ ] Colors from **Design System palette**?
- [ ] Typography from **hierarchy scale**?
- [ ] Icons are **SVG** (not PNG)?
- [ ] Images are **WebP** (with PNG fallback)?

### Motion
- [ ] Motion **responds to user action**?
- [ ] Duration is **150-300ms** (not longer)?
- [ ] Easing is **ease-out** (not elastic)?
- [ ] **`prefers-reduced-motion`** respected?

### Performance
- [ ] Images **optimized** (compressed)?
- [ ] SVGs **minified**?
- [ ] No **synchronous loading** blocking render?
- [ ] Lazy load **below-the-fold** images?

---

## 🚨 Common Mistakes to Avoid

1. **❌ Using Direction C logo in navigation**
   - ✅ Use Direction B for all persistent UI

2. **❌ Adding idle animations (pulsing logos, spinning icons)**
   - ✅ Only animate on user action or state change

3. **❌ Using random colors not in palette**
   - ✅ Stick to defined color system

4. **❌ PNG icons instead of SVG**
   - ✅ Use SVG for all icons (scalable, small size)

5. **❌ Outer glows on logos or text**
   - ✅ Inner glows only, and only for Direction C

6. **❌ Long animation durations (>500ms)**
   - ✅ Keep animations brief (150-300ms)

7. **❌ Mixing font families**
   - ✅ DIN/Inter Tight for headers, Inter for body

8. **❌ Uncompressed images**
   - ✅ Use WebP format, compress aggressively

---

## 📞 When in Doubt

1. **Check the comprehensive guide**: [DESIGN_SYSTEM_AND_UX_GUIDE.md](DESIGN_SYSTEM_AND_UX_GUIDE.md)
2. **Verify alignment**: [DESIGN_DOCUMENTATION_ALIGNMENT.md](DESIGN_DOCUMENTATION_ALIGNMENT.md)
3. **Review brand docs**: [/docs/brand/](./brand/)
4. **Ask**: "Does this reinforce mastery, pride, and ownership?"

---

## 📊 Implementation Priority

### Phase 1 (MVP - P0)
1. Direction B logo in navigation
2. Robot portraits (card + hero sizes)
3. Weapon illustrations
4. HP/Shield status bars
5. Currency icons

### Phase 2 (Polish - P1)
6. Attribute icons (23)
7. Facility illustrations (14)
8. Weapon type icons (4)
9. Navigation icons
10. Direction D logo (login/loading)

### Phase 3 (Future - P2)
11. Direction C logo (battle screens)
12. Battle-ready poses
13. Arena backgrounds
14. ELO/League badges

**Start with Phase 1. Don't skip ahead. Update what's already there**

---

## 🎯 Key Principles (Remember These)

1. **Player is Manager** - UI reinforces control and mastery
2. **Direction B is Default** - Precision logo for management
3. **No Idle Motion** - Motion only on action or state change
4. **Dark Industrial Theme** - Metallic, serious, engineered
5. **HP Color Coding** - Green (safe), Amber (warning), Red (critical)
6. **Contained Energy** - Inner glows, not outer explosions
7. **Brief Emotional Peaks** - Direction C only for battles/results
8. **Typography Hierarchy** - DIN for headers, Inter for body
9. **SVG for Icons** - Always. PNG only for photos/illustrations
10. **Optimize Everything** - WebP, compression, lazy loading

---

## 📝 Quick Copy-Paste Snippets

### Tailwind Config (Colors)

```js
// tailwind.config.js
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
        success: '#3fb950',
        warning: '#d29922',
        error: '#f85149',
        info: '#a371f7',
        combat: '#f85149',
        defense: '#58a6ff',
        chassis: '#3fb950',
        ai: '#d29922',
        team: '#a371f7',
      },
    },
  },
}
```

### CSS Animation Classes

```css
/* Add to index.css or globals.css */
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-scale-in {
  animation: scale-in 250ms ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fade-in 200ms ease-out;
}
```

---

## 🤖 Robot Detail Page Components

### Robot Header (PUBLIC - All Users)

```jsx
<div className="bg-surface-elevated rounded-lg p-6 mb-6">
  {/* Robot Portrait */}
  <div className="flex items-start gap-6">
    <img 
      src={robot.imageUrl} 
      alt={robot.name}
      className="w-32 h-32 rounded-lg border-2 border-primary/30"
    />
    
    {/* Robot Info */}
    <div className="flex-1">
      <h1 className="text-3xl font-bold mb-2">{robot.name}</h1>
      <p className="text-secondary mb-4">Owner: {robot.owner}</p>
      
      {/* Stats Row */}
      <div className="flex gap-6 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-tertiary">League:</span>
          <span className="badge badge-league">{robot.league}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-tertiary">ELO:</span>
          <span className="text-primary font-bold">{robot.elo}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-tertiary">Record:</span>
          <span className="font-medium">{robot.wins}W / {robot.losses}L</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Section Visibility Rules

```jsx
// Check if current user owns the robot
const isOwner = currentUser.id === robot.ownerId;

// Render sections conditionally
{isOwner && (
  <>
    <BattleConfiguration robot={robot} />
    <EffectiveStatsOverview robot={robot} />
    <UpgradeRobot robot={robot} />
  </>
)}

// Always visible sections
<RobotHeader robot={robot} />
<PerformanceStatistics robot={robot} />
```

### Decimal Formatting Rules

```jsx
// Utility functions for attribute display
function formatBaseAttribute(value) {
  return Math.floor(value); // Always integer
}

function formatWeaponBonus(value) {
  return Math.floor(value); // Always integer
}

function formatEffectiveStat(value) {
  // 2 decimal places for calculated stats
  return value.toFixed(2);
}

// Example usage
<div className="attribute-row">
  <span>Base: {formatBaseAttribute(100)}</span>
  <span>Weapon: +{formatWeaponBonus(20)}</span>
  <span>Effective: {formatEffectiveStat(132.50)}</span>
</div>
```

---

## ⚔️ Battle Result Format

### Compact Battle Card (Dashboard, Lists)

```jsx
<div className="bg-surface-elevated rounded-lg p-4 border-l-4 border-success">
  <div className="flex items-center gap-4">
    {/* Robot Portraits */}
    <div className="flex gap-2">
      <img src={myRobot.portrait} className="w-12 h-12 rounded" />
      <span className="text-tertiary self-center">vs</span>
      <img src={opponent.portrait} className="w-12 h-12 rounded" />
    </div>
    
    {/* Battle Info */}
    <div className="flex-1">
      <p className="font-bold text-success">VICTORY</p>
      <p className="text-sm text-secondary">{myRobot.name} vs {opponent.name}</p>
      <p className="text-xs text-tertiary">League Match • Jan 15, 2026</p>
    </div>
    
    {/* Rewards */}
    <div className="text-right">
      <p className="text-success">+25 ELO</p>
      <p className="text-sm text-secondary">+₡1,000</p>
    </div>
    
    {/* Action */}
    <button className="btn-secondary btn-sm">
      View Details →
    </button>
  </div>
</div>
```

### Battle Result Colors

```jsx
// Border and text colors based on result
const resultStyles = {
  victory: {
    border: 'border-success',
    text: 'text-success',
    bg: 'bg-success/10'
  },
  defeat: {
    border: 'border-error',
    text: 'text-error',
    bg: 'bg-error/10'
  },
  draw: {
    border: 'border-warning',
    text: 'text-warning',
    bg: 'bg-warning/10'
  }
};
```

### Detailed Battle Log Header

```jsx
<div className="bg-surface-elevated rounded-lg p-6 mb-6">
  {/* Battle Type Badge */}
  <div className="flex items-center justify-between mb-4">
    <span className="badge badge-primary">League Match</span>
    <span className="text-sm text-tertiary">Battle #12345 • Jan 15, 2026</span>
  </div>
  
  {/* Result Banner */}
  <div className="text-center py-8 bg-success/10 rounded-lg mb-6">
    <h1 className="text-4xl font-bold text-success mb-2">VICTORY</h1>
    <p className="text-secondary">Battle completed in 45 seconds</p>
  </div>
  
  {/* Participants */}
  <div className="grid grid-cols-2 gap-6">
    {/* Winner */}
    <div className="text-center">
      <img src={winner.portrait} className="w-48 h-48 mx-auto rounded-lg mb-4" />
      <h3 className="text-xl font-bold">{winner.name}</h3>
      <p className="text-secondary">{winner.owner}</p>
      <div className="mt-2">
        <span className="text-success font-bold">+25 ELO</span>
        <span className="text-tertiary mx-2">•</span>
        <span className="text-success">+₡1,000</span>
      </div>
    </div>
    
    {/* Loser */}
    <div className="text-center opacity-70">
      <img src={loser.portrait} className="w-48 h-48 mx-auto rounded-lg mb-4" />
      <h3 className="text-xl font-bold">{loser.name}</h3>
      <p className="text-secondary">{loser.owner}</p>
      <div className="mt-2">
        <span className="text-error font-bold">-18 ELO</span>
        <span className="text-tertiary mx-2">•</span>
        <span className="text-error">Repair: ₡500</span>
      </div>
    </div>
  </div>
  
  {/* League Change (if applicable) */}
  {leagueChange && (
    <div className="mt-4 text-center">
      <div className="inline-block bg-success/20 text-success px-4 py-2 rounded-lg">
        ✨ PROMOTED to Silver League!
      </div>
    </div>
  )}
</div>
```

---

## 🏆 League Standings Format

### League Standings Table Row

```jsx
<div className={`
  bg-surface-elevated rounded-lg p-4 mb-2 
  ${isOwnRobot ? 'border-2 border-primary bg-primary/5' : ''}
  ${isPromotionZone ? 'border-l-4 border-l-success' : ''}
  ${isDemotionZone ? 'border-l-4 border-l-error' : ''}
`}>
  <div className="flex items-center gap-4">
    {/* Rank */}
    <div className="w-12 text-center">
      {rank <= 3 ? (
        <span className={`text-2xl ${getRankMedalColor(rank)}`}>
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
        </span>
      ) : (
        <span className="text-xl font-bold text-tertiary">#{rank}</span>
      )}
    </div>
    
    {/* Robot Portrait */}
    <img 
      src={robot.portrait} 
      alt={robot.name}
      className="w-16 h-16 rounded border border-primary/30"
    />
    
    {/* Robot Info */}
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <h3 className="font-bold">{robot.name}</h3>
        {isOwnRobot && (
          <span className="badge badge-primary text-xs">MY ROBOT</span>
        )}
      </div>
      <p className="text-sm text-secondary">{robot.owner}</p>
    </div>
    
    {/* Stats */}
    <div className="flex gap-6 text-center">
      <div>
        <p className="text-sm text-tertiary">ELO</p>
        <p className="font-bold text-primary">{robot.elo}</p>
      </div>
      <div>
        <p className="text-sm text-tertiary">LP</p>
        <p className="font-bold">{robot.leaguePoints}</p>
      </div>
      <div>
        <p className="text-sm text-tertiary">Record</p>
        <p className="font-medium">{robot.wins}-{robot.losses}</p>
      </div>
    </div>
    
    {/* Recent Form */}
    <div className="flex gap-1">
      {robot.recentForm.map((result, i) => (
        <span 
          key={i}
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
            ${result === 'W' ? 'bg-success text-black' : 
              result === 'L' ? 'bg-error text-white' : 
              'bg-warning text-black'}`}
        >
          {result}
        </span>
      ))}
    </div>
  </div>
</div>
```

### League Navigation Tabs

```jsx
<div className="flex gap-2 mb-6 overflow-x-auto">
  {leagues.map(league => (
    <button
      key={league.id}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
        ${activeLeague === league.id 
          ? 'bg-primary text-white' 
          : 'bg-surface-elevated hover:bg-surface text-secondary'}
      `}
      onClick={() => setActiveLeague(league.id)}
    >
      <img src={league.icon} className="w-6 h-6" />
      <span className="font-medium">{league.name}</span>
      {hasRobotsInLeague(league.id) && (
        <span className="badge badge-sm">{getRobotCount(league.id)}</span>
      )}
    </button>
  ))}
</div>
```

### Own Robot Highlight Styles

```css
/* Add to your CSS */
.own-robot-row {
  background: linear-gradient(90deg, rgba(88, 166, 255, 0.15) 0%, transparent 100%);
  border: 2px solid #58a6ff;
  position: relative;
}

.own-robot-row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: #58a6ff;
}
```

---

**Version**: 1.0 (February 1, 2026)  
**Maintained By**: Design Team / Frontend Developers
