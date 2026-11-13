export interface UserRobot {
  id: number;
  name: string;
}

export interface NavItem {
  path: string;
  label: string;
  indent?: boolean;
}

export interface NavCategory {
  label: string;
  items: NavItem[];
}

// Complete page inventory - all implemented pages
export const implementedPages = new Set([
  '/dashboard',
  '/robots',
  '/robots/create',
  '/facilities',
  '/booking-office',
  '/weapon-shop',
  '/battle-history',
  '/league-standings',
  '/tournaments',
  '/team-battles',
  '/admin',
  '/leaderboards/fame',
  '/leaderboards/prestige',
  '/leaderboards/losses',
  '/hall-of-records',
  '/seasons',
  '/income',
  '/profile',
  '/system-health',
  '/guide',
  '/practice-arena',
  '/changelog',
  '/achievements',
]);

/**
 * Pages reachable from the navigation, including per-player pages (`/robots/:id`,
 * `/stables/:id`) and the owner's robot Workshop (`/robots/:id/prepare`, #504),
 * which the Robots menu links each of the player's robots to.
 */
export function isNavPageImplemented(path: string): boolean {
  return /^\/(robots|stables)\/\d+$/.test(path)
    || /^\/robots\/\d+\/prepare$/.test(path)
    || implementedPages.has(path);
}

/** The player's own public stable page: the first item of the Stable menu. */
function myStableItem(userId: number): NavItem {
  return { path: `/stables/${userId}`, label: 'My Stable' };
}

/** Stable menu items for a player, own stable page first. */
export function stableNavItems(userId: number): NavItem[] {
  return [myStableItem(userId), ...allPages.stable.items];
}

export const allPages: Record<string, NavCategory> = {
  robots: {
    label: 'Robots',
    items: [
      { path: '/robots', label: 'My Robots' },
      { path: '/robots/create', label: 'Create Robot' },
    ]
  },
  battle: {
    label: 'Battle',
    items: [
      { path: '/battle-history', label: 'Battle History' },
      { path: '/league-standings', label: 'League Standings' },
      { path: '/tournaments', label: 'Tournament Hub' },
      { path: '---', label: '' },
      { path: '/practice-arena', label: '🧪 Combat Simulator' },
    ]
  },
  stable: {
    label: 'Stable',
    items: [
      { path: '/facilities', label: 'Facilities' },
      { path: '/booking-office', label: '📋 Booking Office' },
      { path: '/team-battles', label: 'Team Management' },
      { path: '/weapon-shop', label: 'Weapon Shop' },
      { path: '/income', label: 'Finance Center' },
    ]
  },
  social: {
    label: 'Social',
    items: [
      { path: '/profile', label: 'My Profile' },
      { path: '/leaderboards/fame', label: 'Fame Leaderboard' },
      { path: '/leaderboards/prestige', label: 'Prestige Leaderboard' },
      { path: '/leaderboards/losses', label: 'Destructions Leaderboard' },
      { path: '/hall-of-records', label: 'Hall of Records' },
      { path: '/seasons', label: '📜 Season Archive' },
      { path: '/changelog', label: '📰 What\'s New' },
      { path: '/achievements', label: '🏆 Achievements' },
    ]
  },
};
