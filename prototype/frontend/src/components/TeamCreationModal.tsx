import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { createTagTeam } from '../utils/tagTeamApi';

interface Robot {
  id: number;
  name: string;
  elo: number;
  currentHP: number;
  maxHP: number;
  yieldThreshold: number;
  mainWeapon?: any;
  offhandWeapon?: any;
}

interface TeamCreationModalProps {
  onClose: () => void;
  onTeamCreated: () => void;
}

function TeamCreationModal({ onClose, onTeamCreated }: TeamCreationModalProps) {
  const { user } = useAuth();
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRobotId, setActiveRobotId] = useState<number | null>(null);
  const [reserveRobotId, setReserveRobotId] = useState<number | null>(null);

  useEffect(() => {
    fetchRobots();
  }, []);

  const fetchRobots = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3001/api/robots', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setRobots(response.data);
    } catch (err) {
      console.error('Failed to fetch robots:', err);
      setError('Failed to load robots');
    } finally {
      setLoading(false);
    }
  };

  const isRobotReady = (robot: Robot): boolean => {
    const hpPercentage = (robot.currentHP / robot.maxHP) * 100;
    const hasWeapon = !!robot.mainWeapon;
    const aboveYieldThreshold = robot.currentHP > (robot.maxHP * robot.yieldThreshold / 100);
    return hpPercentage >= 75 && hasWeapon && aboveYieldThreshold;
  };

  const getReadinessIssues = (robot: Robot): string[] => {
    const issues: string[] = [];
    const hpPercentage = (robot.currentHP / robot.maxHP) * 100;
    
    if (hpPercentage < 75) {
      issues.push('HP below 75%');
    }
    if (robot.currentHP <= (robot.maxHP * robot.yieldThreshold / 100)) {
      issues.push('HP at or below yield threshold');
    }
    if (!robot.mainWeapon) {
      issues.push('No weapon equipped');
    }
    
    return issues;
  };

  const eligibleRobots = robots.filter(isRobotReady);
  const ineligibleRobots = robots.filter(r => !isRobotReady(r));

  const handleCreateTeam = async () => {
    if (!activeRobotId || !reserveRobotId) {
      setError('Please select both active and reserve robots');
      return;
    }

    if (activeRobotId === reserveRobotId) {
      setError('Active and reserve robots must be different');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await createTagTeam(activeRobotId, reserveRobotId);
      onTeamCreated();
    } catch (err: any) {
      console.error('Failed to create team:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to create team';
      const errorDetails = err.response?.data?.details;
      
      if (errorDetails && Array.isArray(errorDetails)) {
        setError(`${errorMessage}: ${errorDetails.join(', ')}`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-elevated border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface-elevated border-b border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Create Tag Team</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-12">
              <p className="text-gray-400">Loading robots...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Instructions */}
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-300">
                  Select two battle-ready robots to form a tag team. The active robot starts the match, and the reserve robot tags in when the active robot yields or is destroyed.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-error/10 border border-error rounded-lg p-4 mb-6">
                  <p className="text-error">{error}</p>
                </div>
              )}

              {/* Selection Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface border border-gray-600 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Active Robot</div>
                  {activeRobotId ? (
                    <div className="text-primary font-semibold">
                      {robots.find(r => r.id === activeRobotId)?.name}
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">Not selected</div>
                  )}
                </div>
                <div className="bg-surface border border-gray-600 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-2">Reserve Robot</div>
                  {reserveRobotId ? (
                    <div className="text-white font-semibold">
                      {robots.find(r => r.id === reserveRobotId)?.name}
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">Not selected</div>
                  )}
                </div>
              </div>

              {/* Eligible Robots */}
              {eligibleRobots.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Battle-Ready Robots</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {eligibleRobots.map((robot) => (
                      <RobotSelectionCard
                        key={robot.id}
                        robot={robot}
                        isActive={activeRobotId === robot.id}
                        isReserve={reserveRobotId === robot.id}
                        onSelectActive={() => setActiveRobotId(robot.id)}
                        onSelectReserve={() => setReserveRobotId(robot.id)}
                        disabled={activeRobotId === robot.id || reserveRobotId === robot.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Ineligible Robots */}
              {ineligibleRobots.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-400 mb-3">Not Battle-Ready</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ineligibleRobots.map((robot) => (
                      <div
                        key={robot.id}
                        className="bg-surface border border-gray-700 rounded-lg p-4 opacity-60"
                      >
                        <div className="font-semibold text-gray-400 mb-2">{robot.name}</div>
                        <div className="text-sm text-gray-500 space-y-1">
                          <div>ELO: {robot.elo}</div>
                          <div>HP: {robot.currentHP}/{robot.maxHP}</div>
                          <div className="text-warning text-xs mt-2">
                            {getReadinessIssues(robot).join(', ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Robots */}
              {robots.length === 0 && !loading && (
                <div className="text-center py-12">
                  <p className="text-gray-400">You don't have any robots yet. Create robots first!</p>
                </div>
              )}

              {/* Not Enough Robots */}
              {robots.length > 0 && eligibleRobots.length < 2 && (
                <div className="bg-warning/10 border border-warning rounded-lg p-4 mb-6">
                  <p className="text-warning">
                    You need at least 2 battle-ready robots to create a tag team. Repair your robots and equip weapons to make them battle-ready.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface-elevated border-t border-gray-700 p-6 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-surface transition-colors"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateTeam}
            disabled={!activeRobotId || !reserveRobotId || creating || eligibleRobots.length < 2}
            className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface RobotSelectionCardProps {
  robot: Robot;
  isActive: boolean;
  isReserve: boolean;
  onSelectActive: () => void;
  onSelectReserve: () => void;
  disabled: boolean;
}

function RobotSelectionCard({ robot, isActive, isReserve, onSelectActive, onSelectReserve, disabled }: RobotSelectionCardProps) {
  return (
    <div className={`bg-surface border rounded-lg p-4 ${
      isActive ? 'border-primary' : isReserve ? 'border-white' : 'border-gray-600'
    }`}>
      <div className="font-semibold text-white mb-2">{robot.name}</div>
      <div className="text-sm text-gray-300 space-y-1 mb-3">
        <div>ELO: {robot.elo}</div>
        <div>HP: {robot.currentHP}/{robot.maxHP}</div>
        <div>Weapon: {robot.mainWeapon ? '✓' : '✗'}</div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSelectActive}
          disabled={disabled && !isActive}
          className={`flex-1 py-2 px-3 rounded text-sm font-semibold transition-colors ${
            isActive
              ? 'bg-primary text-white'
              : 'bg-surface-elevated border border-gray-600 text-gray-300 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isActive ? '✓ Active' : 'Set Active'}
        </button>
        <button
          onClick={onSelectReserve}
          disabled={disabled && !isReserve}
          className={`flex-1 py-2 px-3 rounded text-sm font-semibold transition-colors ${
            isReserve
              ? 'bg-white text-gray-900'
              : 'bg-surface-elevated border border-gray-600 text-gray-300 hover:border-white hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isReserve ? '✓ Reserve' : 'Set Reserve'}
        </button>
      </div>
    </div>
  );
}

export default TeamCreationModal;
