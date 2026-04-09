import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

interface AnalyticsSummary {
  totalEvents: number;
  uniqueUsers: number;
  completions: number;
  skips: number;
  stepCompletionCounts: Record<number, number>;
}

function OnboardingAnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/onboarding/analytics/summary', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setSummary(response.data.data);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.error || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const calculateCompletionRate = () => {
    if (!summary || summary.uniqueUsers === 0) return 0;
    return ((summary.completions / summary.uniqueUsers) * 100).toFixed(1);
  };

  const calculateSkipRate = () => {
    if (!summary || summary.uniqueUsers === 0) return 0;
    return ((summary.skips / summary.uniqueUsers) * 100).toFixed(1);
  };

  const getStepCompletionData = () => {
    if (!summary) return [];
    const steps = Object.keys(summary.stepCompletionCounts)
      .map(Number)
      .sort((a, b) => a - b);
    
    return steps.map(step => ({
      step,
      count: summary.stepCompletionCounts[step],
    }));
  };

  const getMaxStepCount = () => {
    if (!summary) return 0;
    return Math.max(...Object.values(summary.stepCompletionCounts), 0);
  };

  // Early return for non-admin users
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-secondary mb-6">This page is only accessible to administrators.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-primary hover:bg-blue-700 px-6 py-2 rounded font-semibold transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <button
              onClick={() => navigate('/admin')}
              className="text-primary hover:text-blue-300 mb-2 flex items-center gap-2"
            >
              ← Back to Admin
            </button>
            <h1 className="text-4xl font-bold">Onboarding Analytics</h1>
            <p className="text-secondary mt-2">Track user progress through the tutorial system</p>
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="bg-primary hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-semibold transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900 text-red-200 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && !summary && (
          <div className="bg-surface rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-secondary">Loading analytics data...</p>
          </div>
        )}

        {/* Analytics Dashboard */}
        {!loading && summary && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Events */}
              <div className="bg-surface rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-secondary text-sm font-semibold uppercase">Total Events</h3>
                  <span className="text-2xl">📊</span>
                </div>
                <p className="text-3xl font-bold">{summary.totalEvents.toLocaleString()}</p>
                <p className="text-tertiary text-sm mt-1">Events tracked</p>
              </div>

              {/* Unique Users */}
              <div className="bg-surface rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-secondary text-sm font-semibold uppercase">Unique Users</h3>
                  <span className="text-2xl">👥</span>
                </div>
                <p className="text-3xl font-bold">{summary.uniqueUsers.toLocaleString()}</p>
                <p className="text-tertiary text-sm mt-1">Users tracked</p>
              </div>

              {/* Completion Rate */}
              <div className="bg-surface rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-secondary text-sm font-semibold uppercase">Completion Rate</h3>
                  <span className="text-2xl">✅</span>
                </div>
                <p className="text-3xl font-bold text-success">{calculateCompletionRate()}%</p>
                <p className="text-tertiary text-sm mt-1">
                  {summary.completions} of {summary.uniqueUsers} users
                </p>
              </div>

              {/* Skip Rate */}
              <div className="bg-surface rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-secondary text-sm font-semibold uppercase">Skip Rate</h3>
                  <span className="text-2xl">⏭️</span>
                </div>
                <p className="text-3xl font-bold text-warning">{calculateSkipRate()}%</p>
                <p className="text-tertiary text-sm mt-1">
                  {summary.skips} of {summary.uniqueUsers} users
                </p>
              </div>
            </div>

            {/* Step Completion Funnel */}
            <div className="bg-surface rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Step Completion Funnel</h2>
              
              {getStepCompletionData().length === 0 ? (
                <div className="text-center py-8 text-secondary">
                  No step completion data available yet
                </div>
              ) : (
                <div className="space-y-4">
                  {getStepCompletionData().map(({ step, count }) => {
                    const maxCount = getMaxStepCount();
                    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    
                    return (
                      <div key={step} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">Step {step}</span>
                          <span className="text-secondary">
                            {count.toLocaleString()} completions ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-surface-elevated rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-primary-dark h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                            style={{ width: `${percentage}%` }}
                          >
                            {percentage > 10 && (
                              <span className="text-xs font-semibold text-white">
                                {count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Additional Info */}
            <div className="bg-surface rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">About This Data</h2>
              <div className="space-y-2 text-secondary">
                <p>
                  <strong>Total Events:</strong> All analytics events collected from users going through onboarding
                </p>
                <p>
                  <strong>Unique Users:</strong> Number of distinct users who have generated analytics events
                </p>
                <p>
                  <strong>Completion Rate:</strong> Percentage of users who completed the entire tutorial
                </p>
                <p>
                  <strong>Skip Rate:</strong> Percentage of users who skipped the tutorial
                </p>
                <p>
                  <strong>Step Completion Funnel:</strong> Shows how many users completed each step of the tutorial. 
                  Drop-offs between steps indicate where users are struggling or losing interest.
                </p>
                <p className="text-warning mt-4">
                  ⚠️ Note: Analytics data is stored in-memory and capped at 10,000 events. 
                  Data will be lost on server restart.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingAnalyticsPage;
