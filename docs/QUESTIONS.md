# Armoured Souls - Planning Questions

This document tracks remaining open questions and decisions needed for the project. All answered questions have been removed to avoid redundancy - refer to the respective documentation files for implemented decisions.

**Last Updated**: January 24, 2026  
**Current Phase**: Phase 1 - Local Prototype (Basic Setup Complete)

---

## ✅ RECENT DECISIONS (January 24, 2026)

The following decisions were made during documentation review and have been implemented in the relevant documentation:

1. **Backend Framework**: Express (chosen for simplicity and larger ecosystem) - See ARCHITECTURE.md
2. **ORM/Migrations**: Prisma (better TypeScript support, easier migrations) - See ARCHITECTURE.md, MODULE_STRUCTURE.md
3. **Real-time Features**: WebSockets/Web Push API for notifications across platforms; batch processing for battle computation - See ARCHITECTURE.md
4. **Phase Structure**: Consolidated to single system in ROADMAP.md (Phase 0-9); MODULE_STRUCTURE.md references ROADMAP.md
5. **Battle Schedule (Prototype)**: Manual trigger for Phase 1, scheduled processing in later phases - See PHASE1_PLAN.md
6. **Authentication (Prototype)**: Basic username/password with admin user to test the flow - See PHASE1_PLAN.md
7. **Documentation Dates**: Standardized to January 24, 2026 across all documents
8. **UI Component Library**: Tailwind CSS (lightweight, utility-first, good for prototyping) - See ARCHITECTURE.md
9. **Project Structure**: Isolated prototype codebase in `/prototype` directory - See PHASE1_PLAN.md
10. **Development Style**: Async - AI builds, Robert reviews
11. **Prototype Testing**: 6 test user accounts for local testing
12. **Prototype Scope**: Robot creation, battle simulation, results viewing, user management, stable management, robot upgrading (currency system), battle history - all text-based, no animations
13. **Currency System**: Credits (₡) as currency name, starting balance of ₡1,000,000 - See ROBOT_ATTRIBUTES.md
14. **Attribute System**: 23 robot-themed attributes grouped into Weapons Systems (6), Defensive Systems (5), Chassis & Mobility (5), AI Processing (4), Team Coordination (3) - See ROBOT_ATTRIBUTES.md
15. **Upgrade Costs**: Formula-based: (level + 1) × 1,000 Credits (e.g., 1→2 costs ₡2,000) - See ROBOT_ATTRIBUTES.md
16. **Robot Frame Cost**: ₡500,000 for bare metal robot with all attributes at 1 - See ROBOT_ATTRIBUTES.md
17. **Weapon System**: Weapons cost ₡100,000-₡400,000 and provide attribute bonuses, required for battles - See ROBOT_ATTRIBUTES.md
18. **Battle Mechanics**: Hit chance, critical hits, and miss chance based on attribute formulas - See ROBOT_ATTRIBUTES.md
19. **Repair Costs**: Based on total attribute sum × damage percentage - See ROBOT_ATTRIBUTES.md
20. **Battle Rewards**: ELO-based system with league multipliers, covers repair costs 90% of time - See ROBOT_ATTRIBUTES.md
21. **ELO System**: Standard ELO with K-factor 32, starting at 1200 - See ROBOT_ATTRIBUTES.md
22. **RNG Seed**: Battle ID + timestamp (sufficient for Phase 1) - See ROBOT_ATTRIBUTES.md
23. **Team Dynamics**: Added Team Coordination attributes (Sync Protocols, Support Systems, Formation Tactics) for arena/multi-robot battles - See ROBOT_ATTRIBUTES.md
24. **AI Focus**: Renamed "Mental" to "AI Processing" emphasizing autonomous intelligence - See ROBOT_ATTRIBUTES.md
25. **Robot-Themed Names**: All attributes reference robot parts (Servo Motors, Hydraulic Power, Armor Plating, etc.) - See ROBOT_ATTRIBUTES.md

---

## 🔄 OPEN QUESTIONS

**All Phase 1 setup questions have been answered and documented in ROBOT_ATTRIBUTES.md**

No open questions at this time. All design decisions for Phase 1 have been finalized.

---

## ⚪ DEFERRED TO LATER PHASES

All questions related to the following features are deferred as they are post-MVP:
- Economy and currency system (Phase 2-3)
- Trading and marketplace (Post-MVP, Phase 6+)
- Tournament system (Post-MVP, Phase 5-6)
- Guild system and social features (Post-MVP)
- Advanced matchmaking algorithms (Phase 2+)
- Team battles (Post-MVP)
- Conditional triggers (Post-MVP)
- Analytics and metrics (Phase 6+)
- Content moderation (Phase 6+)
- Marketing and launch strategy (Phase 6-7)
- Legal and administrative setup (Phase 6+)

**Note**: Specific questions for these features have been removed from this document to avoid redundancy. They will be addressed when we reach the relevant development phase.

---

**Document Status**: ✅ CLEANED AND CONSOLIDATED  
**Last Updated**: January 24, 2026  
**Maintainer**: Keep this document minimal - only active questions that need decisions  
**Rule**: Once answered, move decisions to the appropriate documentation file and remove from here
