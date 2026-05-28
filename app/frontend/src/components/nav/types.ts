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
  '/koth-standings',
  '/tournaments',
  '/tag-teams',
  '/tag-teams/standings',
  '/admin',
  '/leaderboards/fame',
  '/leaderboards/prestige',
  '/leaderboards/losses',
  '/hall-of-records',
  '/income',
  '/profile',
  '/cycle-summary',
  '/system-health',
  '/guide',
  '/practice-arena',
  '/changelog',
  '/achievements',
]);

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
      { path: '/koth-standings', label: 'King of the Hill Standings' },
      { path: '/tag-teams/standings', label: 'Tag Team Standings' },
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
      { path: '/weapon-shop', label: 'Weapon Shop' },
      { path: '/tag-teams', label: 'Tag Team Management' },
      { path: '/income', label: 'Income Dashboard' },
      { path: '/cycle-summary', label: 'Cycle Summary' },
    ]
  },
  social: {
    label: 'Social',
    items: [
      { path: '/profile', label: 'My Profile' },
      { path: '/leaderboards/fame', label: 'Fame Leaderboard' },
      { path: '/leaderboards/prestige', label: 'Prestige Leaderboard' },
      { path: '/leaderboards/losses', label: 'Total Losses Leaderboard' },
      { path: '/hall-of-records', label: 'Hall of Records' },
      { path: '/changelog', label: '📰 What\'s New' },
      { path: '/achievements', label: '🏆 Achievements' },
    ]
  },
};
