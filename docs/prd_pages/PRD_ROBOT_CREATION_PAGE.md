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

After normal creation, the player lands on a 7-step setup wizard that guides them through:
1. Portrait selection
2. Weapon equip (buy if needed)
3. Stance + yield threshold
4. Tuning allocation
5. Team assignment
6. Event subscriptions
7. Attribute upgrades

The wizard is skippable at any point. Each step commits immediately. See `PRD_ROBOT_SETUP_WIZARD.md` for full details.

## Related Pages

- `/robots/:id` — Robot Detail Page (destination after wizard completes)
- `/robots/:id/setup` — Setup Wizard Page
- `/robots` — Robots List (destination for browser-back from wizard due to `replace: true`)
- `/onboarding` — Onboarding tutorial (destination for onboarding-path creation)
