import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Robot {
  id: number;
  name: string;
  weaponId: number | null;
  weapon: Weapon | null;
  firepower: number;
  targetingComputer: number;
  criticalCircuits: number;
  armorPiercing: number;
  weaponStability: number;
  firingRate: number;
  armorPlating: number;
  shieldGenerator: number;
  evasionThrusters: number;
  damageDampeners: number;
  counterProtocols: number;
  hullIntegrity: number;
  servoMotors: number;
  gyroStabilizers: number;
  hydraulicPower: number;
  powerCore: number;
  combatAlgorithms: number;
  threatAnalysis: number;
  adaptiveAI: number;
  logicCores: number;
  syncProtocols: number;
  supportSystems: number;
  formationTactics: number;
}

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  description: string | null;
  baseDamage: number;
  cost: number;
}

function RobotDetailPage() {
  const { id } = useParams();
  const [robot, setRobot] = useState<Robot | null>(null);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [currency, setCurrency] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const MAX_ATTRIBUTE_LEVEL = 50;

  const attributeCategories = {
    'Weapon Systems': [
      { key: 'firepower', label: 'Firepower' },
      { key: 'targetingComputer', label: 'Targeting Computer' },
      { key: 'criticalCircuits', label: 'Critical Circuits' },
      { key: 'armorPiercing', label: 'Armor Piercing' },
      { key: 'weaponStability', label: 'Weapon Stability' },
      { key: 'firingRate', label: 'Firing Rate' },
    ],
    'Defensive Systems': [
      { key: 'armorPlating', label: 'Armor Plating' },
      { key: 'shieldGenerator', label: 'Shield Generator' },
      { key: 'evasionThrusters', label: 'Evasion Thrusters' },
      { key: 'damageDampeners', label: 'Damage Dampeners' },
      { key: 'counterProtocols', label: 'Counter Protocols' },
    ],
    'Chassis & Mobility': [
      { key: 'hullIntegrity', label: 'Hull Integrity' },
      { key: 'servoMotors', label: 'Servo Motors' },
      { key: 'gyroStabilizers', label: 'Gyro Stabilizers' },
      { key: 'hydraulicPower', label: 'Hydraulic Power' },
      { key: 'powerCore', label: 'Power Core' },
    ],
    'AI Processing': [
      { key: 'combatAlgorithms', label: 'Combat Algorithms' },
      { key: 'threatAnalysis', label: 'Threat Analysis' },
      { key: 'adaptiveAI', label: 'Adaptive AI' },
      { key: 'logicCores', label: 'Logic Cores' },
    ],
    'Team Coordination': [
      { key: 'syncProtocols', label: 'Sync Protocols' },
      { key: 'supportSystems', label: 'Support Systems' },
      { key: 'formationTactics', label: 'Formation Tactics' },
    ],
  };

  useEffect(() => {
    fetchRobotAndWeapons();
  }, [id]);

  useEffect(() => {
    if (user) {
      setCurrency(user.currency);
    }
  }, [user]);

  const fetchRobotAndWeapons = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch robot details
      const robotResponse = await fetch(`http://localhost:3001/api/robots/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (robotResponse.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      if (!robotResponse.ok) {
        throw new Error('Failed to fetch robot');
      }

      const robotData = await robotResponse.json();
      setRobot(robotData);

      // Fetch available weapons
      const weaponsResponse = await fetch('http://localhost:3001/api/weapons', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (weaponsResponse.ok) {
        const weaponsData = await weaponsResponse.json();
        setWeapons(weaponsData);
      }
    } catch (err) {
      setError('Failed to load robot details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (attribute: string, currentLevel: number) => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    const upgradeCost = (currentLevel + 1) * 1000;

    if (currency < upgradeCost) {
      setError('Insufficient credits for this upgrade');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/robots/${id}/upgrade`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ attribute }),
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upgrade attribute');
      }

      setRobot(data.robot);
      setCurrency(data.currency);
      setSuccessMessage(`${attribute} upgraded to level ${currentLevel + 1}!`);
      
      // Refresh user data
      await refreshUser();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade attribute');
      console.error(err);
    }
  };

  const handleWeaponChange = async (weaponId: string) => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/robots/${id}/weapon`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ weaponId: weaponId === '' ? null : parseInt(weaponId) }),
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to equip weapon');
      }

      setRobot(data.robot);
      setSuccessMessage(weaponId === '' ? 'Weapon unequipped!' : 'Weapon equipped successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to equip weapon');
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading robot details...</div>
      </div>
    );
  }

  if (!robot) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Robot not found</p>
          <button
            onClick={() => navigate('/robots')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded"
          >
            Back to Robots
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold cursor-pointer" onClick={() => navigate('/dashboard')}>
            Armoured Souls
          </h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/robots')}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              My Robots
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={() => navigate('/robots')}
            className="text-blue-400 hover:text-blue-300 mb-4"
          >
            ← Back to Robots
          </button>
          <h2 className="text-3xl font-bold">{robot.name}</h2>
        </div>

        {/* Currency Balance */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Credits Balance</h3>
            <div className="text-3xl font-bold text-green-400">
              ₡{currency.toLocaleString()}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded mb-6">
            {successMessage}
          </div>
        )}

        {/* Weapon Selection */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Equipped Weapon</h3>
          <div className="flex items-center gap-4">
            <select
              value={robot.weaponId || ''}
              onChange={(e) => handleWeaponChange(e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">No Weapon</option>
              {weapons.map((weapon) => (
                <option key={weapon.id} value={weapon.id}>
                  {weapon.name} ({weapon.weaponType}) - Damage: {weapon.baseDamage}
                </option>
              ))}
            </select>
          </div>
          {robot.weapon && (
            <div className="mt-4 bg-gray-700 p-4 rounded">
              <p className="text-sm text-gray-300">{robot.weapon.description}</p>
              <div className="mt-2 flex gap-4 text-sm">
                <span>Type: <span className="font-semibold capitalize">{robot.weapon.weaponType}</span></span>
                <span>Damage: <span className="font-semibold">{robot.weapon.baseDamage}</span></span>
              </div>
            </div>
          )}
        </div>

        {/* Attributes */}
        {Object.entries(attributeCategories).map(([category, attributes]) => (
          <div key={category} className="bg-gray-800 p-6 rounded-lg mb-6">
            <h3 className="text-xl font-semibold mb-4">{category}</h3>
            <div className="space-y-3">
              {attributes.map(({ key, label }) => {
                const currentLevel = robot[key as keyof Robot] as number;
                const upgradeCost = (currentLevel + 1) * 1000;
                const canUpgrade = currentLevel < MAX_ATTRIBUTE_LEVEL;
                const canAfford = currency >= upgradeCost;

                return (
                  <div key={key} className="bg-gray-700 p-4 rounded flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{label}</span>
                        <span className="text-blue-400 font-bold">Level {currentLevel}</span>
                      </div>
                      {canUpgrade && (
                        <div className="text-sm text-gray-400 mt-1">
                          Upgrade Cost: ₡{upgradeCost.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUpgrade(key, currentLevel)}
                      disabled={!canUpgrade || !canAfford}
                      className={`px-4 py-2 rounded font-semibold transition-colors ${
                        canUpgrade && canAfford
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-gray-600 cursor-not-allowed'
                      }`}
                    >
                      {!canUpgrade
                        ? 'Max Level'
                        : !canAfford
                        ? 'Not Enough Credits'
                        : `Upgrade (₡${upgradeCost.toLocaleString()})`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RobotDetailPage;
