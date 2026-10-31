/**
 * Searchable stable picker (ARIA 1.2 combobox with a listbox popup): type
 * part of a stable name, catalogue key or franchise, then pick with the mouse
 * or ArrowUp / ArrowDown + Enter; Escape closes the list. Replaces a plain
 * `<select>` that grew to 500 options. Shows at most 50 matches.
 */
import { useId, useMemo, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { ProfileListItem } from '../../../utils/automatonAdminApi';
import { INPUT_CLASS } from './ui';
import { matchesSearch } from './stablesView';

export const STABLE_PICKER_LIMIT = 50;

export interface StablePickerProps {
  /** Input id from the surrounding `Field`, so its label names the combobox. */
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  profiles: readonly ProfileListItem[];
  selectedKey: string | null;
  onSelect: (catalogueKey: string) => void;
  /** Adds "(Active)" / "(Draft)" after the name. */
  showStatus?: boolean;
  placeholder?: string;
}

function optionLabel(profile: ProfileListItem, showStatus: boolean): string {
  return showStatus ? `${profile.stableName} (${profile.status === 'active' ? 'Active' : 'Draft'})` : profile.stableName;
}

export function StablePicker({ id, profiles, selectedKey, onSelect, showStatus = false, placeholder = 'Search a stable…', ...rest }: StablePickerProps): ReactNode {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const listId = `${inputId}-list`;
  const selected = profiles.find((p) => p.catalogueKey === selectedKey) ?? null;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const text = query ?? (selected ? optionLabel(selected, showStatus) : '');
  const matches = useMemo(
    () => profiles.filter((p) => matchesSearch(p, query ?? '')).slice(0, STABLE_PICKER_LIMIT),
    [profiles, query],
  );

  const choose = (profile: ProfileListItem): void => {
    onSelect(profile.catalogueKey);
    setQuery(null);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(matches.length - 1, open ? i + 1 : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery(null);
    }
  };

  return (
    <div className="relative">
      <input
        {...rest}
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].catalogueKey}` : undefined}
        autoComplete="off"
        className={INPUT_CLASS}
        value={text}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setActive(0); }}
        onBlur={() => { setOpen(false); setQuery(null); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-white/10 bg-surface-elevated py-1 shadow-lg">
          {matches.length === 0 ? (
            <li role="option" aria-selected={false} aria-disabled="true" className="px-3 py-2 text-sm text-secondary">No stable matches</li>
          ) : matches.map((profile, index) => (
            <li
              key={profile.catalogueKey}
              id={`${listId}-${profile.catalogueKey}`}
              role="option"
              aria-selected={profile.catalogueKey === selectedKey}
              onMouseDown={(e) => { e.preventDefault(); choose(profile); }}
              onMouseEnter={() => setActive(index)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm ${index === active ? 'bg-primary/20 text-white' : 'text-white'}`}
            >
              <span className="truncate">{optionLabel(profile, showStatus)}</span>
              <span className="shrink-0 text-xs text-secondary">{profile.catalogueKey}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
