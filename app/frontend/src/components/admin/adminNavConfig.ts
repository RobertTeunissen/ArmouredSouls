/**
 * Admin portal navigation configuration, shared by the desktop sidebar and the
 * mobile drawer so the two can never list different pages.
 */

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
    ],
  },
  {
    section: 'Game Operations',
    items: [
      { label: 'Cycle Controls', path: '/admin/cycles', icon: '⚙️' },
      { label: 'Season Control', path: '/admin/seasons', icon: '🗓️' },
      { label: 'Practice Arena', path: '/admin/practice-arena', icon: '🏟️' },
    ],
  },
  {
    section: 'Battle Data',
    items: [
      { label: 'Battles', path: '/admin/battles', icon: '⚔️' },
      { label: 'Robot Stats', path: '/admin/robot-stats', icon: '🤖' },
      { label: 'Meta', path: '/admin/meta', icon: '🧭' },
      { label: 'League Health', path: '/admin/league-health', icon: '🏆' },
      { label: 'League History', path: '/admin/league-history', icon: '📈' },
      { label: 'Tournaments', path: '/admin/tournaments', icon: '🎖️' },
      { label: 'Weapons', path: '/admin/weapons', icon: '🔫' },
    ],
  },
  {
    section: 'Player Management',
    items: [
      { label: 'Players', path: '/admin/players', icon: '👥' },
      { label: 'Economy', path: '/admin/economy', icon: '💰' },
      { label: 'Automatons', path: '/admin/automatons', icon: '🤖' },
    ],
  },
  {
    section: 'Security & Moderation',
    items: [
      { label: 'Security', path: '/admin/security', icon: '🛡️' },
      { label: 'Image Uploads', path: '/admin/image-uploads', icon: '🖼️' },
    ],
  },
  {
    section: 'Content',
    items: [
      { label: 'Changelog', path: '/admin/changelog', icon: '📝' },
      { label: 'Achievements', path: '/admin/achievements', icon: '🏅' },
      { label: 'Tuning', path: '/admin/tuning', icon: '🎛️' },
      { label: 'Refinement', path: '/admin/refinement', icon: '🔨' },
      { label: 'Subscriptions', path: '/admin/subscriptions', icon: '📋' },
      { label: 'Search Analytics', path: '/admin/search-analytics', icon: '🔎' },
    ],
  },
  {
    section: 'Maintenance',
    items: [
      { label: 'Repair Log', path: '/admin/repair-log', icon: '🔧' },
      { label: 'Audit Log', path: '/admin/audit-log', icon: '📋' },
    ],
  },
];

/**
 * Whether a nav item is the active page. `/admin/cycles` matches exactly so
 * it is not highlighted on `/admin/cycles/history`.
 */
export function isNavItemActive(path: string, pathname: string): boolean {
  if (path === '/admin/cycles') return pathname === '/admin/cycles';
  return pathname.startsWith(path);
}
