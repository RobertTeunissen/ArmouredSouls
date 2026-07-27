import type { ReactNode } from 'react';

export interface RecordSectionProps {
  title: string;
  /**
   * Optional scope note rendered under the heading.
   *
   * Spec #46 R4.13/R4.14: several Career categories cover different sets of
   * modes, because `updateRobotCombatStats()` skips the win/loss/battle counters
   * for KotH and Grand Melee (both resolve by placement, where a "win" is
   * undefined for placements 2 through N) while still incrementing lifetime
   * damage. Without the note, a player reasonably reads every Career list as
   * covering every battle they have fought.
   */
  subtitle?: string;
  children: ReactNode;
}

export function RecordSection({ title, subtitle, children }: RecordSectionProps) {
  return (
    <div className="mb-10">
      <h2 className="text-2xl font-bold text-secondary mb-1">{title}</h2>
      {subtitle && <p className="text-sm text-tertiary mb-5">{subtitle}</p>}
      {!subtitle && <div className="mb-5" />}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}
