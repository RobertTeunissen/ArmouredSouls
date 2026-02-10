# Armoured Souls — Brand Usage System (Step 3)

## Purpose
This document defines **where**, **when**, and **how** each Armoured Souls logo variant is used.

It translates brand strategy into **operational UX rules** so that:
- Emotional weight is preserved
- Logos are never misused
- Frontend implementation is unambiguous
- The brand scales across web, mobile, and future platforms

This document is **authoritative**.

---

## Logo Variants (Recap)

Armoured Souls uses **one logo family** with three controlled states:

- **Direction B — Core (Precision / Engineering)**
- **Direction C — Energized (Soul / Pride)**
- **Direction D — Minimal (Icon / Infrastructure)**

These are **states**, not different logos.

---

## Global Rule (Non-Negotiable)

> **Direction B is the default.**  
> Direction C is earned.  
> Direction D is infrastructural.

If there is doubt, **use Direction B**.

---

## 1. Logo Usage Matrix (Authoritative)

### Direction B — Core (Primary Identity)

**Usage**
- App navbar (top-left)
- Stable overview
- Robot lists
- Facility management
- Economy, contracts, upgrades
- Settings and profile
- Any persistent UI

**Emotional Intent**
- Control
- Mastery
- Ownership

**Player Message**
> “You are managing a serious system.”

**Baseline Technical Specs**
- Format: **SVG (primary)**, WebP fallback
- Aspect ratio: horizontal wordmark
- Height:
  - Minimum: **24px**
  - Preferred: **32–40px**
- Color:
  - Light UI → dark logo
  - Dark UI → light logo
- Effects:
  - ❌ No glow
  - ❌ No animation
  - ❌ No texture noise

---

### Direction C — Energized (Emotional Peaks Only)

**Usage**
- Arena entry
- Match start
- Match result (win or loss)
- Promotions, league changes
- Championships
- Major unlocks or milestones

**Emotional Intent**
- Pride
- Emotional bond
- Significance

**Player Message**
> “This moment matters.”

**Baseline Technical Specs**
- Format: **SVG + WebP**
- Geometry: **identical to Direction B**
- Height:
  - Minimum: **48px**
  - Preferred: **64–120px**
- Effects:
  - ✅ Inner glow allowed
  - ❌ Outer glow forbidden
  - ❌ Geometry distortion forbidden
- Persistence:
  - Must never appear in navigation
  - Must never remain on screen longer than the moment warrants

---

### Direction D — Minimal (Infrastructure / Scale)

**Usage**
- Login screen (compact)
- Loading screens
- Empty states
- Mobile headers
- Favicon / PWA icon
- Browser tab / app switcher

**Emotional Intent**
- Confidence
- Seriousness
- Calm entry

**Player Message**
> “You are entering an established system.”

**Baseline Technical Specs**
- Format: **SVG + PNG**
- Aspect ratio: square
- Required sizes (prepare upfront):
  - 16×16
  - 32×32
  - 48×48
  - 64×64
- Visual rules:
  - Must work monochrome
  - No texture dependency
  - No glow
  - Flat rendering only

---

## 2. Brand State Ladder (Visual Escalation)

Armoured Souls uses **controlled visual escalation**.

| State | Logo Variant | Description |
|----|----|----|
| Infrastructure | D | System-level, neutral |
| Management | B | Default operational mode |
| Focused | B | Same logo, stronger UI contrast |
| High Stakes | C | Emotional activation |
| Resolution | C | Victory / loss clarity |

Skipping levels is forbidden.

---

## 3. UX Placement Rules (Hard Constraints)

### Allowed
- Direction B in all persistent UI
- Direction C only at defined emotional peaks
- Direction D in dense or infrastructural contexts

### Forbidden
- ❌ Direction C in navigation
- ❌ Direction D as primary brand mark
- ❌ Mixing variants in the same view
- ❌ Decorative logo use without meaning

---

## 4. Accessibility & Contrast

All logo variants must:
- Meet WCAG AA contrast standards
- Remain legible at minimum sizes
- Never rely on glow for readability

If contrast fails, the logo variant is invalid in that context.

---

## 5. Implementation Notes (Frontend)

- Treat logo variants as **explicit components**, not styles
  - `<LogoCore />`
  - `<LogoEnergized />`
  - `<LogoMinimal />`
- Variant choice must be intentional, not responsive-driven
- Responsive scaling adjusts size, **not variant**

---

## 6. What Is Explicitly Out of Scope (For Now)

The following are **not defined yet** and must not be improvised:

- Exact pixel sizes per breakpoint
- Motion timing and easing
- Glow intensity values
- Marketing compositions

These will be defined after UI layouts stabilize.

---

## Status

- Typography: **LOCKED**
- Geometry: **LOCKED**
- Usage rules: **LOCKED**

Next step: motion, UI integration, and asset production.
