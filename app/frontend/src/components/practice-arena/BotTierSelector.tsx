import type { BotTier, SparringPartnerDef } from './types';
import { BOT_TIER_DISPLAY } from './constants';

export interface BotTierSelectorProps {
  selected: BotTier;
  definitions: SparringPartnerDef[];
  onSelect: (t: BotTier) => void;
}

export function BotTierSelector({ selected, definitions, onSelect }: BotTierSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {definitions.map((def) => {
        const display = BOT_TIER_DISPLAY[def.botTier as BotTier] ?? { name: def.botTier, emoji: '🤖', color: 'border-gray-500 bg-gray-800' };
        const isSelected = selected === def.botTier;
        return (
          <button
            key={def.botTier}
            onClick={() => onSelect(def.botTier)}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              isSelected
                ? `${display.color} ring-2 ring-primary`
                : 'border-white/10 bg-surface hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{display.emoji}</span>
              <span className="font-semibold text-sm">{display.name}</span>
            </div>
            <p className="text-xs text-secondary">Attr Level: {def.attributeLevel}</p>
            <p className="text-xs text-secondary">
              {def.botTier === 'WimpBot' ? 'Budget Tier Weapons' : def.botTier === 'AverageBot' ? 'Standard Tier Weapons' : def.botTier === 'ExpertBot' ? 'Premium Tier Weapons' : 'Luxury Tier Weapons'}
            </p>
          </button>
        );
      })}
    </div>
  );
}
