import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { requiredTeamNameCounts, teamNameMaxRobots, type RobotsBoundGoal } from '../../../../shared/utils/automatonTeamRule';

/**
 * Spec #55 e2e helpers: an Active_Automaton with robots, created through the
 * admin API as the seeded `admin` (prisma/seed.ts), plus layout checks shared
 * by `admin-automatons.spec.ts` and `automaton-badge.spec.ts`.
 *
 * These specs create stables and run a bulk cycle, so they only run against a
 * local stack (the local dev server or the CI e2e job, both on localhost).
 */

/** The backend. Locally Vite proxies `/api`, but the CI preview server does not, so call the API directly. */
export const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';

export const ADMIN_USERNAME = 'admin';
export const ADMIN_PASSWORD = 'admin123';

/** Fixed key, so a reused local database keeps one e2e stable instead of one per run. */
export const E2E_AUTOMATON_KEY = 'e2e-automaton';
export const E2E_AUTOMATON_NAME = 'Circuit Foundry';
/** Repository Catalogue_Entry the e2e stable copies its strategy, Event_Order and blueprints from. */
const TEMPLATE_CATALOGUE_KEY = 'light-labs';

/** True when the run targets this machine, never ACC or PRD. */
export function isLocalTarget(): boolean {
  const base = process.env.PLAYWRIGHT_BASE_URL;
  const api = new URL(API_URL);
  const isLocal = (host: string): boolean => host === 'localhost' || host === '127.0.0.1';
  return isLocal(api.hostname) && (!base || isLocal(new URL(base).hostname));
}

export const LOCAL_ONLY_REASON = 'Creates Automaton stables and runs a bulk cycle: local stack only.';

interface TeamNames { twoVsTwo: string[]; threeVsThree: string[] }

interface TemplateBlueprint { slot: number; [field: string]: unknown }

interface CatalogueTemplate {
  strategy: { key: string };
  eventOrder: string[];
  teamNames: TeamNames;
  blueprints: TemplateBlueprint[];
}

interface ProfileDetail {
  catalogueKey: string;
  status: 'draft' | 'active';
  userId: number | null;
  blueprints: { slot: number; liveRobot: { id: number; name: string } | null }[];
}

interface LibraryResponse {
  strategies: { key: string; latestVersion: number; versions: { version: number; buildOrder: RobotsBoundGoal[] }[] }[];
}

export interface E2eAutomaton {
  key: string;
  stableName: string;
  userId: number;
  robots: { id: number; name: string }[];
}

export async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { identifier: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  });
  expect(response.ok(), `admin login failed with ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as { token: string };
  return body.token;
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function getProfile(request: APIRequestContext, token: string, key: string): Promise<ProfileDetail | null> {
  const response = await request.get(`${API_URL}/api/admin/automatons/${key}`, { headers: auth(token) });
  if (response.status() === 404) return null;
  expect(response.ok(), `GET profile ${key}: ${response.status()} ${await response.text()}`).toBeTruthy();
  return (await response.json()) as ProfileDetail;
}

async function send(request: APIRequestContext, token: string, method: 'post' | 'delete', path: string, data?: unknown): Promise<unknown> {
  const response = await request[method](`${API_URL}${path}`, { headers: auth(token), data });
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function readTemplate(): CatalogueTemplate {
  const file = resolve(import.meta.dirname, `../../../../backend/prisma/automaton-catalogue/${TEMPLATE_CATALOGUE_KEY}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as CatalogueTemplate;
}

/** Team_Names for `blueprintCount` blueprints under the strategy's Build_Order (the shared Team_Rule). */
function teamNamesFor(template: CatalogueTemplate, buildOrder: RobotsBoundGoal[], blueprintCount: number): TeamNames {
  const counts = requiredTeamNameCounts(teamNameMaxRobots(buildOrder, blueprintCount));
  return {
    twoVsTwo: template.teamNames.twoVsTwo.slice(0, counts.twoVsTwo),
    threeVsThree: template.teamNames.threeVsThree.slice(0, counts.threeVsThree),
  };
}

/** Creates the Draft_Automaton through `/api/admin/automatons`, adding the template's blueprints one by one. */
async function createDraft(request: APIRequestContext, token: string): Promise<void> {
  const template = readTemplate();
  const library = (await (await request.get(`${API_URL}/api/admin/automatons/strategies`, { headers: auth(token) })).json()) as LibraryResponse;
  const strategy = library.strategies.find((s) => s.key === template.strategy.key);
  const buildOrder = strategy?.versions.find((v) => v.version === strategy.latestVersion)?.buildOrder;
  expect(buildOrder, `strategy ${template.strategy.key} is missing from the library`).toBeDefined();

  await send(request, token, 'post', '/api/admin/automatons', {
    catalogueKey: E2E_AUTOMATON_KEY,
    stableName: E2E_AUTOMATON_NAME,
    franchise: 'End-to-end tests',
    backstory: 'A workshop stable created by the Playwright suite.',
    strategyKey: template.strategy.key,
    eventOrder: template.eventOrder,
  });
  for (const [index, blueprint] of template.blueprints.entries()) {
    await send(request, token, 'post', `/api/admin/automatons/${E2E_AUTOMATON_KEY}/blueprints`, {
      ...blueprint,
      teamNames: teamNamesFor(template, buildOrder ?? [], index + 1),
    });
  }
}

/** One admin bulk cycle: settlement runs the Automaton_Turn that buys the robots. */
export async function runBulkCycle(request: APIRequestContext, token: string): Promise<void> {
  const response = await request.post(`${API_URL}/api/admin/cycles/bulk`, {
    headers: auth(token),
    data: { cycles: 1 },
    timeout: 240_000,
  });
  expect(response.ok(), `bulk cycle: ${response.status()} ${await response.text()}`).toBeTruthy();
}

/**
 * The e2e Active_Automaton with at least one robot: creates and activates the
 * draft when it does not exist yet and runs one admin bulk cycle when it owns
 * no robot. Idempotent on a reused local database.
 */
export async function ensureE2eAutomaton(request: APIRequestContext, token: string): Promise<E2eAutomaton> {
  let profile = await getProfile(request, token, E2E_AUTOMATON_KEY);
  if (!profile) {
    await createDraft(request, token);
    profile = await getProfile(request, token, E2E_AUTOMATON_KEY);
  }
  if (profile?.status === 'draft') {
    await send(request, token, 'post', `/api/admin/automatons/${E2E_AUTOMATON_KEY}/activate`);
  }
  profile = await getProfile(request, token, E2E_AUTOMATON_KEY);
  if (profile && !profile.blueprints.some((b) => b.liveRobot)) {
    await runBulkCycle(request, token);
    profile = await getProfile(request, token, E2E_AUTOMATON_KEY);
  }
  expect(profile?.status).toBe('active');
  const robots = (profile?.blueprints ?? []).flatMap((b) => (b.liveRobot ? [b.liveRobot] : []));
  expect(robots.length, 'the Automaton owns no robot after a bulk cycle').toBeGreaterThan(0);
  return { key: E2E_AUTOMATON_KEY, stableName: E2E_AUTOMATON_NAME, userId: profile?.userId ?? 0, robots };
}

/** Latest battle of one of the robots, running up to `maxCycles` more bulk cycles until the robots have fought. */
export async function ensureBattle(request: APIRequestContext, token: string, robotIds: number[], maxCycles = 3): Promise<number> {
  for (let attempt = 0; ; attempt++) {
    for (const robotId of robotIds) {
      const response = await request.get(`${API_URL}/api/matches/history`, { headers: auth(token), params: { robotId, perPage: 1, page: 1 } });
      expect(response.ok()).toBeTruthy();
      const body = (await response.json()) as { data: { id: number }[] };
      if (body.data.length > 0) return body.data[0].id;
    }
    expect(attempt, 'the Automaton robots have not fought after the extra bulk cycles').toBeLessThan(maxCycles);
    await runBulkCycle(request, token);
  }
}

export async function robotLeague(request: APIRequestContext, token: string, robotId: number): Promise<{ tier: string; instance: string }> {
  const response = await request.get(`${API_URL}/api/robots/${robotId}`, { headers: auth(token) });
  expect(response.ok()).toBeTruthy();
  const robot = (await response.json()) as { currentLeague: string; leagueId: string };
  return { tier: robot.currentLeague, instance: robot.leagueId };
}

/**
 * A Strategy_Draft based on `basedOn` (`key.vN`). One draft per next version
 * may exist, so an existing draft of that version is reused; `created` says
 * whether this run made it (and should delete it).
 */
export async function createStrategyDraft(request: APIRequestContext, token: string, basedOn: string): Promise<{ id: number; created: boolean }> {
  const response = await request.post(`${API_URL}/api/admin/automatons/strategy-drafts`, { headers: auth(token), data: { basedOn } });
  if (response.ok()) return { id: ((await response.json()) as { id: number }).id, created: true };
  expect(response.status(), `create strategy draft: ${await response.text()}`).toBe(409);
  const key = basedOn.split('.')[0];
  const list = (await (await request.get(`${API_URL}/api/admin/automatons/strategy-drafts`, { headers: auth(token) })).json()) as { drafts: { id: number; key: string }[] };
  const existing = list.drafts.find((d) => d.key === key);
  expect(existing, `no existing draft of ${key}`).toBeDefined();
  return { id: existing?.id ?? 0, created: false };
}

export async function deleteStrategyDraft(request: APIRequestContext, token: string, id: number): Promise<void> {
  await send(request, token, 'delete', `/api/admin/automatons/strategy-drafts/${id}`);
}

/** Navigates and waits until the auth context has restored the session (no bounce to /login). */
export async function gotoAuthed(page: Page, path: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    if (!page.url().includes('/login')) return;
    await page.waitForTimeout(1000);
  }
  throw new Error(`redirected to /login while opening ${path}`);
}

// ── Layout checks ────────────────────────────────────────────────────

/**
 * No horizontal page scroll, and no element under `rootSelector` sticking out
 * of it (clipped overflow counts). Elements matching `exclude` (and their
 * content) are not inspected; the page-scroll check still covers them.
 */
export async function expectNoHorizontalOverflow(
  page: Page,
  rootSelector = 'body',
  { exclude, pageScroll = true }: { exclude?: string; pageScroll?: boolean } = {},
): Promise<void> {
  const roots = await page.locator(rootSelector).count();
  expect(roots, `no element matches ${rootSelector}`).toBeGreaterThan(0);
  for (let index = 0; index < roots; index++) {
    await expectRootFits(page, rootSelector, index, exclude ?? '', pageScroll);
  }
}

async function expectRootFits(page: Page, rootSelector: string, rootIndex: number, exclude: string, pageScroll: boolean): Promise<void> {
  const result = await page.evaluate(([selector, index, skip]) => {
    const doc = document.documentElement;
    const root = document.querySelectorAll(selector)[index];
    if (!root) return { pageOverflow: 0, offenders: [`missing root ${selector}`] };
    const limit = Math.min(root.getBoundingClientRect().right, doc.clientWidth) + 1;
    const offending: HTMLElement[] = [];
    for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      if (skip && element.closest(skip)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || rect.right <= limit) continue;
      // Content inside its own horizontal scroller (wide tables) is allowed.
      let scrolled = false;
      for (let a = element.parentElement; a && a !== root; a = a.parentElement) {
        const overflowX = getComputedStyle(a).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') { scrolled = true; break; }
      }
      if (!scrolled) offending.push(element);
    }
    // Report the innermost offenders: they are the elements that cause the overflow.
    const leaves = offending.filter((el) => !offending.some((other) => other !== el && el.contains(other)));
    const describe = (el: HTMLElement): string =>
      `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 50)} "${(el.textContent ?? '').trim().slice(0, 30)}" right=${Math.round(el.getBoundingClientRect().right)}`;
    return { pageOverflow: doc.scrollWidth - doc.clientWidth, offenders: leaves.slice(0, 5).map(describe) };
  }, [rootSelector, rootIndex, exclude] as const);
  const pageOverflow = pageScroll ? result.pageOverflow : 0;
  expect({ ...result, pageOverflow }, 'horizontal overflow').toEqual({ pageOverflow: Math.min(pageOverflow, 0), offenders: [] });
}

/** Every visible button, link and form control under `rootSelector` is at least 44 × 44 px. */
export async function expectTouchTargets(page: Page, rootSelector: string): Promise<void> {
  const small = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return [`missing root ${selector}`];
    const out: string[] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('button, select, input:not([type="hidden"]), textarea, [role="tab"]'))) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden') continue;
      // Visually hidden controls (an sr-only file input) are not pointer targets; their visible trigger is checked instead.
      if (rect.width <= 2 && rect.height <= 2 && el.tabIndex < 0) continue;
      const isCheck = el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');
      // A checkbox or radio counts through its label.
      const box = isCheck && el.closest('label') ? el.closest('label')!.getBoundingClientRect() : rect;
      if (box.width < 43.5 || box.height < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" ${Math.round(box.width)}×${Math.round(box.height)}`);
    }
    return out.slice(0, 10);
  }, rootSelector);
  expect(small, 'touch targets below 44 × 44 px').toEqual([]);
}

/** The focused element shows a visible focus indicator (outline or ring). */
export async function expectVisibleFocus(page: Page): Promise<void> {
  const visible = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const style = getComputedStyle(el);
    const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    const ring = style.boxShadow !== 'none' && style.boxShadow !== '';
    return outline || ring;
  });
  expect(visible, 'focused element has no visible focus indicator').toBeTruthy();
}

/**
 * Every visible Automaton_Badge sits on the line of the text right before it
 * (the stable name) and, below 640 px in compact mode, shows only the gear.
 */
export async function expectBadgesOnNameLine(page: Page, viewportWidth: number): Promise<number> {
  const report = await page.evaluate((width) => {
    const overlaps = (a: DOMRect, b: DOMRect): boolean => a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const problems: string[] = [];
    const badges = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="automaton-badge"]')).filter((b) => b.getBoundingClientRect().width > 0);
    for (const badge of badges) {
      const rect = badge.getBoundingClientRect();
      // The name: the previous element, or the text node right before the badge (headings, archive cells).
      let nameRect: DOMRect | null = null;
      let prev: Node | null = badge.previousSibling;
      while (prev && prev.nodeType === Node.TEXT_NODE && !(prev.textContent ?? '').trim()) prev = prev.previousSibling;
      if (prev instanceof HTMLElement) nameRect = prev.getBoundingClientRect();
      else if (prev && prev.nodeType === Node.TEXT_NODE) {
        const range = document.createRange();
        range.selectNodeContents(prev);
        const rects = Array.from(range.getClientRects());
        nameRect = rects.length > 0 ? rects[rects.length - 1] : null;
      }
      if (!nameRect) problems.push('badge without a name before it');
      else if (!overlaps(rect, nameRect)) problems.push(`badge wrapped below its name (${Math.round(nameRect.bottom)} / ${Math.round(rect.top)})`);
      const label = badge.querySelector<HTMLElement>('[data-testid="automaton-badge-label"]');
      const labelShown = !!label && label.getBoundingClientRect().width > 2;
      const compact = badge.dataset.compact === 'true';
      if (compact && width < 640 && labelShown) problems.push('compact badge shows its label below 640 px');
      if ((!compact || width >= 640) && !labelShown) problems.push('badge hides its label');
      if ((label?.textContent ?? '') !== 'Automaton') problems.push('badge label is not "Automaton"');
    }
    return { count: badges.length, problems: problems.slice(0, 5) };
  }, viewportWidth);
  expect(report.problems).toEqual([]);
  return report.count;
}
