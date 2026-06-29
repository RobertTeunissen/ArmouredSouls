# Free-for-All / Battle Royale — Future Game Mode Analysis

**Status**: ✅ Phase 1 shipped (Spec #44, 20 robots per match, June 2026)  
**Depends on**: 2D Combat Arena (`.kiro/specs/2d-combat-arena/`)  
**Date**: March 16, 2026

---

## Concept

A large-scale elimination mode where many robots (up to 100) fight in a single arena. Last robot standing wins. Optional shrinking arena boundary forces engagements over time.

## Format Options

- **Small FFA**: 8–16 robots, standard arena, pure elimination
- **Medium FFA**: 16–32 robots, large arena, optional shrinking boundary
- **Battle Royale**: 50–100 robots, massive arena, mandatory shrinking boundary

## Arena Scaling

Using the 2D arena spec formula: radius = 16 + (total robots − 2) × 3

| Robots | Arena Radius | Diameter | Starting Distance (approx) |
|--------|-------------|----------|---------------------------|
| 8 | 34 | 68 | ~60 units |
| 16 | 58 | 116 | ~100 units |
| 32 | 106 | 212 | ~180 units |
| 50 | 160 | 320 | ~280 units |
| 100 | 310 | 620 | ~540 units |

**Problem**: At 100 robots, the arena is so large that melee robots spend 30+ seconds just walking toward anyone. A shrinking boundary is likely mandatory for 50+ robot matches.

## Phase Analysis: What Happens in a 100-Robot FFA

### Early Game — Chaos and Clustering
- 100 robots all pick targets via threatAnalysis
- Low threatAnalysis robots pick the nearest opponent and beeline toward them
- High threatAnalysis robots evaluate the field and pick weaker targets
- Natural clusters of 2–3 robots fighting each other form while others are still crossing the arena
- Melee robots are at a huge disadvantage — they need to close 300+ units of distance while taking chip damage from ranged robots during the approach

### Mid Game — The Vulture Problem
- Smart robots (high combatAlgorithms + high threatAnalysis) realize the optimal strategy is to NOT engage
- Let everyone else fight, wait for them to weaken each other, then pick off survivors
- A fast ranged robot with high AI attributes orbits the edges, avoids fights, and only engages damaged targets
- This is the "third party" problem every battle royale has

### Late Game — Survivor's Advantage
- Robots that avoided early fights are at full HP/shields against battered survivors
- Adaptive AI (Req 7) helps survivors somewhat — they've accumulated Adaptation_Bonus from damage taken
- But they're still at a massive HP disadvantage against fresh vultures

## Who's Favored?

The optimal FFA build is NOT the same as the optimal 1v1 build:

### Tier 1 — Vulture Build (Strongest)
- High servoMotors (stay away from everyone)
- Long-range weapon (sniper/railgun)
- High threatAnalysis (know when to engage and when to run)
- High combatAlgorithms (smart target selection, movement prediction)
- Moderate defenses (survive incidental damage)
- **Strategy**: Avoid fights, orbit edges, pick off weakened targets

### Tier 2 — Tank Build (Strong)
- High hullIntegrity + armorPlating + shieldCapacity + powerCore
- Mid-range weapon (doesn't need to close distance, doesn't need to stay far)
- Moderate AI attributes
- **Strategy**: Absorb damage from multiple attackers, outlast glass cannons

### Tier 3 — Melee Brawler (Disadvantaged)
- High servoMotors + hydraulicSystems
- Melee weapon with high burst damage
- **Problem**: Closing 300+ units of distance while 10 other robots shoot at you is brutal
- **Problem**: By the time you reach anyone, you've already taken significant damage
- The melee closing bonus and servo strain help in 1v1, but in FFA there's always another ranged robot shooting from a different angle

## Shrinking Arena (Battle Royale Mechanic)

For 50+ robot matches, a shrinking boundary is likely mandatory to prevent stalling:

- Arena starts at full size
- After an initial grace period (e.g., 30 seconds), the boundary begins shrinking at a steady rate
- Robots outside the shrinking boundary take damage over time (environmental damage, bypasses shields and armor)
- Shrink rate should be tuned so the arena reaches melee-range size by ~75% of the max battle duration
- This forces ranged robots into close quarters eventually, giving melee builds a late-game window
- The shrinking boundary can be implemented using the arena zones system (Req 16, AC 4) — the "safe zone" shrinks while the "damage zone" grows

### Shrink Schedule Example (100 robots, 310 radius)

| Time | Arena Radius | Effect |
|------|-------------|--------|
| 0–30s | 310 | Full size, grace period |
| 30–60s | 200 | Outer robots forced inward |
| 60–90s | 100 | Clusters merge, fights intensify |
| 90–120s | 30 | Close quarters, melee viable |
| 120–150s | 10 | Final showdown, everyone in melee range |

## The Vulture Problem — Potential Solutions

The biggest design challenge: passive play (avoiding fights) is the optimal strategy.

### Option A: Aggression Incentive
- Robots that haven't dealt damage in X seconds receive a debuff (reduced shields, reduced armor)
- Forces engagement without dictating who to fight
- Risk: punishes legitimate repositioning

### Option B: Bounty System
- Each kill grants a small HP/shield heal (e.g., 10% of max HP restored)
- Rewards aggressive play and creates a snowball for fighters
- Natural counter to vultures: fighters heal, vultures don't
- Risk: could make early aggression too strong

### Option C: Visibility Mechanic
- Robots that haven't attacked recently become "marked" — visible to all opponents with a targeting bonus
- Punishes hiding without directly damaging the robot
- High threatAnalysis robots can detect marked opponents from further away

### Option D: Shrinking Arena Only
- Don't add any anti-passive mechanic — let the shrinking arena force engagements naturally
- Simplest solution, least design risk
- May still allow vulturing in the mid-game before the arena shrinks enough

**Recommendation**: Start with Option D (shrinking arena only) for the initial implementation. Add Option B (bounty/heal on kill) if playtesting shows vulturing is still dominant.

## Performance Considerations

100 robots creates computational challenges:

| Operation | Per Step (0.1s) | Notes |
|-----------|----------------|-------|
| Threat calculations | 100 × 99 = 9,900 | Each robot evaluates all opponents |
| Movement calculations | 100 | Independent movement per robot |
| Distance calculations | 100 × 99 / 2 = 4,950 | Pairwise distances |
| Attack resolution | ~10–20 | Only robots with ready cooldowns |
| Flanking evaluation | Variable | Only when multiple attackers share a target |

**Mitigation strategies**:
- Spatial partitioning (grid or quadtree) to limit threat evaluation to nearby robots only
- Threat_Score caching — only recalculate when a robot takes significant damage or moves substantially
- Reduce simulation step frequency for distant robots (robots >50 units from any opponent can update at 0.5s instead of 0.1s)
- Consider a maximum battle duration shorter than the standard 120s for large FFAs

---

## Scaling Architecture Analysis

**Date**: June 2026  
**Context**: The current production environment is a Scaleway DEV1-S (2 vCPU, 2 GB RAM, 20 GB SSD) running Node.js (PM2), PostgreSQL (Docker), and Caddy on a single box. The combat simulator is a synchronous, CPU-bound pure function (`simulateBattleMulti`) that blocks the event loop during execution. For KotH (5–6 robots) this is imperceptible; for 100-robot Grand Melee it's unviable without architectural changes.

### Current Bottleneck Profile

The simulator is the constraint — not the database, not the network. `simulateBattleMulti` does dense float arithmetic (distances, angles, damage formulas) in a tight loop at 10 ticks/second. For N robots:

- **O(n²) per tick**: 9,900 threat evaluations, 4,950 pairwise distances for 100 robots
- **No parallelism**: runs single-threaded in the main Node.js event loop
- **Memory pressure**: 100 combat state objects + growing event array competes with PostgreSQL for the 2 GB RAM budget
- **GC pauses**: V8 garbage collection can stall 5–50ms mid-simulation on large heaps

Estimated simulation time for 100 robots (150s battle duration, current code, no optimizations): **30–60 seconds of wall-clock time** on the DEV1-S.

### Strategy 1: Algorithmic Optimizations (TypeScript, no infra changes)

Reduce the O(n²) constant before changing languages or infrastructure:

| Optimization | Effect | Effort |
|--------------|--------|--------|
| **Spatial partitioning** (grid/quadtree) | Threat evaluation becomes O(n × k) where k ≈ 5–10 nearby robots | ~2 days |
| **Variable tick rate** | Robots >50 units from any opponent simulate at 0.5s instead of 0.1s | ~1 day |
| **Threat score caching** | Only recalculate when robot takes significant damage or moves >5 units | ~1 day |
| **Attack resolution batching** | Process all attacks per tick in one pass instead of per-robot sequential | ~0.5 days |

**Combined estimated improvement**: 5–10× faster. A 100-robot battle drops from ~30–60s to ~5–15s. Sufficient for 32 robots on current hardware; marginal for 100.

### Strategy 2: Worker Thread Isolation (TypeScript, no infra changes)

Move the simulation off the main event loop using Node.js `worker_threads`:

- Main thread posts robot data + config to a Worker
- Worker runs `simulateBattleMulti` in its own V8 isolate (separate heap, independent GC)
- Result returned via `postMessage`; main thread persists to DB
- API stays responsive during heavy battles

**What it solves**: API responsiveness, GC isolation. **What it doesn't solve**: total compute time still limited by 2 vCPU.

**Effort**: ~1–2 days. No infra changes.

### Strategy 3: External Database (free VPS resources for compute)

Move PostgreSQL off the VPS to a managed service. The DB and Node.js currently compete for the same 2 GB RAM.

**What you gain**:
- All 2 GB RAM + 2 vCPU dedicated to Node.js and combat Workers
- Docker overhead eliminated (~50 MB RAM + CPU for container runtime)
- Independent storage scaling (TOAST growth at 85 MB/day becomes the provider's problem)
- Simplified VPS lifecycle — stateless compute, destroy/recreate without data risk
- Built-in backups, point-in-time recovery, connection pooling (replaces custom `backup.sh` scripts)

**Latency impact**: Queries go from ~0.1ms (localhost) to ~1–5ms (same-region network). For a typical API request (3–5 queries) this adds 5–25ms — imperceptible. The combat simulation itself never touches the DB, so zero impact on the actual bottleneck.

**Cost comparison**:

| Option | Monthly cost | Notes |
|--------|-------------|-------|
| Current (Docker on VPS) | €0 extra | But you own all ops (backups, vacuuming, disk alerts) |
| Scaleway Managed DB (DB-DEV-S) | ~€8–12 | Same region, auto-backups, 10 GB included |
| Neon (free tier) | €0 | 0.5 GB storage, autoscaling, cold starts possible |
| Neon (Scale) | ~€20 | 10 GB storage, always-on compute, branching for dev/staging |
| Supabase (Pro) | ~€25 | 8 GB storage, daily backups, built-in pooling |

**Risks**:
- Cold start on serverless DB (Neon free): 300–500ms on first query after idle. Mitigated by game's predictable hourly cron pattern.
- Advisory locks (`lockUserForSpending`): PgBouncer in transaction mode can break `pg_advisory_xact_lock`. Solution: ensure session mode for advisory lock transactions, or use `SELECT ... FOR UPDATE`.

### Strategy 4: Separate Compute Tier (dedicated battle worker)

Run combat simulation on a different machine than the API/DB:

```
[VPS: API + Cron + DB]  ──HTTP/Unix socket──▶  [Compute VPS: Battle Workers]
```

Or combined with Strategy 3:

```
[Managed DB]  ◀──  [VPS: API + Cron]  ──▶  [Compute VPS: Battles]
```

- Main VPS dispatches battle jobs (robot data + config) to compute node
- Compute node runs only the simulator — no Express, no Prisma, no DB connection
- Results posted back; main VPS persists to DB
- Compute node is stateless and disposable

**Cost**: A second DEV1-S is ~€4/month. Doubles available compute for pocket change.

**Effort**: ~3–5 days. Extract simulator into standalone Node.js worker app + simple job dispatch layer.

### Strategy 5: Serverless Burst Compute (pay-per-battle)

Package the combat simulator as a serverless function (Scaleway Serverless Functions, AWS Lambda, Cloudflare Workers):

- Cron handler invokes the function with the battle payload
- Function runs simulation (up to 10 GB memory, 15-minute timeout on Lambda)
- Returns result; main app persists to DB
- Pay only for execution time (~€0.01–0.05 per Grand Melee run)

**Why this fits Grand Melee specifically**: It runs once daily at 17:00 UTC. You don't need permanent extra infrastructure for a single daily heavy job.

**Effort**: ~2–3 days. Package simulator, add thin HTTP wrapper, invoke from cron handler.

### Strategy 6: Rust Combat Engine (language-level performance)

The simulator is a pure function (robots in → events out) doing dense float arithmetic in tight loops. This is the exact workload profile where a systems language provides 10–50× improvement over JavaScript:

**Why Rust specifically**:
- **Zero GC**: No mid-simulation pauses. V8 can stall 5–50ms; Rust never pauses.
- **SIMD auto-vectorization**: The LLVM backend vectorizes distance calculations across multiple robot pairs simultaneously.
- **Cache-friendly memory layout**: Robot states packed in a contiguous `Vec<RobotState>` — sequential iteration without pointer-chasing. In JS, each `SpatialRobotCombatState` is a heap-allocated object with indirection on every field access.
- **Predictable performance**: No JIT warmup, no deoptimization. First battle is as fast as the thousandth.

**Estimated performance**:

| Approach | 100-robot sim time | Notes |
|----------|-------------------|-------|
| Current TS (no changes) | 30–60s | Unusable |
| TS + algorithmic optimizations | 5–15s | Marginal for 100 robots |
| TS + optimizations + 4 vCPU VPS | 3–8s | Acceptable but expensive |
| **Rust on current 2 vCPU VPS** | **0.5–1.5s** | Trivially fast |
| Rust on 4 vCPU VPS | 0.2–0.5s | Overkill |

**Integration options**:

| Pattern | How it works | Overhead | Deployment complexity |
|---------|-------------|----------|----------------------|
| **napi-rs native addon** | Rust compiled to `.node` file, called from TS like a function | ~0ms (in-process) | Medium — needs cross-compile for Linux deploy |
| **Sidecar microservice** | Standalone Rust binary with HTTP/Unix socket | ~1–2ms IPC | Medium — separate process to manage |
| **Rust → WebAssembly** | Compiled to `.wasm`, loaded inside Node | ~0ms (in-process) | Low — single artifact, but 5–15× not 10–50× |

**Recommended pattern**: napi-rs native addon. The simulator stays in the same Node.js process (no network hop, no serialization cost), runs on a background thread via `napi::Task`, and integrates with the existing codebase as a drop-in replacement for `simulateBattleMulti`.

**Scope of the port**: ~3,500 lines of TypeScript → ~2,500 lines of Rust:
- `combatSimulator.ts` (core simulation loop, attack resolution, damage formulas)
- `movementAI.ts` (movement decisions, preferred range, pursuit)
- `threatScoring.ts` (target selection, weighted scoring)
- `positionTracker.ts` (facing, backstab/flanking)
- `servoStrain.ts` (speed degradation)
- `hydraulicBonus.ts` (melee proximity bonus)
- `vector2d.ts` (2D math utilities)

The orchestration layer (loading robots from DB, persisting results, LP/ELO updates) stays in TypeScript.

**Effort**: ~2–3 weeks for the port + test parity.

**Alternative — Go**: 3–8× improvement with lower learning curve. Has GC but it's tuned for sub-ms pauses. Less headroom than Rust but viable for 50-robot battles. Not recommended if the goal is 100 robots.

### Recommended Scaling Path

**Phase 1 — Ship Grand Melee at 16–32 robots (current hardware, ~1 week)**:
1. Implement spatial partitioning + variable tick rate in `simulateBattleMulti`
2. Run Grand Melee in a Worker Thread
3. Cap at 32 robots for v1

**Phase 2 — Scale to 50–100 robots (choose one, ~2–3 weeks)**:
- **Option A (budget-friendly)**: Move DB to Scaleway Managed + add Rust combat engine via napi-rs on existing VPS
- **Option B (simplest ops)**: Move DB to managed service + use serverless function for Grand Melee specifically
- **Option C (most headroom)**: Rust combat engine on a dedicated second VPS (€4/month), DB on managed service

**The simulation being a pure function is the key architectural advantage.** It takes robots in, produces events out, needs no database or network during execution. This makes it trivially extractable to any compute target — Worker Thread, separate process, separate machine, serverless function, or native Rust addon.

## Attribute Value Shifts (vs 1v1)

| Attribute | 1v1 Value | FFA Value | Why |
|-----------|-----------|-----------|-----|
| servoMotors | Medium | Very High | Escape, reposition, chase weakened targets |
| threatAnalysis | Medium | Very High | Target selection among 99 opponents is critical |
| combatAlgorithms | Medium | Very High | Smart engagement timing wins FFAs |
| hullIntegrity | Medium | Very High | Surviving multiple fights requires raw HP |
| armorPlating | Medium | High | Chip damage from many sources adds up |
| adaptiveAI | Medium | High | Accumulates bonuses across many fights |
| hydraulicSystems | Medium | Low | Melee is risky in open-field FFA |
| counterProtocols | Medium | Low | Counter-attacks matter less when threats come from all directions |

## Open Questions for Future Spec

1. Should FFA have team variants (e.g., 10 teams of 10)?
2. Should eliminated robots spectate or disconnect?
3. What rewards structure? Winner-take-all or top-N placement rewards?
4. Should there be weapon/item pickups on the arena (loot)?
5. How does matchmaking work for FFA? ELO-based entry tiers?
6. Should the playback viewer support 100 robots, or is a simplified "highlights" replay more practical?
7. Maximum battle duration for large FFAs? 120s may be too short for 100 robots.

## Dependencies

- 2D Combat Arena must be fully implemented (spatial positioning, range bands, movement)
- Requirement 12 (Multi-Robot Battle Support) provides the foundation for many-robot battles
- Requirement 16 (Extensibility) provides pluggable win conditions and arena zones
- Servo_Strain (Req 2) prevents infinite kiting but may need tuning for FFA scale
- Performance optimization may require architectural changes to the simulation loop
