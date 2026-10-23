/**
 * Admin portal navigation: the grouped link list shared by the desktop
 * sidebar and the mobile drawer, so the two can never list different pages.
 */
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from './shared/focusRing';
import { NAV_GROUPS, isNavItemActive } from './adminNavConfig';

export function AdminNavList({ onNavigate }: { onNavigate?: () => void }): ReactNode {
  const location = useLocation();

  return (
    <nav aria-label="Admin pages" className="flex-1 py-3 space-y-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.section}>
          <h3 className="px-4 mb-1 text-xs font-semibold text-tertiary uppercase tracking-wider">
            {group.section}
          </h3>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isNavItemActive(item.path, location.pathname);
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/admin/cycles'}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors motion-reduce:transition-none ${ADMIN_FOCUS_RING}
                      ${active
                        ? 'bg-primary/15 text-primary border-r-2 border-primary'
                        : 'text-secondary hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <span className="text-base shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
