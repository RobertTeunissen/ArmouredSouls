# Review: Player-Facing and Admin Text

**Status**: Approved — 8 Oct 2026, together with both mockups, including every change made after approval (decisions 20–37 and the consistency fixes, §6.2–§6.7).
**Scope**: every label and description that spec 55 adds or changes, and how the new elements look. Robot names and stable names (and the admin-only franchise and backstory) are in `CATALOGUE.md`; strategy display names and descriptions are in `STRATEGIES.md`.
**Mockups**: `../mockups/player-pages.html` (badge and every player page that changes) and `../mockups/admin-automatons.html` (the admin page). Open them in a browser; each page is shown at mobile (360 px) and desktop width.
**House style**: plain, direct English, no exclamation marks, "₡" for credits.

---

## 1. The Automaton badge

The badge is a label, not an explanation: it says "Automaton" and nothing more. There is no tooltip.

| Item | Value |
|---|---|
| Label | **Automaton** |
| Tooltip | none |
| Accessible name | "Automaton" (the visible label; the icon is decorative and hidden from screen readers) |
| Icon | Gear (cog), drawn as an inline SVG in the `AutomatonBadge` component. No image file, no external icon library (the frontend has none today), no designer needed. |
| Colour | The existing `info` purple from the theme (`--color-info: #a371f7` in `app/frontend/src/index.css`): purple text and icon, a 15% purple tint as background, a 40% purple border. No new colour token. |
| Shape | Rounded pill, the same height and padding as the existing "YOU" badge on leaderboards (`text-xs px-2 py-0.5 rounded`). |
| Sizes | `md` (12 px text) next to names in headers, banners and table rows; `sm` (10 px text, uppercase) in the dense season-archive tables, matching the existing "bot" chip there. |
| Compact (mobile) | In rows, tables and battle banners narrower than 640 px the badge shows only the gear (same purple pill, no text), so stable names stay readable at 360 px instead of being cut down to a few letters. The page headers (stable profile, robot detail owner) have room and keep the full label. The word "Automaton" stays in the page, visually hidden, so screen readers still announce it. |
| Contrast | Purple text on the badge background is at least 4.5:1 (checked in the component test). |
| Placement | Always on the same line, directly after the stable name, like "YOU". It never wraps onto a line of its own: on narrow screens it switches to the compact gear (see above); if a name is still too long, the name is shortened with "…"; in headings the badge stays attached to the last word of the name. No extra border or frame around it. |

Why purple: blue is taken by links and the "YOU" badge, grey by the existing "bot" chip, and green/amber/red by results and warnings. Purple is the one theme colour with no competing meaning in these places.

Where the badge appears (mockup section in brackets):

| Surface | Component | Position |
|---|---|---|
| Leaderboards (Fame, Prestige, Losses) | `OwnerNameLink` | after the stable name, before a "YOU" badge if both apply (A) |
| League standings | `OwnerNameLink` | after the owner name (B) |
| Hall of Records (every record that names a stable: stable records, robot records "Robot by Stable", battle details, team line-ups, tournament champions) | `OwnerNameLink` (stable records), `RecordStableName` (all other records) | after the stable name (B) — changed after approval (decision 42, approved 10 Oct 2026) |
| Stable profile page | `StableViewPage.tsx` | after the stable name in the header (C) |
| Robot detail page | `RobotDetailPage.tsx` | after the owner name in the robot header (D) |
| Battle report | `BattleResultBanner.tsx`, `TeamBattleMetrics.tsx` | after the owning stable's name under each robot (E) |
| Season archive | `SeasonArchivePage.tsx` | after the stable name (not the robot name), `sm` size (F) |

On the robot detail page the owner name is currently plain text; it stays plain text and the badge sits next to it.

Existing auto-generated bots (`auto_*` stables and seeded test stables) keep their current presentation; they do not get the Automaton badge.

- [x] Approved — 8 Oct 2026

---

## 2. Stable profile page

The stable profile page stays exactly as it is for every stable. The only addition for an Automaton is the badge after the stable name (mockup section C). No franchise line and no backstory are shown on any player-facing page (decided).

Franchise and backstory still exist as admin-only fields on each Automaton profile, so the content is ready when franchises and backstories are added for all stables later (`docs/BACKLOG.md` #61). A backstory is in-world flavour text about the stable as a whole (who they are and how they fight), not a biography of a person. The strategy name is not shown to players either (decided). (Changed after approval, decision 22: "bio" renamed "backstory".)

- [x] Approved — 8 Oct 2026

---

## 3. Battle reports, leaderboards and combat text

- No new text in battle reports or combat messages. Automaton robots appear under their blueprint names (e.g. "CT-7567 Rex lunges with Laser Pistol…") exactly like human robots.
- The badge (§1) is the only marker.
- Automatons appear in every leaderboard, standing, tournament bracket and Hall of Records list on the same terms as human stables.
- In the Hall of Records every record that names an Automaton stable shows the badge after the stable name, combat and other robot records included, as in mockup section B ("Megatron by Decepticon Armada"). (Changed after approval, decision 42, approved 10 Oct 2026: the badge was first limited to the economic and prestige records.)

- [x] Approved — 8 Oct 2026

---

## 4. Season archive

Archived Automaton stables show the `sm` badge directly after the stable name (mockup section F). The existing "bot" and "system" chips for auto-generated and system subjects stay as they are. An archived Automaton stable shows "Automaton", not "bot".

- [x] Approved — 8 Oct 2026

---

## 5. Player guide

No in-game guide article is added and no existing article changes (decided). Automatons add no player choice.

Achievements: Automatons earn achievements like any stable and are re-granted the "complete onboarding" achievement each season like humans (decided). No player-facing text is needed.

---

## 6. Admin page text

Admin text is only visible to administrators, but it is still human-facing, so it is listed here. An Automaton acts once per cycle (after each daily settlement, including the preparation days), so the admin page speaks of **cycles**, not turns.

### 6.1 Navigation and page

| Item | Draft text |
|---|---|
| Navigation entry (section "Player Management") | 🤖 Automatons |
| Page title | Automaton Stables |
| Page subtitle | Computer-run stables that build and upgrade themselves after each settlement. |
| Status bar | Shown above the tabs on every tab (§6.2) |
| Tabs | Stables · Strategies · Editor · Catalogue |

### 6.2 Status bar (above the tabs, on every tab)

| Item | Draft text |
|---|---|
| Program switch label | Automatons act each cycle |
| Switch state | On / Off — Automatons buy nothing; their robots keep fighting their current events |
| Turn-off confirmation | Stop all Automatons? Their robots keep fighting, but no Automaton will buy, upgrade or re-subscribe anything until you turn this back on. |
| Turn-off buttons | Cancel · Stop Automatons (added after approval, consistency fix) |
| Last acted | Last acted: {turn} · {date, time} · {n} stables · {s} s — or "Never" before the first settlement. {turn} is Cycle {n} after a daily settlement, Prep {n} after preparation day {n}, or Season start after a season opens. (Changed after approval, consistency fix.) |
| Failures | Failed last cycle: None / {n} stables (red, links to the Stables tab filtered on Needs attention) |
| Attention | Needs attention: {n} stables → (links to the Stables tab filtered on Needs attention) / All OK |

### 6.3 Stables tab

| Column | Draft label |
|---|---|
| Stable | Stable |
| Strategy | Strategy |
| Status | Status (Draft / Active) |
| Robots | Robots (current / target) |
| Credits | Credits |
| Prestige | Prestige |
| Best tier | Best tier |
| Last cycle | Last cycle (e.g. "Bought 1 · saving for Robot 4"; "Not active yet" for a draft) (changed after approval, consistency fix) |
| Needs attention | Needs attention (reason, or "—") |

Filter chips (with counts): All · Active · Draft · Needs attention. Button: **Activate all drafts**, with confirmation: "Activate {n} draft stables? Each one joins the game with ₡3,000,000 and starts building after the next settlement. Activation cannot be undone."

Footnote under the table: "A stable needs attention when its last cycle failed, its balance is negative, or it has bought nothing for 14 cycles or more."

Needs-attention reasons (a stable can have several; shown in this order):

| Reason | Shown when |
|---|---|
| Last cycle failed: {error code} | its most recent cycle record has status Failed |
| Balance negative | its credits are below ₡0 |
| Nothing bought for {n} cycles | its last 14 or more completed cycles contain no purchase |

### 6.4 Strategies tab

| Item | Draft text |
|---|---|
| Header line | Season {n} · cycle {c} of {length} · averages over active stables |
| Columns | Strategy · Stables · Robots (avg / target) · Prestige (avg) · Best tier reached · Credits (avg) · Win rate vs humans |
| Win-rate cell | {p}% · {w}–{l}–{d} of {total} (or "—" when there are no battles yet) |
| Reference row | Human stables (reference) — same columns; win rate "—" |
| Footnote | Best tier reached: the highest league tier any robot or team of the strategy currently holds in any mode, with the number of stables at that tier. Win rate: wins ÷ all head-to-head battles against humans this season (1v1, 2v2 and 3v3 leagues and tournaments, Tag Team); byes, King of the Hill and Grand Melee are not counted. |
| Row click | Opens the Stables tab filtered on that strategy |
| View switch (Strategies tab) | Comparison · Library |

### 6.4a Strategy Library (Strategies tab → Library) — added after approval (decision 20)

| Item | Draft text |
|---|---|
| Heading | Strategy library |
| Explainer | Every strategy and version in the repository. Stables stay on their version until you upgrade them. New strategies reach stables through a pull request. |
| Card title | {display name} · v{n} (latest) / v{n} |
| Card line | {description} |
| Stables per version | {n} stables on v{v} |
| Build order (expand) | Show build order / Hide build order — numbered list: # · Goal · Default target · Allowed {min}–{max} · What it buys |
| Buttons | New strategy · New version · Upgrade stables |
| Upgrade dialog title | Upgrade {display name} stables to v{n} |
| Upgrade dialog choice | This stable: {stable name} / All {n} stables on v{old} |
| Upgrade dialog table | Goal · Old target · New target (marked "new goal", "clamped" or "removed") |
| Upgrade dialog confirm | Upgrade {n} stables. Changes apply from the next settlement. |
| Upgrade dialog note | Shown for {stable name}; each stable keeps its own targets. Changes apply from the next settlement. (Added after approval, consistency fix.) |
| Upgrade dialog: profile fails validation | {stable name}: not upgraded — {error text}, where {error text} is the "Error: too few blueprints" or "Error: team names count" text of §6.5. (Added after approval, consistency fix.) |
| Upgrade dialog buttons | Cancel · Upgrade {n} stables (added after approval, consistency fix) |
| Upgrade dialog: some stables fail | {n} of {total} stables can be upgraded. The others stay on v{old} until fixed; you will get an alert for each. The button upgrades the {n}. (Added after approval, decision 37.) |
| Upgrade result | Upgraded {n} stables to v{v}. Not upgraded: {stable name} ({error text}) · … (Added after approval, decision 37.) |
| Upgrade done | Upgraded {n} stables to v{v}. |

### 6.4b Strategy Builder — added after approval (decision 20)

| Item | Label | Help text |
|---|---|---|
| Heading | Strategy builder | |
| Start | New strategy (blank) · New version of {display name} | |
| Key | Strategy key | Permanent identifier, lowercase letters, digits and hyphens. A new version keeps the key. |
| Version | Version | Set automatically: v1 for a new strategy, the next number for a new version. |
| Display name | Display name | Shown on the admin page only. |
| Description | Description | One or two sentences on how this strategy spends. |
| Goal list | Build order | Goal 1 is bought first. The last goal is always "Attributes → Max". Every goal type is needed at least once. (Changed after approval, decision 29.) |
| Add goal | Add goal | Robots · Facility ({facility}) · Attributes · Weapons · Refine |
| Row buttons | Move up · Move down · Remove | (accessible names include the goal: "Move up: 4 Booking Office") |
| Default target | Default | Allowed {min}–{max} |
| Bounds | Allowed range | {limit} at most for this goal type |
| Refine target | {n} steps | Refinement steps per robot, applied in each robot's plan order; 10 is every step ("all"). Allowed 0–10. (Added after approval, decision 36.) |
| Rule errors (next to the goal) | | Needs a robots goal above it. · Booking Office cannot go above L6. · Refine allows 0–10 steps (added after approval, decision 36). · Default is outside the allowed range. · The last goal must be "Attributes → Max". · 40 goals at most. · Key "{key}" already exists. (Changed after approval, decision 36.) |
| Rule errors (above the build order) | | Every strategy needs a {goal type} goal with a default above 0. ({goal type}: Robots, Attributes, Weapons, Refine, Repair Bay, Training Facility, Weapons Workshop, Booking Office, Merchandising Hub, Streaming Studio or Tuning Bay.) (Added after approval, decision 29.) |
| Preview | Preview draft | |
| Preview: stable picker | Preview on | {stable name} |
| Preview: fresh stable | New stable with ₡3,000,000 would buy first: | numbered list of purchases with cost |
| Preview footer | This is a preview. Nothing has been bought and no stable uses this draft. | |
| Save | Save draft | |
| Delete | Delete draft | Delete draft "{display name}"? This cannot be undone. |
| Export | Export strategy file | Export is disabled while the draft has errors ({n}). (Changed after approval, consistency fix.) |
| Export done | Exported {key}.v{n}.json. Ask a developer to run `pnpm run automaton:unpack` and open a pull request; the strategy appears here after it is merged and deployed. | |
| Upgrade warning (new version only) | These stables could not be upgraded to this version yet: {stable name} ({error text}) · … Fix them in the Editor before you upgrade. | Shown in the builder and after export; export is still possible. (Added after approval, decision 37.) |
| Drafts list | Drafts on this environment | Drafts are never used by a stable. Each draft shows {n} errors or ready to export. (Changed after approval, consistency fix.) |

- [x] Approved — 8 Oct 2026
- [x] Approved — 8 Oct 2026 (§6.4b help text and rule error, decision 29; recorded by the document header approval, which covers decisions 20–37 and the consistency fixes)
- [x] Approved — 8 Oct 2026 (§6.2, §6.3, §6.4a and §6.4b consistency fixes; recorded by the document header approval, which covers decisions 20–37 and the consistency fixes)
- [x] Approved — 8 Oct 2026 (§6.4b Refine target and rule error, decisions 35–36; recorded by the document header approval, which covers decisions 20–37 and the consistency fixes)

### 6.5 Editor tab

| Field | Label | Help text |
|---|---|---|
| Catalogue key | Catalogue key | Permanent identifier used for export and sync. Lowercase letters, digits and hyphens. Cannot be changed later. |
| Stable name | Stable name | Shown to players. Same rules as player stable names. |
| Franchise | Franchise | Admin only. Used to group stables here; not shown to players. |
| Backstory | Backstory | Admin only for now; not shown to players. Up to 400 characters. (Changed after approval, decision 22.) |
| Event order | Event order | All 9 event types in order of preference. Team events are entered by a whole team or not at all. (Added after approval, decision 26.) |
| Event order: buttons | Move up · Move down | Accessible names include the position and event, e.g. "Move up: 3 3v3 League". (Added after approval, decision 26.) |
| Strategy | Strategy | How this stable spends its credits. Shown as "{display name} · v{n}"; when a newer version exists: "v{m} available — upgrade in the Strategy library". (Added after approval, decision 20.) |
| Build order | Build order | What this stable buys, in order of priority: goal 1 first. Change a target to tune it; the order comes from the strategy. Changes apply from the next settlement. |
| Build order: target | (inline field per goal) | Allowed {min}–{max}; "Max" on the last attributes goal; "{n} steps" on a refine goal (Allowed 0–10; changed after approval, decision 36) |
| Build order: attributes plan | Show plan / Hide plan | Plan for Attributes → {target} (groups in Build Focus order; ▸ academy bought on the way). Per robot: groups in priority order with their targets. (Changed after approval, consistency fix.) |
| Team names | Team names | Names for the teams this stable forms: robots 1+2, 3+4 … in 2v2; 1–3, 4–6, 7–9 in 3v3. A team that already exists keeps its name. (Changed after approval, decision 23.) |
| Team state | Formed · Waits for robot {n} | Robot 11 is in no team; robots 10 and 11 are in no 3v3 team. (Added after approval, decision 23.) Collapsed (below 768 px): {team names}: Formed · {n} more wait for robots (next: {team name}, robot {n}) (changed after approval, consistency fix). |
| Blueprint header | {slot} · {robot name} — {loadout} · {stance} · {build focus} · range {range} (from weapons) · in play / not bought yet | (Added after approval, consistency fix.) |
| Collapsed list | + {n} more blueprints | (Added after approval, consistency fix.) |
| Blueprint: name | Robot name | Used when this robot is next bought. Renaming does not rename a robot that already exists. |
| Blueprint: image | Image | 512×512 image. Changes apply to the live robot straight away. Button: Upload image (changed after approval, consistency fix). |
| Add blueprint | Add blueprint | Next free slot, 11 at most. (Added after approval, consistency fix.) |
| Delete blueprint | Delete blueprint | Disabled while a robot built from it is in play. (Added after approval, consistency fix.) |
| Delete blueprint confirmation | Delete blueprint {slot} · {robot name}? This cannot be undone. | (Added after approval, consistency fix.) |
| Blueprint: loadout, stance, yield | Loadout · Stance · Yield threshold | |
| Blueprint: Build_Focus | Build focus | How this robot spends attribute upgrades and tuning. |
| Blueprint: weapon path | Weapon path | Weapons this robot buys, in order. One column per hand: Main hand, and Shield or Off hand when the loadout has one. Both hands may hold different weapons. |
| Blueprint: range (read-only) | Range | From the weapons: "{range}" — or for two different weapons "{range} ({weapon} has the higher damage per second)", or for two different weapons with equal damage per second "{range} (equal damage per second; the main hand decides)". (Tie wording changed after approval, decision 25.) |
| Blueprint: refinements | Refinement plan | Applied in order to the weapons of the last stage; at most 5 steps per weapon. Each row: {step} · {weapon} ({hand}) · {tier} (for Hone and Augment: {attribute} +{magnitude}) · ₡{cost} · needs Workshop L{n}. (Changed after approval, decisions 35–36.) |
| Error: refinement plan | Every weapon of the last stage except a shield needs at least one refinement step: {weapon} ({hand}). · {weapon} ({hand}) has more than 5 refinement steps. · {weapon} ({hand}) is not in the last stage. | (Added after approval, decision 35.) |

Buttons and confirmations:

| Item | Draft text |
|---|---|
| Stable picker | Editing: {stable name} (Draft / Active) (added after approval, consistency fix) |
| New stable | New stable — catalogue key, stable name and strategy are required (added after approval, consistency fix) |
| Delete draft stable | Delete draft stable (enabled for drafts only, disabled for an active stable) (added after approval, consistency fix) |
| Delete draft confirmation | Delete draft {stable name}? This cannot be undone. A stable from a catalogue file comes back as a draft at the next sync. (Added after approval, consistency fix.) |
| Save | Save changes |
| Activate | Activate stable |
| Activate confirmation | Activate {stable name}? It joins the game with ₡3,000,000 and starts building after the next settlement. Activation cannot be undone. |
| Activate buttons | Cancel · Activate stable (added after approval, consistency fix) |
| Preview | Preview next cycle (refreshes the statuses in the build order) |
| Preview header | If settlement ran now, {stable name} would: |
| Preview gated line | Gated further down: goal {n} ({facility} L{l}) … — each needs {p} prestige. (Added after approval, consistency fix.) |
| Preview footer | This is a preview. Nothing has been bought. |
| Export | Export |
| Error: too few blueprints | Goal {n} targets {t} robots, but this stable has {b} blueprints. Add blueprints or lower the target. (Added after approval, decision 24.) |
| Error: team names count | This stable needs {a} team names for 2v2 and {b} for 3v3. (Added after approval, decision 23.) |
| Live robot note (blueprint with a live robot) | A robot built from this blueprint is in play. Its name will not change; other changes apply from the next settlement. This blueprint cannot be deleted while the robot exists. |
| Cycle history heading | Cycle history. Cycle column: Cycle {n} shown as {n} · Prep {n} · Season start (changed after approval, consistency fix) |

### 6.6 Build order statuses (preview and cycle history)

Each goal row in the Build order shows one status, worked out by the preview:

| Status | Look | Example detail |
|---|---|---|
| Done | grey ✓ | has 3 robots |
| Done (useful level) | grey ✓ | Booking Office: L4 is enough; no robot can enter more than 7 event types (changed after approval, decision 26) |
| Bought | green | Bought Booking Office L1 for ₡75,000 |
| Saving | amber, row highlighted (this is where the Automaton stops this cycle) | needs ₡1,118,000, has ₡316,000 |
| Blocked | red 🔒 | Roster Expansion L4 needs 1,000 prestige (has 640) |
| Waiting | grey | below the goal it is saving for |
| Waiting, gated | grey with 🔒 | will be blocked when reached: Repair Bay L4 needs 1,000 prestige |

Legend under the build order: Done · Bought · Saving — stops here this cycle · Blocked 🔒 skipped, gated · Waiting 🔒 will be blocked when reached. (Added after approval, consistency fix.)

Blocked reasons: "{facility} L{n} needs {p} prestige (has {q})" (also when the facility is a prerequisite, e.g. an academy for an attributes goal), "facility at max level", "roster full", "no blueprint for robot {n}", "waiting for final weapon", "storage full at Storage Facility L10, nothing to sell", "no free name for robot {n}". A Storage Facility level behind a prestige gate shows the prestige reason. (Changed after approval, consistency fix.)

Cycle status labels: Completed · Skipped (Automatons stopped) · Failed — with the error code.

There is no aggregated "Saving" or "Blocked" count anywhere on the page: those outcomes only mean something per stable, so they appear in the Editor (preview and cycle history) and in the Stables tab's "Last cycle" column.

### 6.7 Catalogue tab

| Item | Draft text |
|---|---|
| Heading | Catalogue |
| Explainer | Catalogue files in the repository are added here as drafts on every deploy. Existing stables are never overwritten. Use Export to turn stables built here into catalogue files. |
| Sync status | Last sync: {time} · Added {n} · Already present {n} · Images filled {n} · Conflicts {n} (changed after approval (decision 28): "Images filled {n}" added; it counts the blueprints of existing stables that had no image and received their repository image; approved 8 Oct 2026) |
| Conflict row | {catalogue key}: stable name "{name}" is already taken. Skipped. |
| Export buttons | Export this stable · Export all |

- [x] Approved — 8 Oct 2026 (§6.7 sync status, decision 28)
- [x] Approved — 8 Oct 2026 (§6.5 and §6.6 consistency fixes; recorded by the document header approval, which covers decisions 20–37 and the consistency fixes)
- [x] Approved — 8 Oct 2026 (§6.5 build order target, refinement plan row and refinement plan errors, decisions 35–36; recorded by the document header approval, which covers decisions 20–37 and the consistency fixes)

### 6.8 Analytics filter

| Item | Current | Draft |
|---|---|---|
| Filter options in `AdminFilterBar` | Real Players · Auto-Generated · All | Real Players · Auto-Generated · Automatons · All |
| "Real Players" help text | — | Human players only. Excludes auto-generated bots and Automatons. |

- [x] Approved — 8 Oct 2026
