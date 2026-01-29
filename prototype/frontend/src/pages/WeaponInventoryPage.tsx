import { useEffect, useState } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  description: string | null;
  baseDamage: number;
  cost: number;
  combatPowerBonus: number;
  targetingSystemsBonus: number;
  criticalSystemsBonus: number;
  penetrationBonus: number;
  weaponControlBonus: number;
  attackSpeedBonus: number;
  armorPlatingBonus: number;
  shieldCapacityBonus: number;
  evasionThrustersBonus: number;
  counterProtocolsBonus: number;
  servoMotorsBonus: number;
  gyroStabilizersBonus: number;
  hydraulicSystemsBonus: number;
  powerCoreBonus: number;
  threatAnalysisBonus: number;
}

interface WeaponInventory {
  id: number;
  weapon: Weapon;
  acquiredAt: string;
}

interface StorageStatus {
  currentCount: number;
  maxCapacity: number;
  percentUsed: number;
}

function WeaponInventoryPage() {
  const [weapons, setWeapons] = useState<WeaponInventory[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'damage' | 'acquired'>('acquired');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const [weaponsResponse, storageResponse] = await Promise.all([
        axios.get('http://localhost:3001/api/weapon-inventory'),
        axios.get('http://localhost:3001/api/weapon-inventory/storage-status'),
      ]);

      setWeapons(weaponsResponse.data);
      setStorageStatus(storageResponse.data);
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch inventory:', err);
      setError(err.response?.data?.error || 'Failed to load weapon inventory');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'energy':
        return 'text-blue-400 bg-blue-900';
      case 'ballistic':
        return 'text-orange-400 bg-orange-900';
      case 'melee':
        return 'text-red-400 bg-red-900';
      case 'explosive':
        return 'text-yellow-400 bg-yellow-900';
      default:
        return 'text-gray-400 bg-gray-700';
    }
  };

  const getBonuses = (weapon: Weapon): Array<{ label: string; value: number }> => {
    const bonusMap: Array<{ key: keyof Weapon; label: string }> = [
      { key: 'combatPowerBonus', label: 'Combat Power' },
      { key: 'targetingSystemsBonus', label: 'Targeting' },
      { key: 'criticalSystemsBonus', label: 'Critical' },
      { key: 'penetrationBonus', label: 'Penetration' },
      { key: 'weaponControlBonus', label: 'Control' },
      { key: 'attackSpeedBonus', label: 'Attack Speed' },
      { key: 'armorPlatingBonus', label: 'Armor' },
      { key: 'shieldCapacityBonus', label: 'Shield' },
      { key: 'evasionThrustersBonus', label: 'Evasion' },
      { key: 'counterProtocolsBonus', label: 'Counter' },
      { key: 'servoMotorsBonus', label: 'Servo' },
      { key: 'gyroStabilizersBonus', label: 'Gyro' },
      { key: 'hydraulicSystemsBonus', label: 'Hydraulic' },
      { key: 'powerCoreBonus', label: 'Power' },
      { key: 'threatAnalysisBonus', label: 'Threat' },
    ];

    return bonusMap
      .map(({ key, label }) => ({
        label,
        value: weapon[key] as number,
      }))
      .filter((bonus) => bonus.value !== 0);
  };

  const filteredWeapons = weapons.filter((inv) => {
    if (typeFilter === 'all') return true;
    return inv.weapon.weaponType === typeFilter;
  });

  const sortedWeapons = [...filteredWeapons].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.weapon.name.localeCompare(b.weapon.name);
      case 'type':
        return a.weapon.weaponType.localeCompare(b.weapon.weaponType);
      case 'damage':
        return b.weapon.baseDamage - a.weapon.baseDamage;
      case 'acquired':
        return new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime();
      default:
        return 0;
    }
  });

  const availableTypes = Array.from(new Set(weapons.map((inv) => inv.weapon.weaponType)));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Weapon Inventory</h1>
          <p className="text-gray-400">
            Manage your weapon collection. Equip weapons to your robots from the Robot Detail page.
          </p>
        </div>

        {/* Storage Status */}
        {storageStatus && (
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-semibold">Storage Capacity</h3>
              <span className="text-lg font-bold">
                {storageStatus.currentCount} / {storageStatus.maxCapacity}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
              <div
                className={`h-4 rounded-full transition-all ${
                  storageStatus.percentUsed >= 100
                    ? 'bg-red-500'
                    : storageStatus.percentUsed >= 80
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(storageStatus.percentUsed, 100)}%` }}
              />
            </div>
            <div className="text-sm text-gray-400">
              {storageStatus.percentUsed >= 100 ? (
                <span className="text-red-400 font-semibold">
                  Storage full! Upgrade Weapon Workshop to increase capacity.
                </span>
              ) : storageStatus.percentUsed >= 80 ? (
                <span className="text-yellow-400">
                  Running low on storage space. Consider upgrading Weapon Workshop.
                </span>
              ) : (
                `${(100 - storageStatus.percentUsed).toFixed(1)}% storage available`
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 text-red-200 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {/* Filters and Sorting */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-2">Filter by Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Types ({weapons.length})</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)} (
                    {weapons.filter((w) => w.weapon.weaponType === type).length})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="acquired">Recently Acquired</option>
                <option value="name">Name (A-Z)</option>
                <option value="type">Type</option>
                <option value="damage">Damage (High to Low)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Weapon List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading weapons...</div>
        ) : sortedWeapons.length === 0 ? (
          <div className="bg-gray-800 p-12 rounded-lg text-center">
            <p className="text-gray-400 text-lg mb-4">
              {weapons.length === 0
                ? 'No weapons in inventory'
                : 'No weapons match the current filter'}
            </p>
            {weapons.length === 0 && (
              <a
                href="/weapon-shop"
                className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded transition-colors"
              >
                Visit Weapon Shop
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedWeapons.map((inv) => {
              const bonuses = getBonuses(inv.weapon);

              return (
                <div key={inv.id} className="bg-gray-800 p-5 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-semibold">{inv.weapon.name}</h3>
                    <span
                      className={`text-xs uppercase font-semibold px-2 py-1 rounded ${getTypeColor(
                        inv.weapon.weaponType
                      )}`}
                    >
                      {inv.weapon.weaponType}
                    </span>
                  </div>

                  {inv.weapon.description && (
                    <p className="text-gray-400 text-sm mb-3">{inv.weapon.description}</p>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Base Damage:</span>
                      <span className="font-semibold">{inv.weapon.baseDamage}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Value:</span>
                      <span className="font-semibold text-green-400">
                        ₡{inv.weapon.cost.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Acquired:</span>
                      <span className="font-semibold">
                        {new Date(inv.acquiredAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {bonuses.length > 0 && (
                    <div className="p-3 bg-gray-700 rounded">
                      <div className="text-xs text-gray-400 mb-2">Attribute Bonuses:</div>
                      <div className="flex flex-wrap gap-1">
                        {bonuses.map((bonus, idx) => (
                          <span
                            key={idx}
                            className={`text-xs px-2 py-1 rounded ${
                              bonus.value > 0
                                ? 'bg-green-900 text-green-300'
                                : 'bg-red-900 text-red-300'
                            }`}
                          >
                            {bonus.label}: {bonus.value > 0 ? '+' : ''}
                            {bonus.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default WeaponInventoryPage;
