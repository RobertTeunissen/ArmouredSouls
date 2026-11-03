/**
 * Admin portal navigation configuration, shared by the desktop sidebar and the
 * mobile drawer so the two can never list different pages. Labels only: the
 * section headings group the pages, so icons added nothing but noise.
 */

export interface NavItem {
  label: string;
  path: string;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin/dashboard' },
      { label: 'System', path: '/admin/system' },
    ],
  },
  {
    section: 'Game Operations',
    items: [
      { label: 'Cycle Controls', path: '/admin/cycles' },
      { label: 'Season Control', path: '/admin/seasons' },
      { label: 'Practice Arena', path: '/admin/practice-arena' },
    ],
  },
  {
    section: 'Battle Data',
    items: [
      { label: 'Battles', path: '/admin/battles' },
      { label: 'Attributes', path: '/admin/attributes' },
      { label: 'Meta', path: '/admin/meta' },
      { label: 'League Health', path: '/admin/league-health' },
      { label: 'Tournaments', path: '/admin/tournaments' },
      { label: 'Weapons', path: '/admin/weapons' },
    ],
  },
  {
    section: 'Player Management',
    items: [
      { label: 'Players', path: '/admin/players' },
      { label: 'Economy', path: '/admin/economy' },
      { label: 'Automatons', path: '/admin/automatons' },
    ],
  },
  {
    section: 'Security & Moderation',
    items: [
      { label: 'Security', path: '/admin/security' },
      { label: 'Image Uploads', path: '/admin/image-uploads' },
      { label: 'Admin actions', path: '/admin/actions' },
    ],
  },
  {
    section: 'Content',
    items: [
      { label: 'Changelog', path: '/admin/changelog' },
      { label: 'Achievements', path: '/admin/achievements' },
      { label: 'Search Analytics', path: '/admin/search-analytics' },
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
