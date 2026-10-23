/**
 * Weapons: owned, equipped (main or offhand slot) and the equip rate.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AdminPanel, ADMIN_FOCUS_RING } from '../shared';
import type { SystemStats } from '../types';
import { formatCount, formatDecimal } from '../../../utils/adminDashboardFormat';

export interface WeaponsCardProps {
  weapons: SystemStats['weapons'] | null;
  loading: boolean;
  className?: string;
}

export function WeaponsCard({ weapons, loading, className = '' }: WeaponsCardProps): ReactNode {
  const equipped = weapons ? weapons.equippedInventoryItems ?? weapons.equipped : 0;
  const equipRate = weapons && weapons.totalBought > 0 ? (equipped / weapons.totalBought) * 100 : 0;

  return (
    <AdminPanel
      title="Weapons"
      actions={<Link to="/admin/weapons" className={`text-xs text-primary hover:underline ${ADMIN_FOCUS_RING}`}>Weapon analytics →</Link>}
      loading={loading && !weapons}
      skeletonRows={3}
      className={className}
    >
      {weapons && (
        <div className="px-5 py-4">
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-secondary">Owned</dt>
              <dd className="text-xl font-semibold tabular-nums text-white">{formatCount(weapons.totalBought)}</dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Equipped</dt>
              <dd className="text-xl font-semibold tabular-nums text-white">{formatCount(equipped)}</dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Equip rate</dt>
              <dd className="text-xl font-semibold tabular-nums text-white">{formatDecimal(equipRate)}%</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-tertiary">Equipped counts main and offhand slots.</p>
        </div>
      )}
    </AdminPanel>
  );
}
