/**
 * FinancialReportPage
 * Comprehensive financial report with detailed breakdown and per-robot analysis
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import DailyStableReport from '../components/DailyStableReport';
import PerRobotBreakdown from '../components/PerRobotBreakdown';
import MultiplierBreakdown from '../components/MultiplierBreakdown';
import {
  getDailyFinancialReport,
  getFinancialProjections,
  getPerRobotFinancialReport,
  FinancialReport,
  FinancialProjections,
  PerRobotFinancialReport,
  formatCurrency,
  getHealthColor,
  getHealthIcon,
} from '../utils/financialApi';

type TabType = 'overview' | 'per-robot';

function FinancialReportPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [projections, setProjections] = useState<FinancialProjections | null>(null);
  const [perRobotReport, setPerRobotReport] = useState<PerRobotFinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const [reportData, projectionsData, perRobotData] = await Promise.all([
        getDailyFinancialReport(),
        getFinancialProjections(),
        getPerRobotFinancialReport(),
      ]);
      setReport(reportData);
      setProjections(projectionsData);
      setPerRobotReport(perRobotData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch financial data:', err);
      setError('Failed to load financial report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-secondary">Loading financial report...</div>
        </div>
      </div>
    );
  }

  if (error || !report || !projections) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-error">{error || 'No data available'}</div>
          <div className="text-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-primary hover:bg-primary-dark px-6 py-2 rounded transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const healthColor = getHealthColor(report.financialHealth);
  const healthIcon = getHealthIcon(report.financialHealth);

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between items-start lg:items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold">Income Dashboard</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-surface-elevated hover:bg-surface px-4 py-2 rounded transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-white/10">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'overview'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-secondary hover:text-white hover:border-white/20'
                  }
                `}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('per-robot')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'per-robot'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-secondary hover:text-white hover:border-white/20'
                  }
                `}
              >
                Per-Robot Breakdown
              </button>
            </nav>
          </div>
        </div>

        {/* Financial Health Overview (shown on both tabs) */}
        <div className="bg-surface p-6 rounded-lg mb-6">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Financial Health</h2>
              <div className={`text-4xl font-bold ${healthColor}`}>
                {healthIcon} {report.financialHealth.toUpperCase()}
              </div>
            </div>
            <div className="lg:text-right">
              <div className="text-sm text-secondary mb-1">Current Balance</div>
              <div className="text-3xl font-bold text-success">
                {formatCurrency(report.currentBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Daily Stable Report and Multipliers */}
            <div className="space-y-6">
              <DailyStableReport report={report} />
              
              {/* Streaming Revenue Explanation */}
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-primary mb-2 flex items-center">
                  <span className="mr-2">📺</span>
                  Streaming Revenue
                </h3>
                <p className="text-sm text-secondary mb-2">
                  Streaming revenue is awarded after every battle based on your robot&apos;s fame, battle experience, and your Streaming Studio facility level.
                </p>
                <div className="text-xs text-secondary space-y-1">
                  <div>• Base rate: ₡1,000 per battle</div>
                  <div>• Battle multiplier: Increases with robot&apos;s total battles (1 + battles/1,000)</div>
                  <div>• Fame multiplier: Increases with robot&apos;s fame (1 + fame/5,000)</div>
                  <div>• Studio multiplier: +10% per Streaming Studio level</div>
                </div>
                <p className="text-xs text-secondary mt-2 italic">
                  Tip: Upgrade your Streaming Studio facility to boost streaming revenue from all battles!
                </p>
              </div>
              
              {report.multiplierBreakdown && (
                <MultiplierBreakdown multiplierData={report.multiplierBreakdown} />
              )}
            </div>

            {/* Right Column: Projections and Recommendations */}
            <div className="space-y-6">
              {/* Projections */}
              <div className="bg-surface p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Financial Projections</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-secondary mb-1">Weekly Projection</div>
                    <div className={`text-2xl font-bold ${projections.projections.weekly >= 0 ? 'text-success' : 'text-error'}`}>
                      {projections.projections.weekly >= 0 ? '+' : ''}{formatCurrency(projections.projections.weekly)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-secondary mb-1">Monthly Projection</div>
                    <div className={`text-2xl font-bold ${projections.projections.monthly >= 0 ? 'text-success' : 'text-error'}`}>
                      {projections.projections.monthly >= 0 ? '+' : ''}{formatCurrency(projections.projections.monthly)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-secondary mb-1">Current Daily Net</div>
                    <div className={`text-2xl font-bold ${projections.current.dailyNet >= 0 ? 'text-success' : 'text-error'}`}>
                      {projections.current.dailyNet >= 0 ? '+' : ''}{formatCurrency(projections.current.dailyNet)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {projections.recommendations.length > 0 && (
                <div className="bg-surface p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4">💡 Recommendations</h3>
                  <ul className="space-y-3">
                    {projections.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span className="text-secondary">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
            </div>
          </div>
        )}

        {/* Per-Robot Tab Content */}
        {activeTab === 'per-robot' && perRobotReport && (
          <PerRobotBreakdown report={perRobotReport} />
        )}
      </div>
    </div>
  );
}

export default FinancialReportPage;
