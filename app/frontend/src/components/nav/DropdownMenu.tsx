import { useState } from 'react';
import { Link } from 'react-router-dom';
import { implementedPages } from './types';

export interface DropdownMenuProps {
  label: string;
  items: Array<{ path: string; label: string; indent?: boolean }>;
  isActive: boolean;
  checkActive: (path: string) => boolean;
}

export function DropdownMenu({ label, items, isActive, checkActive }: DropdownMenuProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [closeTimer, setCloseTimer] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (): void => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      setCloseTimer(null);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = (): void => {
    // Add 200ms delay before closing
    const timer = setTimeout(() => {
      setIsOpen(false);
    }, 200);
    setCloseTimer(timer);
  };

  const isPageImplemented = (path: string): boolean => {
    // Allow any robot detail page (/robots/:id)
    if (path.match(/^\/robots\/\d+$/)) {
      return true;
    }
    return implementedPages.has(path);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`
          px-3 py-2 rounded-md transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-elevated
          ${isActive 
            ? 'text-primary bg-primary/15 border-b-2 border-primary font-semibold rounded-t-md' 
            : 'text-secondary hover:text-primary hover:bg-white/5'
          }
        `}
      >
        {label} ▾
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-0 w-56 bg-surface-elevated border border-white/10 rounded-md shadow-xl z-50 py-2">
          {items.map(item => {
            if (item.path === '---') {
              return <hr key="divider" className="my-1 border-white/10" />;
            }
            const disabled = !isPageImplemented(item.path);
            const active = checkActive(item.path);
            
            const itemClasses = `
              block w-full px-4 py-2 text-left transition-colors text-sm
              ${item.indent ? 'pl-8' : ''}
              ${disabled
                ? 'text-tertiary cursor-not-allowed opacity-60'
                : active
                  ? 'text-primary bg-primary/10'
                  : 'text-primary hover:bg-primary/5'
              }
            `;

            if (disabled) {
              return (
                <button key={item.path} type="button" disabled className={itemClasses}>
                  {item.label}
                </button>
              );
            }

            // Real anchor so Ctrl/Cmd-click and middle-click open a new tab (#573).
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  setIsOpen(false);
                  if (closeTimer) clearTimeout(closeTimer);
                }}
                className={itemClasses}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
