/**
 * Build_Focus presets vs the approved table (Spec #55, task 4.1, R4.1, R13.4).
 *
 * `APPROVED_TABLE` is copied verbatim from `review/STRATEGIES.md` §3
 * (Approved — 9 Oct 2026): name, Combat, Defense, Mobility, AI/Team weights,
 * priority order, description and the closest guide archetype.
 */
import { BUILD_FOCUS_PRESETS, BUILD_FOCUS_WEIGHTS, priorityOrder } from '../buildFocus';
import type { AttributeGroup } from '../../../types/automaton';

const APPROVED_TABLE = `
| **Bruiser** | 1.0 | 0.8 | 0.7 | 0.4 | Combat → Defense → Mobility → AI | A heavy hitter that wades in and trades blows. Built to deal damage first and survive the return fire second. | Glass Cannon / melee brawler |
| **Deadeye** | 1.0 | 0.4 | 0.5 | 0.8 | Combat → AI → Mobility → Defense | Precision over everything: targeting, crits and penetration, backed by sharp combat AI. Fragile if caught. | Sniper |
| **Warden** | 0.6 | 1.0 | 0.6 | 0.5 | Defense → Combat → Mobility → AI | A shield wall. Soaks punishment, counters attackers and wins the long fight. | Tank / Counter Striker |
| **Sprinter** | 0.7 | 0.5 | 1.0 | 0.5 | Mobility → Combat → Defense → AI | Fast, evasive and relentless. Hard to pin down, strikes often. | Speed Demon |
| **Tactician** | 0.6 | 0.6 | 0.5 | 1.0 | AI → Combat → Defense → Mobility | Reads the battlefield and coordinates the team. Strongest next to allies. | Team Player |
| **Versatile** | 1.0 | 1.0 | 1.0 | 1.0 | Combat → Defense → Mobility → AI (all equal) | No weak spots and no spikes. Every system upgraded evenly. | All-rounder |
`;

const GROUP_NAMES: Readonly<Record<string, AttributeGroup>> = { Combat: 'combat', Defense: 'defense', Mobility: 'mobility', AI: 'ai' };

const approved = APPROVED_TABLE.trim().split('\n').map((line) => {
  const [name, combat, defense, mobility, ai, priority, description] = line.split('|').slice(1).map((cell) => cell.trim());
  return {
    displayName: name.replace(/\*/g, ''),
    weights: { combat: Number(combat), defense: Number(defense), mobility: Number(mobility), ai: Number(ai) },
    priority: priority.replace(/\s*\(.*\)$/, '').split(' → ').map((group) => GROUP_NAMES[group]),
    description,
  };
});

describe('Build_Focus presets match review/STRATEGIES.md §3 (R4.1, R13.4)', () => {
  it('has the six approved presets in table order', () => {
    expect(BUILD_FOCUS_PRESETS.map((p) => p.displayName)).toEqual(approved.map((a) => a.displayName));
    expect(BUILD_FOCUS_PRESETS.map((p) => p.key)).toEqual(approved.map((a) => a.displayName.toLowerCase()));
  });

  it.each(approved.map((a) => [a.displayName, a] as const))('%s: weights, description and priority order', (_name, row) => {
    const preset = BUILD_FOCUS_PRESETS.find((p) => p.displayName === row.displayName);
    expect(preset?.weights).toEqual(row.weights);
    expect(preset?.description).toBe(row.description);
    expect(priorityOrder(preset?.weights ?? row.weights)).toEqual(row.priority);
  });

  it('exposes the weights as the weight table the Goals use', () => {
    for (const preset of BUILD_FOCUS_PRESETS) expect(BUILD_FOCUS_WEIGHTS[preset.key]).toBe(preset.weights);
  });

  it('keeps every weight at 0.25 or more and exactly one primary group (Versatile: four)', () => {
    for (const preset of BUILD_FOCUS_PRESETS) {
      const values = Object.values(preset.weights);
      expect(Math.min(...values)).toBeGreaterThanOrEqual(0.25);
      expect(values.filter((w) => w === 1).length).toBe(preset.key === 'versatile' ? 4 : 1);
    }
  });
});
