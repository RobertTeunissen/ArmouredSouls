import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { calculateWeaponCooldown, ATTRIBUTE_LABELS } from '../utils/weaponConstants';

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  description: string;
  baseDamage: number;
  cost: number;
  // Attribute bonuses
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

function WeaponShopPage() {
  const { user, refreshUser } = useAuth();
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState<number | null>(null);

  useEffect(() => {
    const fetchWeapons = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/weapons');
        setWeapons(response.data);
      } catch (err) {
        console.error('Failed to fetch weapons:', err);
        setError('Failed to load weapons');
      } finally {
        setLoading(false);
      }
    };

    fetchWeapons();
  }, []);

  const handlePurchase = async (weaponId: number, cost: number) => {
    if (!user) return;

    if (user.currency < cost) {
      alert('Insufficient credits!');
      return;
    }

    if (!confirm('Are you sure you want to purchase this weapon?')) {
      return;
    }

    setPurchasing(weaponId);
    try {
      await axios.post('http://localhost:3001/api/weapon-inventory/purchase', {
        weaponId,
      });
      await refreshUser();
      alert('Weapon purchased successfully!');
    } catch (err: any) {
      console.error('Purchase failed:', err);
      alert(err.response?.data?.error || 'Failed to purchase weapon');
    } finally {
      setPurchasing(null);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'energy': return 'text-blue-400';
      case 'ballistic': return 'text-orange-400';
      case 'melee': return 'text-red-400';
      case 'explosive': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getAttributeBonuses = (weapon: Weapon): string[] => {
    const bonuses: string[] = [];

    ATTRIBUTE_LABELS.forEach(({ key, label }) => {
      const value = weapon[key as keyof Weapon] as number;
      if (value !== 0) {
        bonuses.push(`${label}: ${value > 0 ? '+' : ''}${value}`);
      }
    });

    return bonuses;
  };

  const groupedWeapons = {
    energy: weapons.filter(w => w.weaponType === 'energy'),
    ballistic: weapons.filter(w => w.weaponType === 'ballistic'),
    melee: weapons.filter(w => w.weaponType === 'melee'),
    explosive: weapons.filter(w => w.weaponType === 'explosive'),
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Weapon Shop</h1>
          <p className="text-gray-400">Purchase weapons to equip your robots. Weapons provide attribute bonuses and combat capabilities.</p>
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-400">
            Loading weapons...
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 text-red-200 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {Object.entries(groupedWeapons).map(([type, weaponList]) => (
              weaponList.length > 0 && (
                <div key={type} className="mb-8">
                  <h2 className={`text-2xl font-bold mb-4 ${getTypeColor(type)} capitalize`}>
                    {type} Weapons
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {weaponList.map((weapon) => {
                      const bonuses = getAttributeBonuses(weapon);
                      return (
                        <div key={weapon.id} className="bg-gray-800 p-6 rounded-lg">
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-semibold">{weapon.name}</h3>
                            <span className={`text-sm font-semibold uppercase ${getTypeColor(weapon.weaponType)}`}>
                              {weapon.weaponType}
                            </span>
                          </div>

                          <p className="text-gray-400 text-sm mb-4">{weapon.description}</p>

                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Base Damage:</span>
                              <span className="font-semibold">{weapon.baseDamage}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Cooldown:</span>
                              <span className="font-semibold">{calculateWeaponCooldown(weapon.weaponType, weapon.baseDamage)}s</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Cost:</span>
                              <span className="font-semibold text-green-400">₡{weapon.cost.toLocaleString()}</span>
                            </div>
                          </div>

                          {bonuses.length > 0 && (
                            <div className="mb-4 p-3 bg-gray-700 rounded">
                              <div className="text-xs text-gray-400 mb-2">Attribute Bonuses:</div>
                              <div className="flex flex-wrap gap-1">
                                {bonuses.map((bonus, idx) => (
                                  <span key={idx} className="text-xs bg-gray-600 px-2 py-1 rounded">
                                    {bonus}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => handlePurchase(weapon.id, weapon.cost)}
                            disabled={purchasing === weapon.id || !!(user && user.currency < weapon.cost)}
                            className={`w-full py-2 rounded transition-colors ${
                              user && user.currency < weapon.cost
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : purchasing === weapon.id
                                ? 'bg-gray-700 text-gray-400'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {purchasing === weapon.id ? 'Purchasing...' : 
                             user && user.currency < weapon.cost ? 'Insufficient Credits' : 
                             'Purchase'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default WeaponShopPage;
