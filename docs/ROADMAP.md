# Armoured Souls — Roadmap

**Last Updated**: April 9, 2026  
**Version**: 5.0

For what's been built, see [CHANGELOG.md](CHANGELOG.md).  
For concrete items to be specced, see [BACKLOG.md](BACKLOG.md).  
For game design details, see [GAME_DESIGN.md](game-systems/GAME_DESIGN.md).  
For architecture details, see [ARCHITECTURE.md](architecture/ARCHITECTURE.md).

## Version History

| Version | Date | Changes |
|---|---|---|
| 5.0 | April 9, 2026 | Split into ROADMAP.md (forward-looking) and CHANGELOG.md (history). Added Robot Image Upload to queued specs. |
| 4.1 | April 9, 2026 | Added 12 missing April specs (18 total). Updated Phase 2 completed items. Documentation audit done. |
| 4.0 | April 2, 2026 | Complete rewrite. Concise phase summary replacing 1200-line log. |
| 3.0–3.2 | Feb 2026 | Milestone tracking, economy system gap identified. |
| 1.0–2.0 | Jan 2026 | Initial roadmap, milestone progress. |

---

## Current Status

Phase 1 (prototype) is feature-complete and deployed. Phase 2 (production hardening) is in progress.

---

## Queued Specs (Ready to Build)

| # | Spec | Summary |
|---|---|---|
| 8 | Battle Replay/Revert Admin | Admin tool to revert and replay buggy battles from the current cycle |
| 9 | Web Push Notifications | Browser push notifications for battle results and cycle events |
| 20 | Robot Image Upload | User-uploaded robot portraits with NSFW moderation |

---

## Phase 2 — Production Hardening (In Progress)

Focused on making the deployed application production-grade.

### Remaining Work
- See [BACKLOG.md](BACKLOG.md) — Phase 2 items listed under "Production Hardening"

### Not Planned
- Microservices extraction (monolith is appropriate at current scale)

---

## Future Phases (Not Yet Scoped)

These are directional ideas, not commitments. Items from the "deferred" list have been placed where they'd naturally fit.

- **Phase 3 — Player Growth**: OAuth social login, web push notifications, player referral/invite system
- **Phase 4 — Social**: Friends, guilds, chat, spectating
- **Phase 5 — Economy Expansion**: Trading/marketplace, player-to-player transactions
- **Phase 6 — Scale & Infrastructure**: AWS migration, Redis caching, WebSocket real-time updates
- **Phase 7 — Mobile**: PWA or React Native mobile app
- **Phase 8 — Monetization**: Cosmetics, premium currency, battle passes
- **Phase 9 — Advanced Game Modes**: 3v3, battle royale, story mode

---

