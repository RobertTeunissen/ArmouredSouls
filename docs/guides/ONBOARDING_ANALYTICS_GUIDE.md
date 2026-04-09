# Onboarding Analytics Guide

## Overview

The onboarding system tracks player behavior through a 5-step interactive tutorial (the backend internally uses steps 1–9 for granularity) to measure engagement, identify drop-off points, and correlate onboarding completion with long-term retention. Analytics data flows from the frontend (`onboardingAnalytics.ts`) through `POST /api/onboarding/analytics` to the backend (`onboardingAnalyticsService.ts`), where events are stored for aggregation queries.

This guide explains what data is collected, how to interpret it, and what actions to take based on the numbers.

---

## Tracked Metrics

### Funnel Metrics

| Metric | Description | Target | Source |
|--------|-------------|--------|--------|
| Tutorial start rate | % of new registrations that enter Step 1 | ≥ 90% | `onboarding_started` events / new user registrations |
| Step-by-step completion | Conversion from Step N to Step N+1 | > 95% per step | `onboarding_step_completed` events |
| Overall completion rate | Players who reach Step 5 / players who start Step 1 | ≥ 70% | `onboarding_completed` / `onboarding_started` |
| Skip rate | % of players who skip the tutorial | ≤ 30% | `onboarding_skipped` events |
| Skip-from-step distribution | Which step players skip from most often | Even spread | `onboarding_skipped.skippedAtStep` |

### Timing Metrics

| Metric | Description | Target | Concern Threshold |
|--------|-------------|--------|-------------------|
| Average time per step | Seconds spent on each step | 30s–90s | > 120s (too complex) or < 10s (skimming) |
| Total completion time | Time from Step 1 start to Step 5 completion | 5–10 min | > 10 min (too long) or < 3 min (rushing) |

### Choice Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Strategy distribution | Split across 1 Mighty / 2 Average / 3 Flimsy | No single strategy > 60% |
| Budget warning trigger rate | % of players hitting ₡600K (yellow) or ₡200K (red) warnings | Yellow < 40%, Red < 15% |
| Reset request frequency | How often players reset their account after onboarding | ≤ 10% within 30 days |
| Resume rate | Players who leave mid-tutorial and come back | Track trend (higher is better) |

---

## Analytics Events

### Step-Level Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `onboarding_started` | `userId`, `timestamp` | Track tutorial entry rate |
| `onboarding_step_entered` | `userId`, `step`, `timestamp` | Track step progression |
| `onboarding_step_completed` | `userId`, `step`, `duration`, `choices` | Track completion and time per step |
| `onboarding_step_back` | `userId`, `fromStep`, `toStep` | Identify confusing steps (high back-nav = confusion) |
| `onboarding_completed` | `userId`, `totalDuration`, `strategy`, `choices` | Track full completion |
| `onboarding_skipped` | `userId`, `skippedAtStep`, `timestamp` | Track skip rate and drop-off point |
| `onboarding_resumed` | `userId`, `resumedAtStep`, `timestamp` | Track session persistence |
| `onboarding_replayed` | `userId`, `timestamp` | Track replay interest |

### Action Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `onboarding_strategy_selected` | `userId`, `strategy` | Track strategy distribution |
| `onboarding_robot_created` | `userId`, `robotId`, `robotName`, `step` | Track robot creation during tutorial |
| `onboarding_weapon_purchased` | `userId`, `weaponId`, `weaponName`, `cost`, `step` | Track weapon purchases during tutorial |
| `onboarding_weapon_equipped` | `userId`, `robotId`, `weaponId`, `loadoutType` | Track equipping behavior |
| `onboarding_budget_warning` | `userId`, `warningLevel`, `remainingBudget` | Track budget management |
| `onboarding_reset_requested` | `userId`, `resetCount` | Track reset frequency |

---

## Interpreting Funnel Data

### Reading the Step-by-Step Funnel

A healthy funnel looks like this:

```
Step 1 (Welcome & Setup)   ████████████████████████████████ 100%
Step 2 (Facilities)        ██████████████████████████████   92%
Step 3 (Battle-Ready)      ████████████████████████████     82%
Step 4 (Upgrades)          ██████████████████████████       76%
Step 5 (Completion)        ████████████████████████         70%
```

Expected benchmarks:
- Step 1 → Step 2: > 92% (welcome + setup is low friction)
- Each subsequent step: < 10% drop-off per step
- Overall Step 1 → Step 5: ≥ 70%

### Identifying Problematic Steps

A step is problematic when any of these signals appear:

| Signal | Threshold | What It Means |
|--------|-----------|---------------|
| Drop-off > 5% at a single step | Compare adjacent steps | Content is too complex, too long, or confusing |
| Average time > 120 seconds | Per-step timing | Step has too much content or unclear instructions |
| Average time < 10 seconds | Per-step timing | Players are skimming — content may not be engaging |
| High back-navigation rate | > 15% of users go back from this step | Previous step didn't prepare them, or current step is unclear |
| High skip rate from this step | Disproportionate `onboarding_skipped` events | This is where the tutorial loses players |

### Strategy Distribution Analysis

The three strategies should be roughly balanced. If distribution is skewed:

| Pattern | Likely Cause | Action |
|---------|-------------|--------|
| > 60% choose "2 Average Robots" | "Recommended" badge is too influential | Consider removing the badge or making it less prominent |
| > 60% choose "1 Mighty Robot" | Players default to simplicity | Review if the complexity warnings on 2/3 robot strategies are too strong |
| > 60% choose "3 Flimsy Robots" | "More battles" messaging is too appealing | Emphasize repair cost risks more clearly |
| Even ~33% split | Balanced presentation | No action needed |

---

## Retention Correlation

### Cohort Comparison

Compare three cohorts to measure onboarding impact:

| Cohort | Definition | Expected Day-7 Retention |
|--------|-----------|--------------------------|
| Completed | Finished all 5 steps | ≥ 50% (target) |
| Skipped | Started but skipped tutorial | Baseline (lower) |
| Never started | Registered but never entered Step 1 | Lowest |

If "Completed" retention is not meaningfully higher than "Skipped", the tutorial content needs improvement — players are completing it but not getting value from it.

### Post-Onboarding Engagement

| Metric | What to Track | Healthy Signal |
|--------|--------------|----------------|
| First battle timing | Hours between onboarding completion and first battle | < 24 hours for ≥ 80% of players |
| Win rate by strategy (first 30 days) | Compare win rates across the three strategies | Within 5% of each other (balanced) |
| Credit balance trajectory | Average credits over first 30 days by strategy | All strategies sustain positive balance |
| Facility purchase rate | % who buy Tier 1 facilities within 7 days | ≥ 60% (validates facility education) |

If one strategy consistently underperforms on win rate or credit balance, the budget allocation guidance for that strategy may need adjustment.

---

## API Endpoint

### POST /api/onboarding/analytics

Ingests analytics events from the frontend. Requires JWT authentication.

**Request**:
```json
{
  "events": [
    {
      "event": "onboarding_step_completed",
      "data": {
        "step": 2,
        "duration": 45,
        "choices": { "strategy": "2_average" }
      },
      "timestamp": "2026-03-02T10:01:30Z"
    }
  ]
}
```

**Backend service**: `onboardingAnalyticsService.ts` in `app/backend/src/services/`

**Route file**: `onboardingAnalytics.ts` in `app/backend/src/routes/`

Events are batched on the client side and sent in bulk to reduce network overhead.

---

## Querying Analytics Data

### Completion Rate This Week

```typescript
// Prisma query: completion rate for the current week
const weekStart = startOfWeek(new Date());

const [started, completed] = await Promise.all([
  prisma.user.count({
    where: {
      onboardingStartedAt: { gte: weekStart },
    },
  }),
  prisma.user.count({
    where: {
      onboardingCompletedAt: { gte: weekStart },
      onboardingSkipped: false,
    },
  }),
]);

const completionRate = started > 0 ? (completed / started) * 100 : 0;
```

### Highest Drop-Off Step

```typescript
// Find the step with the largest decrease in users
const stepCounts = await Promise.all(
  [1, 2, 3, 4, 5].map(async (step) => ({
    step,
    count: await prisma.user.count({
      where: {
        onboardingStep: { gte: step },
        onboardingStartedAt: { not: null },
      },
    }),
  }))
);

let worstDropOff = { step: 0, dropRate: 0 };
for (let i = 0; i < stepCounts.length - 1; i++) {
  const current = stepCounts[i].count;
  const next = stepCounts[i + 1].count;
  const dropRate = current > 0 ? ((current - next) / current) * 100 : 0;
  if (dropRate > worstDropOff.dropRate) {
    worstDropOff = { step: stepCounts[i].step, dropRate };
  }
}
// worstDropOff.step is where most players leave
```

### Most Popular Strategy

```typescript
const strategyDistribution = await prisma.user.groupBy({
  by: ['onboardingStrategy'],
  where: {
    onboardingStrategy: { not: null },
  },
  _count: { id: true },
  orderBy: { _count: { id: 'desc' } },
});
// Returns: [{ onboardingStrategy: "2_average", _count: { id: 450 } }, ...]
```

### Completion vs Day-7 Retention

```typescript
const sevenDaysAgo = subDays(new Date(), 7);
const thirtyDaysAgo = subDays(new Date(), 30);

// Users who registered 8-30 days ago (enough time for day-7 measurement)
const cohort = await prisma.user.findMany({
  where: {
    createdAt: { gte: thirtyDaysAgo, lte: sevenDaysAgo },
  },
  select: {
    id: true,
    hasCompletedOnboarding: true,
    onboardingSkipped: true,
    createdAt: true,
  },
});

// For each user, check if they had any activity 7 days after registration
// (battle participation, login, robot creation, etc.)
// Group by: completed, skipped, never_started
// Calculate retention rate per group
```

### Skip Distribution by Step

```typescript
const skipDistribution = await prisma.user.groupBy({
  by: ['onboardingStep'],
  where: {
    onboardingSkipped: true,
  },
  _count: { id: true },
  orderBy: { onboardingStep: 'asc' },
});
// Shows which step players most commonly skip from
```

---

## Action Items Based on Data

### Decision Matrix

| Condition | Diagnosis | Action |
|-----------|-----------|--------|
| Completion rate < 70% | Tutorial is losing players | Identify the worst drop-off step and simplify its content. Check timing data — if steps are too long, split them. |
| Skip rate > 30% | Players don't see value in the tutorial | Investigate which step they skip from. If early (Steps 1-2), the intro isn't compelling. If late (Steps 3-4), the tutorial feels too long. |
| One strategy > 60% | Presentation is biased | Rebalance the strategy cards — check if the "Recommended" badge, card ordering, or descriptions favor one option. |
| Average total time > 10 min | Tutorial is too long | Reduce content per step. Move detailed information to tooltips or "Learn more" expandable sections. |
| Average total time < 3 min | Players are rushing through | Content isn't engaging enough. Add interactive elements, quizzes, or visual demonstrations. |
| Budget red warning > 15% | Players overspend during tutorial | Make budget guidance more prominent in Steps 2 and 3. Consider adding spending confirmation dialogs. |
| Reset rate > 10% within 30 days | Players regret their onboarding choices | Improve strategy education in Step 2. Consider allowing strategy changes without full reset. |
| Day-7 retention (completed) ≤ Day-7 retention (skipped) | Tutorial isn't providing value | Major content review needed — the tutorial may be teaching the wrong things or setting wrong expectations. |
| Back-navigation > 15% on a step | Step is confusing | Review the step's content for clarity. Check if it assumes knowledge from a previous step that players didn't absorb. |
| First battle > 24h for > 20% of completers | Post-onboarding transition is weak | Improve Step 5 next-steps guidance. Add a "Fight your first battle" CTA on the dashboard after completion. |

### Regular Review Cadence

| Frequency | What to Review |
|-----------|---------------|
| Daily (first 2 weeks after launch) | Completion rate, skip rate, error rates |
| Weekly | Funnel drop-offs, strategy distribution, timing per step |
| Monthly | Retention correlation, strategy performance, reset trends |
| Quarterly | Full analytics review, compare against targets, plan improvements |

---

## Related Documentation

- [PRD_ONBOARDING_SYSTEM.md](../prd_core/PRD_ONBOARDING_SYSTEM.md) — Full product requirements and analytics event definitions
- [ONBOARDING_IMPLEMENTATION_NOTES.md](../implementation_notes/ONBOARDING_IMPLEMENTATION_NOTES.md) — Technical architecture and component details
- [PRD_ECONOMY_SYSTEM.md](../prd_core/PRD_ECONOMY_SYSTEM.md) — Starting budget and facility costs
- [TESTING_STATE.md](./TESTING_STATE.md) — Current test status and coverage
