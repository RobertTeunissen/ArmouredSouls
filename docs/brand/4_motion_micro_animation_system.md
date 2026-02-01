# Armoured Souls — Motion & Micro-Animation System (Step 4)

## Purpose
This document defines **how motion is used** in Armoured Souls to reinforce:
- Mastery
- Pride
- Control

Motion is not decorative.  
Motion communicates **state, consequence, and escalation**.

---

## Core Motion Philosophy

Armoured Souls is a **managerial, system-first game**.

Therefore:
- Motion is **deliberate**
- Motion is **contained**
- Motion is **earned**

If motion draws attention to itself, it is wrong.

---

## Global Motion Principles (Non-Negotiable)

1. **No idle motion**
   - Nothing animates “just to feel alive”
   - Motion must respond to user action or system state

2. **Motion follows hierarchy**
   - Infrastructure → minimal
   - Management → subtle
   - Competition → focused
   - Resolution → expressive (but brief)

3. **Energy is internal, not explosive**
   - Especially for logos
   - Inner glow > outer glow
   - Expansion > burst

---

## Motion States & Their Meaning

### 1. Infrastructure Motion (Direction D)

**Context**
- Login
- Loading
- Empty states
- App initialization

**Purpose**
- Reassure
- Signal readiness
- Avoid urgency

**Rules**
- Slow, linear fades
- No scale changes
- No bounce or overshoot
- Duration: 200–300ms

**Logo Behavior**
- Direction D only
- Fade in / fade out
- Never pulses
- Never glows

---

### 2. Management Motion (Direction B)

**Context**
- Stable overview
- Robot lists
- Facilities
- Upgrades
- Economy screens

**Purpose**
- Reinforce control
- Confirm decisions
- Avoid distraction

**Rules**
- Subtle transitions only
- Easing: ease-out, never elastic
- Movement distance minimal (2–6px)
- Duration: 150–250ms

**Logo Behavior**
- Direction B is static
- No animation on page transitions
- Appears instantly (or simple fade)

---

### 3. Focused Interaction Motion (Direction B → C boundary)

**Context**
- Pre-battle setup
- Arena entry
- Match start confirmation

**Purpose**
- Signal rising stakes
- Shift mental mode

**Rules**
- One directional movement (inward or upward)
- No rotation
- Slight scale-in allowed (≤ 1.05×)
- Duration: 250–400ms

**Logo Behavior**
- Direction B may transition to C
- Transition must feel like **activation**, not replacement
- Geometry does not move; energy appears inside

---

### 4. Resolution Motion (Direction C)

**Context**
- Victory
- Loss
- Promotion
- Championship
- Major unlock

**Purpose**
- Deliver pride or consequence
- Mark the moment clearly
- Then release the player back to control

**Rules**
- Motion is brief and decisive
- One expressive beat only
- Duration: 400–600ms total
- Must settle into stillness quickly

**Logo Behavior**
- Direction C only
- Inner glow intensifies briefly, then stabilizes
- No looping
- No shake
- No fireworks

---

## Logo Motion Rules (Authoritative)

### Allowed
- Fade
- Scale-in (≤ 5%)
- Inner glow ramp-up
- Opacity-based reveal

### Forbidden
- Rotation
- Bounce
- Elastic easing
- Continuous pulsing
- Particle effects
- Screen shake

If it feels like a slot machine or an arcade cabinet, it is invalid.

---

## Timing & Easing (Baseline)

These are **guidelines**, not final pixel values.

- Ease-out for almost everything
- Linear only for loading
- Never use ease-in-out for logos (feels indecisive)

Suggested easing keywords:
- `ease-out`
- `cubic-bezier(0.2, 0.8, 0.2, 1)`

---

## Sound & Motion Relationship (Forward-Looking)

When sound is added:
- Sound may reinforce motion
- Motion must never wait for sound
- Victory sound = short, resolved
- Loss sound = muted, contained

No overlapping stingers.

---

## Accessibility & Motion Reduction

- Respect system “reduced motion” preferences
- In reduced motion mode:
  - Replace movement with fades
  - Remove scale changes
  - Keep durations short

Motion must never be required to understand state.

---

## Anti-Patterns (Explicitly Forbidden)

- Idle glowing logos
- Animated navbars
- Hover-driven logo motion
- Attention-seeking micro-animations
- Motion that delays user input

---

## Brand Integrity Check

Before adding motion, ask:

> “Does this motion reinforce mastery and consequence,  
> or is it trying to entertain?”

If it is the latter, remove it.

---

## Status

- Motion philosophy: **LOCKED**
- Motion states: **LOCKED**
- Logo motion rules: **LOCKED**

Next step: asset production or UI integration.
