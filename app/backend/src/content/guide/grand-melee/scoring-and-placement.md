---
title: "Scoring & Placement"
description: "How Grand Melee determines placements, awards LP, and handles tiebreakers."
order: 3
lastUpdated: "2026-06-18"
relatedArticles:
  - grand-melee/basics
  - grand-melee/rewards
  - leagues/league-points
---

## F1 Point Scale

Grand Melee uses an **F1-style point scale** to reward placements. The top 10 finishers earn points; positions 11–20 earn zero.

| Place | Points |
|-------|--------|
| 1st | 25 |
| 2nd | 18 |
| 3rd | 15 |
| 4th | 12 |
| 5th | 10 |
| 6th | 8 |
| 7th | 6 |
| 8th | 4 |
| 9th | 2 |
| 10th | 1 |
| 11th–20th | 0 |

This heavily rewards top finishes while still giving meaningful points to consistent top-10 performers.

## Determining Placement

Placement is determined by **elimination order**. The first robot eliminated gets 20th place, the second gets 19th, and so on. The last robot standing gets 1st place.

### HP% Tiebreaker (Time Limit)

If the **120-second time limit** expires with multiple robots still alive, survivors are ranked by their **current HP percentage**. The robot with the highest HP% among survivors takes the best placement among them.

### Same-Tick Elimination Tiebreaker

In rare cases where two or more robots are eliminated on the exact same simulation tick, the tiebreaker is **total damage dealt** during the battle. The robot that dealt more total damage receives the higher placement.

## League Points (LP)

Points earned from placement contribute to your robot's Grand Melee **LP total**. LP accumulates across battles — strong performances push you toward the top of your tier.

### Tier Promotion and Demotion

- **Promotion**: Robots in the **top 10%** of their tier's LP standings promote to the next tier at the end of the evaluation period
- **Demotion**: Robots in the **bottom 10%** of their tier's LP standings are relegated to the tier below

This creates a competitive ladder where consistent top-10 placements drive promotion, while finishing outside the points repeatedly risks demotion.
