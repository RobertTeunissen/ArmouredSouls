import { useState, useEffect } from 'react';
import type { OwnedRobot, SparringPartnerDef, SlotState, AcademyLevels } from './types';
import { SlotToggle } from './SlotToggle';
import { WhatIfPanel } from './WhatIfPanel';
import type { TuningAllocations } from './WhatIfPanel';
import { SparringConfigPanel } from './SparringConfigPanel';
import RobotImage from '../RobotImage';
import apiClient from '../../utils/apiClient';

export interface BattleSlotPanelProps {
  label: string;
  slot: SlotState;
  robots: OwnedRobot[];
  sparringDefs: SparringPartnerDef[];
  onSlotChange: (s: SlotState) => void;
  forceOwned?: boolean;
  trainingLevel?: number;
  academyLevels?: AcademyLevels;
}

export function BattleSlotPanel({
  label,
  slot,
  robots,
  sparringDefs,
  onSlotChange,
  forceOwned = false,
  trainingLevel = 0,
  academyLevels = { combat_training_academy: 0, defense_training_academy: 0, mobility_training_academy: 0, ai_training_academy: 0 },
}: BattleSlotPanelProps) {
  const selectedRobot = robots.find((r) => r.id === slot.robotId) || null;

  // Fetch tuning allocation when an owned robot is selected
  const [tuningAllocations, setTuningAllocations] = useState<TuningAllocations | undefined>(undefined);

  useEffect(() => {
    if (slot.mode !== 'owned' || !slot.robotId) {
      setTuningAllocations(undefined);
      return;
    }

    let cancelled = false;
    apiClient
      .get(`/api/robots/${slot.robotId}/tuning-allocation`)
      .then((res) => {
        if (!cancelled) {
          setTuningAllocations(res.data?.allocations || undefined);
        }
      })
      .catch(() => {
        // Don't block the panel if the fetch fails — just don't show tuning
        if (!cancelled) {
          setTuningAllocations(undefined);
        }
      });

    return () => { cancelled = true; };
  }, [slot.mode, slot.robotId]);

  return (
    <div className="bg-surface-elevated rounded-lg border border-white/10 p-4 space-y-4">
      <h3 className="text-lg font-semibold text-primary">{label}</h3>

      {!forceOwned && (
        <SlotToggle
          mode={slot.mode}
          onChange={(m) => onSlotChange({ ...slot, mode: m })}
        />
      )}

      {slot.mode === 'owned' ? (
        <div className="space-y-3">
          {/* Robot image grid selector */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {robots.map((r) => {
              const isSelected = slot.robotId === r.id;
              const hasNoWeapon = !r.mainWeaponId;
              return (
                <button
                  key={r.id}
                  onClick={() => onSlotChange({ ...slot, robotId: r.id, overrides: {} })}
                  className={`relative rounded-lg p-1 transition-all ${
                    isSelected
                      ? 'ring-2 ring-primary bg-primary/10'
                      : 'hover:bg-white/5 border border-transparent hover:border-white/10'
                  }`}
                  title={hasNoWeapon ? `${r.name} — no weapon equipped` : r.name}
                >
                  <RobotImage
                    imageUrl={r.imageUrl ?? null}
                    robotName={r.name}
                    size="small"
                  />
                  <p className="text-xs text-center mt-1 truncate text-secondary">{r.name}</p>
                  {hasNoWeapon && (
                    <div className="absolute top-0 right-0 bg-error text-white text-xs rounded-full w-4 h-4 flex items-center justify-center" title="No weapon">!</div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedRobot && !selectedRobot.mainWeaponId && (
            <div className="bg-red-900/30 border border-red-500/50 rounded p-3 text-sm text-red-400">
              ⚠️ {selectedRobot.name} has no weapon equipped. Equip a weapon before running a simulation.
            </div>
          )}

          {selectedRobot && selectedRobot.mainWeaponId && (
            <WhatIfPanel
              robot={selectedRobot}
              overrides={slot.overrides}
              onChange={(o) => onSlotChange({ ...slot, overrides: o })}
              trainingLevel={trainingLevel}
              academyLevels={academyLevels}
              tuningAllocations={tuningAllocations}
            />
          )}
        </div>
      ) : (
        <SparringConfigPanel
          config={slot.sparringConfig}
          definitions={sparringDefs}
          onChange={(c) => onSlotChange({ ...slot, sparringConfig: c })}
        />
      )}
    </div>
  );
}
