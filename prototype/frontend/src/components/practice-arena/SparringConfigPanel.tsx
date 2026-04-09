import type { SparringConfig, SparringPartnerDef } from './types';
import { LOADOUT_OPTIONS, RANGE_OPTIONS, STANCE_OPTIONS } from './constants';
import { BotTierSelector } from './BotTierSelector';
import { ConfigSelect } from './ConfigSelect';

export interface SparringConfigPanelProps {
  config: SparringConfig;
  definitions: SparringPartnerDef[];
  onChange: (c: SparringConfig) => void;
}

export function SparringConfigPanel({ config, definitions, onChange }: SparringConfigPanelProps) {
  return (
    <div className="space-y-4">
      <BotTierSelector
        selected={config.botTier}
        definitions={definitions}
        onSelect={(t) => onChange({ ...config, botTier: t })}
      />
      <div className="grid grid-cols-2 gap-3">
        <ConfigSelect
          label="Loadout Type"
          value={config.loadoutType}
          options={LOADOUT_OPTIONS}
          onChange={(v) => onChange({ ...config, loadoutType: v })}
        />
        <ConfigSelect
          label="Range Band"
          value={config.rangeBand}
          options={RANGE_OPTIONS}
          onChange={(v) => onChange({ ...config, rangeBand: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ConfigSelect
          label="Stance"
          value={config.stance}
          options={STANCE_OPTIONS.map(s => ({ value: s.value, label: `${s.emoji} ${s.label}` }))}
          onChange={(v) => onChange({ ...config, stance: v })}
        />
        <div>
          <label className="block text-xs text-secondary mb-1">
            Yield Threshold: {config.yieldThreshold}%
          </label>
          <input
            type="range"
            min={0}
            max={50}
            value={config.yieldThreshold}
            onChange={(e) => onChange({ ...config, yieldThreshold: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>
      <p className="text-xs text-secondary italic">
        🤖 AI-assigned loadout — weapons auto-selected based on tier and config
      </p>
    </div>
  );
}
