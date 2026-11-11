# PRD: Robot Creation Page

## Route

`/robots/create`

Optional query param: `?onboarding=true` (routes differently after creation)

## Purpose

Allows players to create a new robot by choosing a name and paying the creation cost (₡500,000).

## Flow

1. Player enters robot name (1–50 characters)
2. Player confirms the purchase (balance must be ≥ ₡500,000)
3. Backend creates the robot with all 23 attributes at Level 1, no weapon equipped
4. **Post-creation navigation:**
   - **Normal flow** (`isOnboarding === false`): Navigate to `/robots/:id/setup` with `{ replace: true }` — the Guided Robot Setup Wizard (Spec #47)
   - **Onboarding flow** (`?onboarding=true`): Navigate back to `/onboarding` — the onboarding tutorial manages its own guided steps

## Key Behaviors

- Roster capacity check: player cannot create a robot if their roster is at capacity (Roster Expansion facility level determines cap)
- Insufficient credits: form shows warning, submit button disabled
- Name validation: 1–50 characters, trimmed, server-side uniqueness check per user
- The robot creation endpoint (`POST /api/robots`) uses `lockUserForSpending` for race-condition protection

## Post-Creation Wizard (Spec #47)

After normal creation, the player lands on a short setup that makes the robot battle-ready:
1. Portrait selection (optional)
2. Weapon: equip a spare one or buy and equip, one click
3. Team (optional, only for stables with 2+ robots)
4. Event subscriptions, pre-ticked with the solo events, one click

The setup is skippable at any point and each step commits immediately. Stance, yield, tuning and upgrades are in the Workshop, where the setup ends. See `PRD_ROBOT_SETUP_WIZARD.md` for full details.

Layout: page title `h1`, one panel (`bg-surface`, `border-white/10`), primary **Create Robot** and secondary **Cancel** buttons in the Workshop style; a server error is an `error` notice, too few credits a `warning` notice.

## Related Pages

- `/robots/:id/prepare` — Robot Workshop (destination after the setup completes or is skipped)
- `/robots/:id/setup` — Setup Wizard Page
- `/robots` — Robots List (destination for browser-back from wizard due to `replace: true`)
- `/onboarding` — Onboarding tutorial (destination for onboarding-path creation)
