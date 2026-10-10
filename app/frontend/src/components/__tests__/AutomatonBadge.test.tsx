/**
 * Automaton_Badge (Spec #55 R12.1, R12.2, task 11.3): the component and the
 * component surfaces that render it (OwnerNameLink, BattleResultBanner,
 * TeamBattleMetrics). Page surfaces are in `pages/__tests__/AutomatonBadgePages.test.tsx`
 * and `RobotDetailAutomatonBadge.test.tsx`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AutomatonBadge, { AUTOMATON_BADGE_BACKGROUND_CLASS } from '../AutomatonBadge';
import OwnerNameLink from '../OwnerNameLink';
import { BattleResultBanner } from '../battle-detail/BattleResultBanner';
import { TeamBattleMetrics } from '../battle-detail/TeamBattleMetrics';
import type { BattleLogParticipant, BattleLogResponse } from '../../utils/matchmakingApi';
import type { StableType } from '../../types/stable';

// ── Contrast helpers (WCAG 2.1 relative luminance) ───────────────────

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a hex colour: ${hex}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `color-mix(in srgb, top p, bottom)` */
function mix(top: Rgb, bottom: Rgb, p: number): Rgb {
  return [0, 1, 2].map((i) => top[i] * p + bottom[i] * (1 - p)) as Rgb;
}

/** Theme tokens read from `src/index.css`, so a token change re-runs the check. */
function themeToken(name: string): Rgb {
  const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token --color-${name} not found in index.css`);
  return hexToRgb(m[1]);
}

// ── Fixtures ─────────────────────────────────────────────────────────

function participant(robotId: number, team: number, owner: string, ownerId: number, ownerStableType: StableType): BattleLogParticipant {
  return {
    robotId,
    robotName: `Robot ${robotId}`,
    owner,
    ownerId,
    ownerStableType,
    imageUrl: null,
    teamIndex: team - 1,
    team,
    role: null,
    placement: null,
    finalHP: 10,
    maxHP: 100,
    maxShield: 0,
    destroyed: false,
    yielded: false,
    damageDealt: 50,
    eloBefore: 1000,
    eloAfter: 1010,
    credits: 0,
    streamingRevenue: 0,
    prestigeAwarded: 0,
    fameAwarded: 0,
    stance: 'balanced',
    loadoutType: 'single',
    mainWeaponName: 'Laser Pistol',
    mainWeaponRangeBand: 'medium',
    offhandWeaponName: null,
    offhandWeaponRangeBand: null,
  } as BattleLogParticipant;
}

function oneVsOne(): BattleLogResponse {
  return {
    battleId: 1,
    createdAt: '2026-10-01T00:00:00Z',
    battleType: 'league',
    leagueType: 'silver',
    duration: 72,
    winner: 'robot1',
    robot1: { id: 1, name: 'Ironclad', owner: 'Iron Warriors', ownerId: 10 },
    robot2: { id: 2, name: 'CT-5555 Fives', owner: 'Kamino Clone Legion', ownerId: 20 },
    participants: [
      participant(1, 1, 'Iron Warriors', 10, 'human'),
      participant(2, 2, 'Kamino Clone Legion', 20, 'automaton'),
    ],
    battleLog: { events: [] },
  } as unknown as BattleLogResponse;
}

function twoVsTwo(): BattleLogResponse {
  return {
    battleId: 2,
    createdAt: '2026-10-01T00:00:00Z',
    battleType: 'league_2v2',
    leagueType: 'bronze',
    leagueInstanceId: 'bronze_1',
    duration: 120,
    winner: 'robot1',
    participants: [
      participant(1, 1, 'Pan Pacific Defense Corps', 30, 'automaton'),
      participant(2, 1, 'Pan Pacific Defense Corps', 30, 'automaton'),
      participant(3, 2, 'Iron Warriors', 10, 'human'),
      participant(4, 2, 'Iron Warriors', 10, 'human'),
    ],
    battleLog: {
      teamBattle: true,
      teamSize: 2,
      winningSide: 1,
      isDraw: false,
      isByeMatch: false,
      durationSeconds: 120,
      participants: [1, 2, 3, 4].map((robotId) => ({ robotId, team: robotId <= 2 ? 1 : 2, damageDealt: 50, damageTaken: 40, finalHP: 10, survivalSeconds: 120 })),
      events: [],
      focusFireEvents: [],
      focusFireMetrics: { team1: 1, team2: 1 },
      allySupportMetrics: { team1: 1, team2: 1 },
      formationDefenceMetrics: { team1: 1, team2: 1 },
      arenaRadius: 20,
      startingPositions: {},
      endingPositions: {},
    },
  } as unknown as BattleLogResponse;
}

const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

// ── The component ────────────────────────────────────────────────────

describe('AutomatonBadge', () => {
  it.each<[StableType | undefined | null]>([['human'], ['generated'], [undefined], [null]])(
    'renders nothing for stable type %s',
    (stableType) => {
      const { container } = render(<AutomatonBadge stableType={stableType} />);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('renders the label "Automaton" as its text with a decorative gear and no tooltip', () => {
    render(<AutomatonBadge stableType="automaton" />);
    const badge = screen.getByTestId('automaton-badge');
    expect(badge).toHaveTextContent(/^Automaton$/);
    expect(badge).not.toHaveAttribute('title');
    expect(badge.querySelector('[title]')).toBeNull();
    const icon = within(badge).getByTestId('automaton-badge-icon');
    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    // Not interactive: no role, no tab stop, no button or link inside.
    expect(badge).not.toHaveAttribute('tabindex');
    expect(badge.querySelector('a, button, [tabindex]')).toBeNull();
  });

  it('is compact by default: the label is visually hidden below 640 px and shown from sm', () => {
    render(<AutomatonBadge stableType="automaton" />);
    const label = screen.getByTestId('automaton-badge-label');
    expect(label).toHaveClass('sr-only', 'sm:not-sr-only');
    expect(label).toHaveTextContent('Automaton');
    expect(screen.getByTestId('automaton-badge')).toHaveAttribute('data-compact', 'true');
  });

  it('always shows the label when compact is off (page headers)', () => {
    render(<AutomatonBadge stableType="automaton" compact={false} />);
    expect(screen.getByTestId('automaton-badge-label').className).not.toContain('sr-only');
  });

  it('uses 12 px text for md and 10 px uppercase for sm', () => {
    const { rerender } = render(<AutomatonBadge stableType="automaton" size="md" />);
    expect(screen.getByTestId('automaton-badge')).toHaveClass('text-xs');
    rerender(<AutomatonBadge stableType="automaton" size="sm" />);
    expect(screen.getByTestId('automaton-badge')).toHaveClass('text-[10px]', 'uppercase');
  });

  it('uses the theme info colour with an opaque tint, at least 4.5:1 on every card colour', () => {
    render(<AutomatonBadge stableType="automaton" />);
    const badge = screen.getByTestId('automaton-badge');
    expect(badge).toHaveClass('text-info', 'border-info/40', AUTOMATON_BADGE_BACKGROUND_CLASS);
    expect(AUTOMATON_BADGE_BACKGROUND_CLASS).toBe('bg-[color-mix(in_srgb,var(--color-info)_15%,var(--color-background))]');

    const info = themeToken('info');
    // The tint is mixed over the page background and is opaque, so the card underneath does not matter.
    const pill = mix(info, themeToken('background'), 0.15);
    expect(contrast(info, pill)).toBeGreaterThanOrEqual(4.5);
    // Why it is opaque: a translucent 15% tint would fall below 4.5:1 on surface cards.
    expect(contrast(info, mix(info, themeToken('surface'), 0.15))).toBeLessThan(4.5);
  });
});

// ── Component surfaces ───────────────────────────────────────────────

describe('OwnerNameLink with the Automaton_Badge', () => {
  it('keeps the plain link for human and generated stables', () => {
    inRouter(
      <>
        <OwnerNameLink userId={1} displayName="Iron Warriors" stableType="human" />
        <OwnerNameLink userId={2} displayName="auto_rusty" stableType="generated" />
        <OwnerNameLink userId={3} displayName="Legacy" />
      </>,
    );
    expect(screen.queryByTestId('automaton-badge')).toBeNull();
    expect(screen.getByRole('link', { name: 'Iron Warriors' })).toHaveAttribute('href', '/stables/1');
  });

  it('puts the badge directly after the name, on one non-wrapping line with a truncating name', () => {
    inRouter(<OwnerNameLink userId={7} displayName="Kamino Clone Legion" stableType="automaton" className="truncate ml-2" />);
    const link = screen.getByRole('link', { name: 'Kamino Clone Legion' });
    expect(link).toHaveAttribute('href', '/stables/7');
    expect(link).toHaveClass('truncate', 'min-w-0');
    const badge = screen.getByTestId('automaton-badge');
    expect(link.nextElementSibling).toBe(badge);
    const wrapper = link.parentElement as HTMLElement;
    expect(wrapper).toHaveClass('inline-flex', 'flex-nowrap', 'min-w-0');
    // The badge is outside the link: it adds no touch target and is not part of the link name.
    expect(link).not.toContainElement(badge);
  });
});

describe('BattleResultBanner with the Automaton_Badge', () => {
  it('shows the compact badge after the Automaton stable name only', () => {
    inRouter(<BattleResultBanner battleLog={oneVsOne()} userId={10} />);
    const badges = screen.getAllByTestId('automaton-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveAttribute('data-compact', 'true');
    const stableLink = screen.getByRole('link', { name: 'Kamino Clone Legion' });
    expect(stableLink.nextElementSibling).toBe(badges[0]);
    expect(stableLink.parentElement).toHaveClass('flex-nowrap');
    expect(screen.getByRole('link', { name: 'Iron Warriors' }).nextElementSibling).toBeNull();
  });

  it('shows the badge in the mobile layout too', () => {
    inRouter(<BattleResultBanner battleLog={oneVsOne()} userId={10} isMobile />);
    expect(screen.getAllByTestId('automaton-badge')).toHaveLength(1);
  });
});

describe('TeamBattleMetrics with the Automaton_Badge', () => {
  it('shows the badge after the Automaton team stable name and in the coordination header', () => {
    inRouter(<TeamBattleMetrics battleLog={twoVsTwo()} />);
    const badges = screen.getAllByTestId('automaton-badge');
    // Team Performance owner line + Team Coordination column header, for the Automaton side only.
    expect(badges).toHaveLength(2);
    const ownerLink = screen.getByRole('link', { name: 'Pan Pacific Defense Corps' });
    expect(ownerLink.closest('.flex-nowrap')).toContainElement(badges[0]);
    const header = screen.getAllByRole('columnheader').find((th) => th.textContent?.startsWith('Pan Pacific Defense Corps'));
    expect(header).toBeDefined();
    expect(header).toContainElement(badges[1]);
    expect(screen.getAllByRole('columnheader').find((th) => th.textContent === 'Iron Warriors')).toBeDefined();
  });
});
