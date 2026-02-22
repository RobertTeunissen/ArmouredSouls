import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getMyTagTeams, TagTeam } from '../utils/tagTeamApi';

interface TagTeamReadinessWarningProps {
  compact?: boolean;
}

function TagTeamReadinessWarning({ compact = false }: TagTeamReadinessWarningProps) {
  const navigate = useNavigate();
  const [unreadyTeams, setUnreadyTeams] = useState<TagTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const teams = await getMyTagTeams();
      const notReady = teams.filter(team => !team.readiness?.isReady);
      setUnreadyTeams(notReady);
    } catch (err) {
      console.error('Failed to fetch tag teams for readiness check:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || unreadyTeams.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div 
        className="bg-warning/10 border-l-4 border-warning rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-warning/15 transition-colors"
        onClick={() => navigate('/tag-teams')}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <span className="text-warning font-semibold">
            {unreadyTeams.length} tag team{unreadyTeams.length > 1 ? 's' : ''} not battle-ready
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate('/tag-teams');
          }}
          className="bg-warning hover:bg-warning/90 text-gray-900 font-semibold py-2 px-4 rounded text-sm transition-colors"
        >
          Manage Tag Teams
        </button>
      </div>
    );
  }

  return (
    <div className="bg-warning/10 border border-warning rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-warning text-xl">⚠️</span>
        <span className="text-warning font-semibold">Tag Team Readiness Issues</span>
      </div>
      <div className="space-y-2">
        {unreadyTeams.map((team) => (
          <div key={team.id} className="bg-surface rounded-lg p-3">
            <div className="font-semibold text-white mb-2">
              {team.activeRobot.name} + {team.reserveRobot.name}
            </div>
            {!team.readiness?.activeRobotReady && team.readiness?.activeRobotIssues && (
              <div className="text-sm text-gray-300 ml-4">
                <span className="text-primary">{team.activeRobot.name}:</span>{' '}
                {team.readiness.activeRobotIssues.join(', ')}
              </div>
            )}
            {!team.readiness?.reserveRobotReady && team.readiness?.reserveRobotIssues && (
              <div className="text-sm text-gray-300 ml-4">
                <span className="text-white">{team.reserveRobot.name}:</span>{' '}
                {team.readiness.reserveRobotIssues.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => navigate('/tag-teams')}
        className="mt-3 w-full bg-warning hover:bg-warning/90 text-gray-900 font-semibold py-2 px-4 rounded-lg transition-colors"
      >
        Manage Tag Teams
      </button>
    </div>
  );
}

export default TagTeamReadinessWarning;
