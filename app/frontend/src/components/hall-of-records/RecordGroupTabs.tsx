import { RECORD_GROUP_LABELS } from '../../utils/hallOfRecords';
import { ScrollRow } from './ScrollRow';
import { RECORD_GROUPS, type RecordGroupKey } from './types';

export interface RecordGroupTabsProps {
  active: RecordGroupKey | null;
  /** Groups that have at least one record; empty groups get no tab. */
  available: readonly RecordGroupKey[];
  onSelect: (group: RecordGroupKey | null) => void;
}

/** "All records" plus one filter per record group. The choice lives in the URL. */
export function RecordGroupTabs({ active, available, onSelect }: RecordGroupTabsProps) {
  const options: Array<{ key: RecordGroupKey | null; label: string }> = [
    { key: null, label: 'All records' },
    ...RECORD_GROUPS.filter((group) => available.includes(group)).map((group) => ({ key: group, label: RECORD_GROUP_LABELS[group] })),
  ];

  return (
    <ScrollRow label="Record groups">
      {options.map((option) => {
        const selected = option.key === active;
        return (
          <button
            key={option.key ?? 'all'}
            type="button"
            onClick={() => onSelect(option.key)}
            aria-pressed={selected}
            className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors ${
              selected ? 'bg-warning text-background' : 'border border-white/10 bg-surface text-secondary hover:bg-surface-elevated'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </ScrollRow>
  );
}
