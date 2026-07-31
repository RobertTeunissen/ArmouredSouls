/**
 * TeamAssignmentStep — Step 5 of the robot setup wizard.
 * Shows existing teams with open slots and offers inline team creation.
 * Placed before subscriptions so the player knows which team events are relevant.
 *
 * Requirements: 5.6, 6.1, 10.5
 */

import { useState, useEffect } from 'react';
import { getMyTeamBattles, registerTeamBattle, type TeamBattle } from '../../../utils/teamBattleApi';
import { useRobotStore } from '../../../stores';
import type { StepProps } from '../types';

function TeamAssignmentStep({ robotId, onComplete, onSkip }: StepProps) {
  const [teams, setTeams] = useState<TeamBattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSize, setNewTeamSize] = useState<2 | 3>(2);

  const robots = useRobotStore(state => state.robots);
  const otherRobots = robots.filter((r) => r.id !== robotId);

  useEffect(() => {
    let cancelled = false;

    getMyTeamBattles()
      .then((data) => {
        if (!cancelled) setTeams(data);
      })
      .catch(() => {
        // Fail silently
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Teams with open slots that this robot could join
  const teamsWithSlots = teams.filter((t) => {
    const memberIds = t.members.map((m) => m.robotId);
    // Team has an open slot AND this robot isn't already a member
    return memberIds.length < t.teamSize && !memberIds.includes(robotId);
  });

  const handleCreateTeam = async (): Promise<void> => {
    if (!newTeamName.trim() || otherRobots.length === 0) return;

    setBusy(true);
    setError(null);
    try {
      // Pick first available other robot as teammate
      const teammateId = otherRobots[0].id;
      const robotIds = newTeamSize === 2
        ? [robotId, teammateId]
        : [robotId, teammateId, ...(otherRobots.length > 1 ? [otherRobots[1].id] : [])];

      if (robotIds.length < newTeamSize) {
        setError(`Need ${newTeamSize} robots for a ${newTeamSize}v${newTeamSize} team`);
        setBusy(false);
        return;
      }

      await registerTeamBattle(robotIds, newTeamName.trim(), newTeamSize);
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Team Assignment</h2>
        <div className="text-secondary text-sm animate-pulse">Loading teams...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white">Team Assignment</h2>
        <p className="text-secondary text-sm mt-1">
          Assign your robot to a team for 2v2 or 3v3 battles. This is optional — you can play solo events without a team.
        </p>
      </div>

      {error && (
        <div className="bg-error/10 border border-error rounded-lg p-3 text-error text-sm">
          {error}
        </div>
      )}

      {/* Existing teams with open slots */}
      {teamsWithSlots.length > 0 && (
        <div>
          <p className="text-secondary text-sm mb-2">Teams with open slots:</p>
          <div className="space-y-2">
            {teamsWithSlots.map((team) => (
              <div key={team.id} className="bg-surface border border-gray-700 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white text-sm">{team.teamName}</div>
                  <div className="text-xs text-secondary">
                    {team.teamSize}v{team.teamSize} • {team.members.length}/{team.teamSize} members
                  </div>
                </div>
                <span className="text-xs text-secondary">Use Team Management to add</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not enough robots for team */}
      {otherRobots.length === 0 && (
        <div className="bg-surface border border-gray-700 rounded-lg p-4 text-center">
          <span className="text-3xl block mb-2">👥</span>
          <p className="text-secondary text-sm">
            You need at least 2 robots to form a team. Create more robots first!
          </p>
        </div>
      )}

      {/* Create new team (inline) */}
      {otherRobots.length > 0 && !showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full bg-surface border border-dashed border-gray-600 hover:border-primary rounded-lg p-4 text-center transition-colors min-h-[44px]"
        >
          <span className="text-primary font-semibold">+ Create New Team</span>
        </button>
      )}

      {showCreate && otherRobots.length > 0 && (
        <div className="bg-surface border border-gray-700 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-white text-sm">Create New Team</h4>
          <div>
            <label className="text-xs text-secondary block mb-1">Team Name</label>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Enter team name"
              className="w-full bg-surface-elevated border border-gray-600 rounded px-3 py-2 text-white text-sm min-h-[44px] focus:outline-none focus:border-primary"
              maxLength={32}
            />
          </div>
          <div>
            <label className="text-xs text-secondary block mb-1">Team Size</label>
            <div className="flex gap-2">
              <button
                onClick={() => setNewTeamSize(2)}
                className={`flex-1 px-3 py-2 rounded text-sm font-semibold min-h-[44px] transition-colors ${
                  newTeamSize === 2 ? 'bg-primary text-white' : 'bg-surface-elevated text-secondary hover:text-white'
                }`}
              >
                2v2
              </button>
              <button
                onClick={() => setNewTeamSize(3)}
                disabled={otherRobots.length < 2}
                className={`flex-1 px-3 py-2 rounded text-sm font-semibold min-h-[44px] transition-colors disabled:opacity-30 ${
                  newTeamSize === 3 ? 'bg-primary text-white' : 'bg-surface-elevated text-secondary hover:text-white'
                }`}
              >
                3v3
              </button>
            </div>
          </div>
          <button
            onClick={handleCreateTeam}
            disabled={busy || !newTeamName.trim()}
            className="w-full bg-primary hover:bg-blue-700 text-white font-semibold px-4 py-3 rounded-lg min-h-[44px] transition-colors disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onComplete}
          className="bg-surface-elevated hover:bg-gray-600 text-white px-6 py-3 rounded-lg min-h-[44px] transition-colors"
        >
          {teamsWithSlots.length > 0 || showCreate ? 'Continue' : 'Skip — Solo Only'}
        </button>
      </div>
    </div>
  );
}

export default TeamAssignmentStep;
