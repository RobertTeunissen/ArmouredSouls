---
inclusion: fileMatch
fileMatchPattern: "app/backend/src/game-engine/**,app/backend/src/services/battle/**,app/backend/src/services/combat/**,app/backend/src/services/matchmaking/**,app/backend/src/services/league/**,app/backend/src/services/tournament/**,app/backend/src/services/economy/**,app/backend/src/services/facility/**,app/backend/src/services/cycle/**,app/backend/src/services/fame/**,app/backend/src/services/team-battle/**,docs/prd_core/**,docs/balance_changes/**"
---

# In-Game Guide Content Maintenance

- When a mechanic, balance value, system behavior, or player-facing feature changes player decisions, update the affected in-game guide article as part of the same change.
- Guide articles are structured backend data. Locate and update the existing article for the affected system; do not duplicate the mechanics catalog here. Use `documentation-workflow.md` for PRDs, architecture/specification documents, API documentation, and implementation notes.
- Explain player-visible effects and relationships, not internal formulas, implementation calculations, or hidden balance constants.
- Keep guide UI aligned with `docs/design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md`.
- After editing an article, update its metadata, verify its behavior claims, and check related links. Preserve the player guide as part of the feature’s definition of done.
