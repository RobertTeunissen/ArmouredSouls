import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { getMyTagTeams, disbandTagTeam, TagTeam, getTeamName } from '../utils/tagTeamApi';
import { getTagTeamLeagueTierName, getTagTeamLeagueTierColor, getTagTeamLeagueTierIcon } from '../utils/tagTeamApi';
import TeamCreationModal from '../components/TeamCreationModal';
import ConfirmationModal from '../components/ConfirmationModal';

function TagTeamManagementPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TagTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamToDisband, setTeamToDisband] = useState<TagTeam | null>(null);
  const [disbanding, setDisbanding] = useState(false);  useEffect(() => {
    if (user) {
      fetchTeams();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        navigate('/login');
        return;
      }
      
      const data = await getMyTagTeams();
      setTeams(data);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      console.error('Failed to fetch tag teams:', err);
      setError(err.response?.data?.message || 'Failed to load tag teams');
    } finally {
      setLoading(false);
    }
  };

  const handleDisbandTeam = async () => {
    if (!teamToDisband) return;
    
    try {
      setDisbanding(true);
      await disbandTagTeam(teamToDisband.id);
      setTeams(teams.filter(t => t.id !== teamToDisband.id));
      setTeamToDisband(null);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      console.error('Failed to disband team:', err);
      alert(err.response?.data?.message || 'Failed to disband team');
    } finally {
      setDisbanding(false);
    }
  };

  const handleTeamCreated = () => {
    setShowCreateModal(false);
    fetchTeams();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
          <div>
            <h1 className="text-3xl font-bold text-white">Tag Team Management</h1>
            <p className="text-gray-400 mt-1">Manage your 2v2 battle teams</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            + Create Team
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading teams...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-error/10 border border-error rounded-lg p-4 mb-6">
            <p className="text-error">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && teams.length === 0 && (
          <div className="bg-surface-elevated p-8 rounded-lg border border-gray-700 text-center">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-4">No Tag Teams Yet</h2>
              <p className="text-gray-300 mb-6">
                Create your first tag team to compete in 2v2 battles! Select two robots from your stable to form a powerful duo.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
              >
                Create Your First Team
              </button>
            </div>
          </div>
        )}

        {/* Teams Grid */}
        {!loading && !error && teams.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {teams.map((team) => (
              <TagTeamCard
                key={team.id}
                team={team}
                onDisband={() => setTeamToDisband(team)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Team Creation Modal */}
      {showCreateModal && (
        <TeamCreationModal
          onClose={() => setShowCreateModal(false)}
          onTeamCreated={handleTeamCreated}
        />
      )}

      {/* Disband Confirmation Modal */}
      {teamToDisband && (
        <ConfirmationModal
          title="Disband Tag Team"
          message={`Are you sure you want to disband the team of ${teamToDisband.activeRobot.name} and ${teamToDisband.reserveRobot.name}? This action cannot be undone.`}
          confirmLabel="Disband Team"
          cancelLabel="Cancel"
          onConfirm={handleDisbandTeam}
          onCancel={() => setTeamToDisband(null)}
          isDestructive={true}
          isLoading={disbanding}
        />
      )}
    </div>
  );
}

interface TagTeamCardProps {
  team: TagTeam;
  onDisband: () => void;
}

function TagTeamCard({ team, onDisband }: TagTeamCardProps) {
  const navigate = useNavigate();
  const tierColor = getTagTeamLeagueTierColor(team.tagTeamLeague);
  const tierName = getTagTeamLeagueTierName(team.tagTeamLeague);
  const tierIcon = getTagTeamLeagueTierIcon(team.tagTeamLeague);
  const combinedELO = team.activeRobot.elo + team.reserveRobot.elo;
  const totalMatches = team.totalTagTeamWins + team.totalTagTeamLosses + team.totalTagTeamDraws;
  
  const isReady = team.readiness?.isReady ?? true;
  const activeRobotReady = team.readiness?.activeRobotReady ?? true;
  const reserveRobotReady = team.readiness?.reserveRobotReady ?? true;
  
  // Get team name
  const teamName = getTeamName(team);

  return (
    <div className="bg-surface-elevated border border-gray-700 rounded-lg p-6 hover:border-primary/50 transition-all">
      {/* Header with Team Name */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{teamName}</h3>
          <div className="flex items-center gap-2">
            <span className="text-lg">{tierIcon}</span>
            <span className={`text-sm font-semibold ${tierColor}`}>
              {tierName} League
            </span>
          </div>
        </div>
        <button
          onClick={onDisband}
          className="text-error hover:text-error/80 text-sm font-semibold transition-colors"
        >
          Disband
        </button>
      </div>

      {/* Readiness Warning */}
      {!isReady && (
        <div className="bg-warning/10 border border-warning rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-warning">⚠️</span>
            <span className="text-warning font-semibold">Team Not Ready</span>
          </div>
          {!activeRobotReady && team.readiness?.activeRobotIssues && (
            <div className="text-sm text-gray-300 ml-6">
              <span className="font-semibold">{team.activeRobot.name}:</span> {team.readiness.activeRobotIssues.join(', ')}
            </div>
          )}
          {!reserveRobotReady && team.readiness?.reserveRobotIssues && (
            <div className="text-sm text-gray-300 ml-6">
              <span className="font-semibold">{team.reserveRobot.name}:</span> {team.readiness.reserveRobotIssues.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Robots */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Active Robot */}
        <div 
          className="bg-surface border border-gray-600 rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate(`/robots/${team.activeRobot.id}`)}
        >
          <div className="text-xs text-gray-400 mb-1">Active Robot</div>
          <div className="font-semibold text-primary mb-2">{team.activeRobot.name}</div>
          <div className="text-sm text-gray-300 space-y-1">
            <div>ELO: {team.activeRobot.elo}</div>
            <div className="flex items-center gap-2">
              <span>HP:</span>
              <div className="flex-1 bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    team.activeRobot.currentHP >= team.activeRobot.maxHP * 0.75
                      ? 'bg-success'
                      : team.activeRobot.currentHP >= team.activeRobot.maxHP * 0.5
                      ? 'bg-warning'
                      : 'bg-error'
                  }`}
                  style={{ width: `${(team.activeRobot.currentHP / team.activeRobot.maxHP) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-xs">{team.activeRobot.currentHP}/{team.activeRobot.maxHP}</div>
          </div>
        </div>

        {/* Reserve Robot */}
        <div 
          className="bg-surface border border-gray-600 rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate(`/robots/${team.reserveRobot.id}`)}
        >
          <div className="text-xs text-gray-400 mb-1">Reserve Robot</div>
          <div className="font-semibold text-white mb-2">{team.reserveRobot.name}</div>
          <div className="text-sm text-gray-300 space-y-1">
            <div>ELO: {team.reserveRobot.elo}</div>
            <div className="flex items-center gap-2">
              <span>HP:</span>
              <div className="flex-1 bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    team.reserveRobot.currentHP >= team.reserveRobot.maxHP * 0.75
                      ? 'bg-success'
                      : team.reserveRobot.currentHP >= team.reserveRobot.maxHP * 0.5
                      ? 'bg-warning'
                      : 'bg-error'
                  }`}
                  style={{ width: `${(team.reserveRobot.currentHP / team.reserveRobot.maxHP) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-xs">{team.reserveRobot.currentHP}/{team.reserveRobot.maxHP}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-700">
        <div className="text-center">
          <div className="text-xs text-gray-400 mb-1">Combined ELO</div>
          <div className="text-lg font-semibold text-white">{combinedELO}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-400 mb-1">League Points</div>
          <div className="text-lg font-semibold text-primary">{team.tagTeamLeaguePoints}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-400 mb-1">Record</div>
          <div className="text-sm font-semibold text-white">
            {team.totalTagTeamWins}W-{team.totalTagTeamLosses}L-{team.totalTagTeamDraws}D
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-400 mb-1">Matches</div>
          <div className="text-lg font-semibold text-white">{totalMatches}</div>
        </div>
      </div>
    </div>
  );
}

export default TagTeamManagementPage;
