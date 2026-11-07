/**
 * Robot page routes (#504): the public profile `/robots/:id` and the owner's
 * Workshop `/robots/:id/prepare` (Build, or `?section=loadout`).
 */

export type WorkshopSection = 'build' | 'loadout';

/** The Workshop for a robot, optionally on a section and in the onboarding tutorial. */
export function workshopPath(robotId: number, section: WorkshopSection = 'build', onboarding = false): string {
  const params = new URLSearchParams();
  if (section === 'loadout') params.set('section', 'loadout');
  if (onboarding) params.set('onboarding', 'true');
  const query = params.toString();
  return `/robots/${robotId}/prepare${query ? `?${query}` : ''}`;
}

/** Where a click on a robot goes: the owner's Workshop, everyone else's profile. */
export function robotPath(robotId: number, isOwner: boolean): string {
  return isOwner ? workshopPath(robotId) : `/robots/${robotId}`;
}

/** Old robot detail tabs that now live in the Workshop. */
const WORKSHOP_TABS: Readonly<Record<string, WorkshopSection>> = {
  upgrades: 'build',
  tuning: 'build',
  stats: 'build',
  'battle-config': 'loadout',
};

/**
 * Workshop path for an old `?tab=` link, or null when the tab belongs to the
 * profile. The onboarding tutorial (equip a weapon) lands on Loadout.
 */
export function workshopPathForTab(robotId: number | undefined, tab: string | null, onboarding: boolean): string | null {
  if (robotId === undefined) return null;
  const section = tab ? WORKSHOP_TABS[tab] : undefined;
  if (section) return workshopPath(robotId, section, onboarding);
  if (onboarding) return workshopPath(robotId, 'loadout', true);
  return null;
}
