import { useEffect, useState } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';

interface Robot {
  id: number;
  name: string;
  elo: number;
  user: {
    username: string;
  };
}

function AllRobotsPage() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAllRobots = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/robots/all/robots');
        setRobots(response.data);
      } catch (err) {
        console.error('Failed to fetch robots:', err);
        setError('Failed to load robots');
      } finally {
        setLoading(false);
      }
    };

    fetchAllRobots();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">All Robots</h1>

        {loading && (
          <div className="text-center py-12 text-gray-400">
            Loading robots...
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 text-red-200 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {!loading && !error && robots.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No robots have been created yet.
          </div>
        )}

        {!loading && !error && robots.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {robots.map((robot) => (
              <div key={robot.id} className="bg-gray-800 p-6 rounded-lg hover:bg-gray-750 transition-colors">
                <h3 className="text-xl font-semibold mb-2">{robot.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Owner:</span>
                    <span className="font-semibold text-blue-400">{robot.user.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">ELO:</span>
                    <span className="font-semibold">{robot.elo}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AllRobotsPage;
