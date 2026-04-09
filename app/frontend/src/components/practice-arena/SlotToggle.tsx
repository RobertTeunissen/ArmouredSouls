import type { SlotMode } from './types';

export interface SlotToggleProps {
  mode: SlotMode;
  onChange: (m: SlotMode) => void;
}

export function SlotToggle({ mode, onChange }: SlotToggleProps) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/10">
      <button
        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
          mode === 'owned' ? 'bg-primary text-white' : 'bg-surface text-secondary hover:bg-white/5'
        }`}
        onClick={() => onChange('owned')}
      >
        Deploy Robot
      </button>
      <button
        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
          mode === 'sparring' ? 'bg-primary text-white' : 'bg-surface text-secondary hover:bg-white/5'
        }`}
        onClick={() => onChange('sparring')}
      >
        Simulate Opponent
      </button>
    </div>
  );
}
