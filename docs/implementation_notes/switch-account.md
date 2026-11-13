# Switch Account

## Overview

ACC players commonly run several stables, each of which is a separate account
(username + password). Switch Account lets a signed-in player hop to another
account they have logged into — from the desktop navbar account menu or the
mobile "More" drawer — without manually logging out and back in every time.

This is a **client-side convenience**, not a server-side multi-session system.

## How it works

Authentication is a single JWT held in `localStorage['token']`, rehydrated by
`AuthContext`. Switching is a scripted token swap:

1. **Remembering accounts.** On a successful login (and on a successful switch),
   `AuthContext` records the account in a saved-accounts list under a dedicated
   key, `armouredsouls.savedAccounts` (module `utils/savedAccounts.ts`). Entries
   are `{ userId, label, username, token }`, deduped by `userId`, most-recent
   first. The active-session key `token` is never overloaded.
2. **Switching.** `AuthContext.switchAccount(account)` clears the outgoing
   session's cached Zustand stores (robots, stable) exactly as `logout` does,
   writes the saved token into `localStorage['token']`, updates context, and
   re-reads `GET /api/user/profile` to rehydrate the user. On success the navbar
   routes to `/dashboard`.
3. **Add account.** "Add account" clears the active session and shows the login
   form, so the player can authenticate as a different (or new) stable; that
   login then adds the account to the saved list.

## Expired / revoked token fallback

A saved JWT is best-effort. It can be:

- **expired** (24h lifetime), or
- **revoked** by a `tokenVersion` bump (e.g. after a password change), or
- rejected because the account became an `automaton` stable.

In all these cases the backend answers the profile read with `401`. `switchAccount`
then tears the half-applied session down with `logout()`, drops the dead entry from
the saved list, and rejects. The navbar handler catches that rejection and sends the
player to the login form to authenticate as that account again. No stale session or
cross-account store data is left behind.

## UI

- **Desktop:** `components/nav/AccountMenu.tsx` — a hover/click dropdown in the
  top-right of `Navigation.tsx`. The open menu shows the current stable name, the
  other saved accounts to switch to, "Add account", and "Logout". The trigger is
  👤 ▾ only (narrower than the old Logout button) because the desktop top bar has
  no spare width below ~1536px: anything wider pushed the row into horizontal
  overflow at the 1280px E2E viewport. The stable name is added beside the icon
  on `2xl` screens and is always in the trigger's accessible label and tooltip.
- **Mobile:** the same actions in the `MobileDrawer` "Settings & Admin" section,
  threaded from `Navigation` via `onSwitchAccount` / `onAddAccount` props
  (mirroring the existing `onLogout`).

## Non-goals (explicit)

- **No server-side multi-session management.** There is no refresh token, no
  session table, and no backend logout endpoint. The server cannot list or revoke
  a specific device's session beyond the existing per-user `tokenVersion` lever.
- **No concurrent active sessions in one tab.** Exactly one account is active at a
  time; switching replaces the active token.
- Saved tokens live in `localStorage` like the active token, so the trust boundary
  is unchanged from today's single-token model.

## Related code

- `app/frontend/src/utils/savedAccounts.ts` — storage layer (pure, injectable).
- `app/frontend/src/contexts/AuthContext.tsx` — `switchAccount`, account remembering.
- `app/frontend/src/components/nav/AccountMenu.tsx` — desktop menu.
- `app/frontend/src/components/nav/MobileDrawer.tsx` — mobile drawer wiring.
- `app/frontend/src/components/Navigation.tsx` — switch/add handlers and fallback.
