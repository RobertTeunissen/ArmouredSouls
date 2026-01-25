import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Robot {
  id: number;
  name: string;
  weaponId: number | null;
  weapon: {
    name: string;
    weaponType: string;
  } | null;
  createdAt: string;
}

function RobotsPage() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRobots();
  }, []);

  const fetchRobots = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/robots', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch robots');
      }

      const data = await response.json();
      setRobots(data);
    } catch (err) {
      setError('Failed to load robots');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading robots...</div>
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
              onClick={() => navigate('/facilities')}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              Facilities
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
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">My Robots</h2>
          <button
            onClick={() => navigate('/robots/create')}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg transition-colors font-semibold"
          >
            + Create New Robot
          </button>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {robots.length === 0 ? (
          <div className="bg-gray-800 p-12 rounded-lg text-center">
            <p className="text-xl text-gray-400 mb-4">You don't have any robots yet.</p>
            <p className="text-gray-500 mb-6">Create your first robot to start battling!</p>
            <button
              onClick={() => navigate('/robots/create')}
              className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-lg transition-colors font-semibold"
            >
              Create Your First Robot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {robots.map((robot) => (
              <div
                key={robot.id}
                className="bg-gray-800 p-6 rounded-lg border-2 border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => navigate(`/robots/${robot.id}`)}
              >
                <h3 className="text-xl font-bold mb-3">{robot.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Robot ID:</span>
                    <span className="font-semibold">#{robot.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Weapon:</span>
                    <span className="font-semibold">
                      {robot.weapon ? robot.weapon.name : 'None'}
                    </span>
                  </div>
                  {robot.weapon && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Weapon Type:</span>
                      <span className="font-semibold capitalize">{robot.weapon.weaponType}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Created:</span>
                    <span className="font-semibold">
                      {new Date(robot.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/robots/${robot.id}`);
                  }}
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default RobotsPage;
