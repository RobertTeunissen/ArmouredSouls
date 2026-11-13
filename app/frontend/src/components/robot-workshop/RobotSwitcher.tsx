import { useNavigate } from 'react-router-dom';

interface RobotSwitcherProps {
  robots: ReadonlyArray<{ id: number; name: string }>;
  currentId: number;
  /** Section kept when switching (`?section=loadout`). */
  section: 'build' | 'loadout';
  /** Asked before leaving with unsaved changes; return false to stay. */
  confirmLeave: () => boolean;
}

const ARROW = 'flex h-11 w-11 items-center justify-center rounded-md text-secondary transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 lg:h-9 lg:w-9';

/** Previous / next robot and a picker, so a stable is prepared without going back to the list. */
export function RobotSwitcher({ robots, currentId, section, confirmLeave }: RobotSwitcherProps) {
  const navigate = useNavigate();
  const index = robots.findIndex((r) => r.id === currentId);
  const go = (id: number): void => {
    if (id === currentId || !confirmLeave()) return;
    navigate(`/robots/${id}/prepare${section === 'loadout' ? '?section=loadout' : ''}`);
  };
  if (robots.length < 2 || index < 0) return null;
  const prev = robots[(index - 1 + robots.length) % robots.length];
  const next = robots[(index + 1) % robots.length];

  return (
    <nav aria-label="Switch robot" className="flex items-center gap-1 rounded-lg bg-surface-elevated px-1">
      <button type="button" className={ARROW} onClick={() => go(prev.id)} aria-label={`Previous robot: ${prev.name}`}>◀</button>
      <label className="flex items-center gap-2">
        <span className="sr-only">Robot</span>
        <select
          value={currentId}
          onChange={(e) => go(Number(e.target.value))}
          className="min-h-[44px] max-w-[11rem] truncate rounded bg-transparent px-1 text-sm font-semibold text-white sm:max-w-[16rem] lg:min-h-[36px]"
        >
          {robots.map((r) => <option key={r.id} value={r.id} className="bg-surface">{r.name}</option>)}
        </select>
        <span className="hidden text-xs text-secondary sm:inline">{index + 1} of {robots.length}</span>
      </label>
      <button type="button" className={ARROW} onClick={() => go(next.id)} aria-label={`Next robot: ${next.name}`}>▶</button>
    </nav>
  );
}

