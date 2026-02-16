import { useState, useEffect } from 'react';
import axios from 'axios';

interface YieldThresholdSliderProps {
  robotId: number;
  currentThreshold: number;
  robotAttributes: any; // Full robot object with all attributes
  repairBayLevel?: number;
  activeRobotCount?: number;
  onThresholdChange: (newThreshold: number) => void;
}

function YieldThresholdSlider({
  robotId,
  currentThreshold,
  robotAttributes,
  repairBayLevel = 0,
  activeRobotCount = 1,
  onThresholdChange,
}: YieldThresholdSliderProps) {
  const [threshold, setThreshold] = useState(currentThreshold);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    console.log('[YieldThresholdSlider] Props received:', {
      robotId,
      currentThreshold,
      repairBayLevel,
      activeRobotCount
    });
  }, [robotId, currentThreshold, repairBayLevel, activeRobotCount]);

  useEffect(() => {
    setThreshold(currentThreshold);
    setHasChanges(false);
  }, [currentThreshold]);

  const handleSliderChange = (value: number) => {
    setThreshold(value);
    setHasChanges(value !== currentThreshold);
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setError('');
    setLoading(true);

    try {
      const response = await axios.patch(
        `http://localhost:3001/api/robots/${robotId}/yield-threshold`,
        { yieldThreshold: threshold },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.data) {
        onThresholdChange(threshold);
        setHasChanges(false);
      }
    } catch (err: any) {
      console.error('Failed to update yield threshold:', err);
      setError(err.response?.data?.error || 'Failed to update yield threshold');
    } finally {
      setLoading(false);
    }
  };

  const calculateAttributeSum = () => {
    const attributes = [
      'combatPower',
      'targetingSystems',
      'criticalSystems',
      'penetration',
      'weaponControl',
      'attackSpeed',
      'armorPlating',
      'shieldCapacity',
      'evasionThrusters',
      'damageDampeners',
      'counterProtocols',
      'hullIntegrity',
      'servoMotors',
      'gyroStabilizers',
      'hydraulicSystems',
      'powerCore',
      'combatAlgorithms',
      'threatAnalysis',
      'adaptiveAI',
      'logicCores',
      'syncProtocols',
      'supportSystems',
      'formationTactics',
    ];

    return attributes.reduce((sum, attr) => {
      const value = robotAttributes[attr] || 0;
      // Convert to number in case it's a string from Decimal serialization
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      return sum + numValue;
    }, 0);
  };

  const calculateRepairCost = (damagePercent: number, hpPercent: number): number => {
    const sumOfAttributes = calculateAttributeSum();
    const baseRepairCost = sumOfAttributes * 100;

    let multiplier = 1.0;
    if (hpPercent === 0) {
      multiplier = 2.0; // Total destruction
    } else if (hpPercent < 10) {
      multiplier = 1.5; // Heavily damaged
    }

    const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;

    // NEW FORMULA: discount = repairBayLevel × (5 + activeRobotCount), capped at 90%
    const discount = Math.min(repairBayLevel * (5 + activeRobotCount), 90);
    const finalCost = rawCost * (1 - discount / 100);

    console.log('[YieldThresholdSlider] Repair Cost Calculation:', {
      damagePercent,
      hpPercent,
      sumOfAttributes,
      baseRepairCost,
      multiplier,
      rawCost,
      repairBayLevel,
      activeRobotCount,
      discount,
      finalCost: Math.round(finalCost)
    });

    return Math.round(finalCost);
  };

  const getRiskLevel = (threshold: number): { color: string; text: string } => {
    if (threshold >= 30) {
      return { color: 'text-green-400', text: 'Conservative' };
    } else if (threshold >= 10) {
      return { color: 'text-yellow-400', text: 'Balanced' };
    } else {
      return { color: 'text-red-400', text: 'Aggressive' };
    }
  };

  const riskLevel = getRiskLevel(threshold);

  // Calculate repair cost scenarios
  const scenarios = [
    { label: '✅ Victory (40% HP)', damage: 60, hp: 40, emoji: '✅' },
    { label: `⚠️ Yield at ${threshold}%`, damage: 100 - threshold, hp: threshold, emoji: '⚠️' },
    { label: '💔 Heavy Damage (5% HP)', damage: 95, hp: 5, emoji: '💔' },
    { label: '❌ Destroyed (0% HP)', damage: 100, hp: 0, emoji: '❌' },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-300 uppercase tracking-wide">
        🏳️ Yield Threshold
        <span className="text-sm text-gray-400 font-normal normal-case">
          (HP % where robot will try to surrender)
        </span>
      </h3>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-gradient-to-br from-gray-700 to-gray-750 p-5 rounded-lg border border-gray-600 shadow-lg">
        {/* Current Threshold Display */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-3xl font-bold">{threshold}%</span>
            <span className={`text-sm font-semibold px-3 py-1 rounded ${riskLevel.color} bg-gray-800`}>
              {riskLevel.text}
            </span>
          </div>

          {/* Slider */}
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={threshold}
            onChange={(e) => handleSliderChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            disabled={loading}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0% (High Risk)</span>
            <span>50% (Low Risk)</span>
          </div>
        </div>

        {/* Repair Cost Preview */}
        <div className="mt-4 border-t border-gray-600 pt-4">
          <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-gray-300">Repair Cost Scenarios</h4>
          {repairBayLevel > 0 && (
            <p className="text-xs text-gray-400 mb-2">
              Repair Bay Level {repairBayLevel}: {Math.min(repairBayLevel * (5 + activeRobotCount), 90)}% discount ({activeRobotCount} robot{activeRobotCount !== 1 ? 's' : ''})
            </p>
          )}
          <div className="space-y-2">
            {scenarios.map((scenario, idx) => {
              const cost = calculateRepairCost(scenario.damage, scenario.hp);
              return (
                <div
                  key={idx}
                  className="flex justify-between items-center text-sm bg-gray-800 p-2 rounded border border-gray-700"
                >
                  <span className="text-gray-300">{scenario.label}</span>
                  <span className="font-mono text-green-400 font-semibold">₡{cost.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Warning Messages */}
        {threshold <= 5 && (
          <div className="mt-4 bg-red-900 bg-opacity-30 border border-red-700 text-red-200 px-3 py-2 rounded text-sm">
            ⚠️ <strong>High risk of destruction!</strong> Robot may be destroyed (0% HP) before
            yielding, resulting in 2x repair cost multiplier.
          </div>
        )}

        {threshold >= 40 && (
          <div className="mt-4 bg-blue-900 bg-opacity-30 border border-blue-700 text-blue-200 px-3 py-2 rounded text-sm">
            ℹ️ <strong>Conservative setting.</strong> Robot will yield frequently, but with lower
            repair costs.
          </div>
        )}

        {/* Save Button */}
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={loading}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold transition-colors duration-150"
          >
            {loading ? 'Saving...' : 'Save Yield Threshold'}
          </button>
        )}
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #3b82f6;
          cursor: pointer;
          border-radius: 50%;
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #3b82f6;
          cursor: pointer;
          border-radius: 50%;
          border: none;
        }

        .slider:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default YieldThresholdSlider;
