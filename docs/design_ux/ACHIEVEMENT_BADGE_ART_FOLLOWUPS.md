# Achievement Badge Art — Open Fixes

**Status:** open · **Checked:** November 4, 2026 (PR #577) · **Guide:** [ACHIEVEMENT_BADGE_ART_GUIDE.md](ACHIEVEMENT_BADGE_ART_GUIDE.md)

All 135 achievements have a badge in `app/frontend/src/assets/achievements/`. Every file is a 128×128 WebP named `achievement-<id>-128.webp`. Every new, redone and recoloured badge was checked against its tier in `app/backend/src/config/achievements.ts`. The badges listed below are the only ones still to fix.

## Wrong tier colour — 4

These four changed tier during the Season 1 calibration. The art was made with the old colour. The subject is fine, so only the colour needs to change (use the recolour prompt in the guide, Part 4).

| File ID | Name | Tier | Art now | Needs |
|---|---|---|---|---|
| e27 | Better, Stronger, Faster | Easy | blue | emerald green |
| e28 | Back to the Future | Easy | blue | emerald green |
| e33 | Merchandising! | Easy | blue | emerald green |
| e35 | Ain't Nobody Got Time for That | Hard | green | amber orange |

## Optional — 3

| File ID | Name | Issue | Suggested fix |
|---|---|---|---|
| l8 | WALL-E and EVE | Recoloured to blue correctly, but still shows the Pixar characters (copyright risk, guide Part 3) | Two small generic robots of very different builds holding hands |
| c18 | Autobots, Roll Out! | Still the Transformers-style face above a truck cab (copyright risk, guide Part 3) | A semi-truck grille splitting open into robot shoulders, no faction emblem |
| p7 | Legendary Status | The art contains the words "LEGENDARY STATUS"; the style block says no text | Same star plaque without lettering |

## Check after replacing

- Same file name and path, 128×128, WebP.
- Accent colour matches the tier: easy green, medium blue, hard orange, secret purple.
- Run `pnpm run build` in `app/frontend`; the bundle should contain 135 `achievement-*` assets.
