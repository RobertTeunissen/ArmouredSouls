# Implementation Plan: Matchmaking System

**Date**: January 30, 2026  
**Status**: Ready for Execution  
**Total Estimate**: 87 hours across 11 phases  
**Target Completion**: ~2-3 weeks with 1-2 developers

---

## Overview

This document provides the strategic implementation plan for the Matchmaking System. It complements the [GITHUB_ISSUES_MATCHMAKING.md](GITHUB_ISSUES_MATCHMAKING.md) document which contains the detailed GitHub issue templates.

**Key Resources**:
- [GitHub Issues](GITHUB_ISSUES_MATCHMAKING.md) - Copy-paste ready issue templates
- [PRD](PRD_MATCHMAKING.md) - Complete requirements
- [Technical Specs](MATCHMAKING_IMPLEMENTATION.md) - Implementation details
- [Decisions](MATCHMAKING_DECISIONS.md) - All owner decisions

---

## Implementation Strategy

### Approach: Vertical Slicing with Testable Increments

Each phase delivers a testable, demonstrable feature that can be closed off independently. This allows for:
- Early validation of complex features
- Parallel work where possible
- Clear progress tracking
- Ability to pause between phases if needed

### Critical Path

The fastest path to a working matchmaking system:

```
Issue #1 (Database) 
    ↓
Issue #3 (Matchmaking Algorithm)
    ↓
Issue #5 (Battle Execution)
    ↓
Issue #6 (League Rebalancing)
    ↓
Issue #8 (Public API)
    ↓
Issue #9 (Frontend UI)
    ↓
Issue #12 (Testing)
```

**Critical Path Duration**: ~47 hours (can be parallelized with other work)

---

## Phase Breakdown

### Phase 1: Foundation (6 hours) - Week 1, Day 1

**Issue #1: Database Schema Updates**

**Why First**: Everything depends on the database schema. Must be completed before any other work.

**Complexity**: Low-Medium  
**Risk**: Low (standard database migrations)  
**Can Parallelize**: No (blocking issue)

**Key Deliverables**:
- ScheduledMatch model
- battleType field
- League instance support (leagueId)
- Bye-robot entry
- Practice Sword weapon
- 100 test users with creative robot names

**Testing Gate**: 
```bash
npx prisma validate
npm run seed
# Verify in Prisma Studio
```

**Move to Next Phase When**: All migrations pass, seed script runs, test data exists.

---

### Phase 2: League Instance System (10 hours) - Week 1, Days 1-2

**Issue #2: League Instance Management**

**Why Next**: Core to matchmaking algorithm. Needed before implementing pairing logic.

**Complexity**: High (new concept with auto-balancing)  
**Risk**: Medium (complex logic)  
**Can Parallelize**: Partially (can start while Issue #4 is in progress)

**Key Deliverables**:
- Instance assignment algorithm
- Auto-balancing logic
- Instance statistics

**Testing Gate**:
```typescript
// Unit tests must pass
npm test -- leagueInstanceService.test
```

**Move to Next Phase When**: 
- 100 robots correctly distributed across instances
- Auto-balancing tested with various scenarios
- All unit tests passing

---

### Phase 3: Matchmaking Algorithm (8 hours) - Week 1, Days 2-3

**Issue #3: Core Matchmaking Algorithm**

**Why Next**: Heart of the system. Needs Issue #1 and ideally Issue #2 complete.

**Complexity**: High (complex pairing logic)  
**Risk**: Medium (matching algorithm correctness)  
**Can Parallelize**: No (depends on #1 and #2)

**Key Deliverables**:
- Queue building with battle readiness
- ELO-based pairing
- Recent opponent tracking
- Bye-robot handling
- Schedule creation

**Testing Gate**:
```typescript
// Unit tests for pairing logic
npm test -- matchmakingService.test
// Manual test via admin API
curl -X POST http://localhost:3001/api/admin/matchmaking/run
```

**Move to Next Phase When**:
- Matchmaking successfully pairs 100 test robots
- Bye-robot matches created for odd numbers
- Scheduled matches created in database
- Performance <5 seconds for 100 robots

---

### Phase 4: Battle Readiness (5 hours) - Week 1, Day 3

**Issue #4: Battle Readiness Validation and Warnings**

**Why Next**: Required for matchmaking queue building. Can be done in parallel with Phase 3.

**Complexity**: Low-Medium  
**Risk**: Low (straightforward validation)  
**Can Parallelize**: Yes (can start during Phase 2)

**Key Deliverables**:
- Battle readiness validation (HP + weapons)
- API endpoints
- Warning UI components (3 locations)

**Testing Gate**:
```bash
# API test
curl http://localhost:3001/api/robots/1/battle-readiness

# UI test - manual verification
# Check robot list, detail page, dashboard for warnings
```

**Move to Next Phase When**:
- Validation correctly checks all loadout types
- Warnings display on all 3 pages
- API endpoints return correct status

---

### Phase 5: Battle Execution (6 hours) - Week 2, Day 1

**Issue #5: Battle Orchestrator**

**Why Next**: Executes the scheduled matches created by Phase 3.

**Complexity**: Medium  
**Risk**: Medium (integration with battle engine)  
**Can Parallelize**: No (depends on #3)

**Key Deliverables**:
- Battle orchestrator service
- Bye-robot battle simulation
- Stat updates (ELO, league points, HP)
- Reward calculations

**Testing Gate**:
```bash
# Execute battles via admin API
curl -X POST http://localhost:3001/api/admin/battles/run

# Verify in database:
# - Battle records created
# - Scheduled matches marked completed
# - Robot stats updated
```

**Move to Next Phase When**:
- Battles execute without errors
- Bye-robot battles result in easy wins
- Stats update correctly
- Rewards awarded

---

### Phase 6: League Rebalancing (6 hours) - Week 2, Day 2

**Issue #6: Promotion and Demotion System**

**Why Next**: Completes the daily cycle. Needed for continuous operation.

**Complexity**: Medium  
**Risk**: Low (straightforward logic)  
**Can Parallelize**: No (depends on #5 for battle completion)

**Key Deliverables**:
- Promotion logic (top 10%)
- Demotion logic (bottom 10%)
- League point reset
- Instance balancing integration

**Testing Gate**:
```bash
# Run rebalancing
curl -X POST http://localhost:3001/api/admin/leagues/rebalance

# Verify:
# - Top 10% promoted
# - Bottom 10% demoted
# - League points reset
# - Instances balanced
```

**Move to Next Phase When**:
- Complete daily cycle runs successfully:
  - Matchmaking → Battles → Rebalancing → Matchmaking
- Promotions and demotions work correctly
- Instances remain balanced

**MILESTONE**: At this point, the core matchmaking system is functional end-to-end!

---

### Phase 7: Admin Dashboard (12 hours) - Week 2, Days 2-4

**Issue #7: Admin Dashboard**

**Why Next**: Essential testing tool. Makes testing Phases 1-6 much easier.

**Complexity**: High (separate app with many features)  
**Risk**: Low (doesn't affect core system)  
**Can Parallelize**: Yes (can be done by separate developer)

**Key Deliverables**:
- Admin API endpoints
- Admin dashboard UI
- Bulk cycle testing (up to 100 cycles)
- Auto-repair functionality
- System monitoring

**Testing Gate**:
```bash
# Manual testing of all admin functions
# 1. Login to admin dashboard
# 2. Test matchmaking trigger
# 3. Test battle execution
# 4. Test league rebalancing
# 5. Run 10-cycle bulk test
# 6. Verify system stats
```

**Move to Next Phase When**:
- All admin endpoints functional
- Dashboard displays correctly
- Bulk testing works for 10+ cycles
- Auto-repair correctly deducts costs

**NOTE**: This is the longest single phase. Consider splitting if team bandwidth allows:
- 7A: Backend API (6h)
- 7B: Frontend Dashboard (6h)

---

### Phase 8: Public API (6 hours) - Week 2, Days 4-5

**Issue #8: Player-Facing API Endpoints**

**Why Next**: Required for frontend UI. Can be done in parallel with Phase 7.

**Complexity**: Low  
**Risk**: Low (standard CRUD operations)  
**Can Parallelize**: Yes (can start during Phase 7)

**Key Deliverables**:
- Upcoming matches endpoint
- Battle history endpoint (paginated)
- League standings endpoint
- Robot match history endpoint
- Battle readiness endpoints

**Testing Gate**:
```bash
# Test each endpoint
curl http://localhost:3001/api/matches/upcoming
curl http://localhost:3001/api/matches/history
curl http://localhost:3001/api/leagues/bronze/standings
curl http://localhost:3001/api/robots/1/matches

# Run integration tests
npm test -- api.integration.test
```

**Move to Next Phase When**:
- All endpoints return correct data
- Pagination works
- Authorization enforced
- Integration tests pass

---

### Phase 9: Frontend UI (14 hours) - Week 3, Days 1-3

**Issue #9 & #10: Matchmaking UI Components**

**Why Next**: Makes the system usable for players. Depends on Phase 8.

**Complexity**: Medium-High (many components)  
**Risk**: Low (UI-only, doesn't affect backend)  
**Can Parallelize**: Yes (split into Issue #9 and #10)

**Split Approach**:
- **Issue #9** (7h): Dashboard components
  - Upcoming matches
  - Last 5 matches per robot
  - Battle readiness warnings
- **Issue #10** (7h): History and standings
  - Battle history page
  - League standings page
  - Robot detail match history tab
  - Promotion/demotion badges

**Key Deliverables**:
- Dashboard with upcoming and recent matches
- Battle history page with filters
- League standings with all 6 tiers
- Robot detail match history tab
- Responsive design

**Testing Gate**:
```bash
npm run dev
# Manual testing:
# □ Dashboard displays correctly
# □ Upcoming matches shown
# □ Last 5 matches per robot
# □ Battle history pagination
# □ League standings tabs
# □ Player robots highlighted
# □ Responsive on mobile
```

**Move to Next Phase When**:
- All UI components render correctly
- Data fetching works
- Pagination functional
- Responsive design verified
- Battle readiness warnings display

**NOTE**: This can be split across 2 developers:
- Developer A: Issue #9 (Dashboard)
- Developer B: Issue #10 (History/Standings)

---

### Phase 10: Battle Log System (6 hours) - Week 3, Day 3-4

**Issue #11: Battle Log Messages**

**Why Next**: Enhancement to make battles more engaging. Can be done anytime after Phase 5.

**Complexity**: Medium  
**Risk**: Low (enhancement, not core feature)  
**Can Parallelize**: Yes (independent of other work)

**Key Deliverables**:
- 100+ message templates
- Message generator service
- Battle event logging
- Battle log viewer UI

**Testing Gate**:
```typescript
// Test message generation
npm test -- combatMessageGenerator.test

// View battle log in UI
// Click "View Details" on any battle
```

**Move to Next Phase When**:
- Messages generated for all event types
- Battle logs stored in database
- UI displays logs correctly
- Messages vary appropriately

**NOTE**: This is a nice-to-have. Can be deprioritized if needed.

---

### Phase 11: Testing & Polish (8 hours) - Week 3, Days 4-5

**Issue #12: Integration Testing and Final Polish**

**Why Last**: Validates everything works together. Final quality gate.

**Complexity**: Medium  
**Risk**: Low (testing phase)  
**Can Parallelize**: No (depends on all previous phases)

**Key Deliverables**:
- Complete integration tests
- Load testing results
- Edge case validation
- Performance optimization
- Bug fixes
- Documentation updates

**Testing Gate**:
```bash
# Run full test suite
npm test

# Load test
npm run test:load -- --robots=100 --cycles=10

# Integration test
npm run test:integration

# Manual validation checklist
# □ Complete daily cycle
# □ 100 robots, multiple cycles
# □ All edge cases handled
# □ Performance targets met
# □ UI tested across browsers
# □ Documentation complete
```

**Move to Production When**:
- All tests passing
- Performance acceptable
- No critical bugs
- Documentation complete
- Stakeholder approval

---

## Parallelization Opportunities

To reduce calendar time, these issues can be worked on in parallel:

### Week 1
- **Developer 1**: Issues #1 → #2 → #3
- **Developer 2**: Issue #4 (after #1 complete)

### Week 2
- **Developer 1**: Issues #5 → #6 → #8
- **Developer 2**: Issue #7 (Admin Dashboard)

### Week 3
- **Developer 1**: Issue #9 (Dashboard UI)
- **Developer 2**: Issue #10 (History/Standings UI)
- **Either**: Issue #11 (Battle Logs)
- **Both**: Issue #12 (Testing)

**With 2 developers**: ~2 weeks calendar time  
**With 1 developer**: ~3 weeks calendar time

---

## Risk Management

### High-Risk Areas

1. **League Instance Auto-Balancing** (Issue #2)
   - **Risk**: Complex logic, many edge cases
   - **Mitigation**: Comprehensive unit tests, gradual rollout
   - **Fallback**: Start with single instance per tier, add multi-instance later

2. **Matchmaking Algorithm** (Issue #3)
   - **Risk**: Matching deadlocks, poor pairings
   - **Mitigation**: Extensive testing with various robot counts
   - **Fallback**: Simpler matching without recent opponent tracking

3. **Battle Execution Integration** (Issue #5)
   - **Risk**: Integration with existing battle engine
   - **Mitigation**: Mock battle engine for testing, staged integration
   - **Fallback**: Manual battle triggering via admin panel

### Medium-Risk Areas

4. **Admin Dashboard** (Issue #7)
   - **Risk**: Separate app increases complexity
   - **Mitigation**: Reuse existing components, simple UI
   - **Fallback**: API-only admin tools (use curl or Postman)

5. **Performance** (100 robots)
   - **Risk**: Slow matchmaking or battle execution
   - **Mitigation**: Database indexes, query optimization
   - **Fallback**: Reduce test user count, run in smaller batches

---

## Testing Strategy

### Unit Testing (Per Issue)
- Each service has unit tests
- Target: >90% coverage for core logic
- Run tests before merging each issue

### Integration Testing (Issue #12)
- Complete daily cycle end-to-end
- 100 robot load test
- Edge case scenarios
- Performance benchmarks

### Manual Testing (Continuous)
- Test each issue via admin dashboard
- Verify UI changes in browser
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile responsive testing

---

## Success Criteria

### Functional Requirements
- ✅ Matchmaking pairs 100 robots successfully
- ✅ Bye-robot matches created for odd numbers
- ✅ Battles execute and update stats correctly
- ✅ League rebalancing promotes/demotes correctly
- ✅ Admin dashboard allows manual triggering
- ✅ Public UI displays all matchmaking data
- ✅ Battle readiness warnings display correctly

### Performance Requirements
- ✅ Matchmaking completes in <5 seconds (100 robots)
- ✅ Battle execution <30 seconds total (50 battles)
- ✅ API endpoints respond in <200ms
- ✅ UI loads in <2 seconds

### Quality Requirements
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ No TypeScript errors
- ✅ No ESLint errors
- ✅ Code review completed
- ✅ Documentation complete

---

## Deployment Plan

### Phase 1: Development Environment
- Run all issues in local development
- Use Docker for PostgreSQL
- Test with 100 test users

### Phase 2: Staging Environment
- Deploy backend with migrations
- Deploy frontend
- Deploy admin dashboard
- Full integration testing

### Phase 3: Production Rollout
- Deploy during low-traffic window
- Run database migrations
- Seed initial test data
- Monitor for errors
- Enable for all users

### Rollback Plan
- Database migration rollback scripts ready
- Previous version deployment ready
- Monitoring and alerts configured

---

## Monitoring & Metrics

### System Health Metrics
- Matchmaking success rate (% robots matched)
- Average matchmaking time
- Battle execution success rate
- League rebalancing completion rate

### Performance Metrics
- Matchmaking duration
- Battle execution duration
- API response times
- Database query performance

### Business Metrics
- Active robots in matchmaking
- Battles per day
- Promotion/demotion rates
- Player engagement (battles per robot per week)

---

## Post-Implementation

### Immediate Next Steps (After Issue #12)
1. Monitor system performance for 1 week
2. Collect user feedback
3. Fix any critical bugs
4. Optimize performance bottlenecks

### Future Enhancements (Phase 2+)
- Tournament system (separate PRD)
- Custom challenge matches
- Spectator mode
- Advanced statistics and analytics
- League history tracking
- Revenge matches

---

## Contact & Support

**Questions During Implementation?**
- Reference: [PRD_MATCHMAKING.md](PRD_MATCHMAKING.md)
- Technical Specs: [MATCHMAKING_IMPLEMENTATION.md](MATCHMAKING_IMPLEMENTATION.md)
- Decisions Record: [MATCHMAKING_DECISIONS.md](MATCHMAKING_DECISIONS.md)

**Issue Templates**:
- Copy from: [GITHUB_ISSUES_MATCHMAKING.md](GITHUB_ISSUES_MATCHMAKING.md)
- Create in GitHub with appropriate labels and milestones

---

## Quick Start

**To begin implementation**:

1. **Create GitHub Issues**
   ```bash
   # Copy each issue from GITHUB_ISSUES_MATCHMAKING.md
   # Create in GitHub with labels and milestone
   ```

2. **Set Up Environment**
   ```bash
   cd prototype/backend
   npm install
   docker-compose up -d  # Start PostgreSQL
   ```

3. **Start with Issue #1**
   ```bash
   git checkout -b feature/matchmaking-database
   # Implement database changes
   npx prisma migrate dev --name add_matchmaking_schema
   npm run seed
   ```

4. **Test Before Moving On**
   ```bash
   npm test
   npx prisma studio  # Verify data
   ```

5. **Repeat for Each Issue**
   - Implement
   - Test
   - Review
   - Merge
   - Move to next issue

**Good luck with implementation! 🚀**

