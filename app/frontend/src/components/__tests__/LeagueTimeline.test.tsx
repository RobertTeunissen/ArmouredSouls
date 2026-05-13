import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeagueTimeline from '../LeagueTimeline';
import type { LeagueHistoryEntry } from '../LeagueTimeline';

// Mock Recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );
  const MockLineChart = ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="line-chart" data-points={data.length}>{children}</div>
  );
  const MockLine = ({ type, dataKey }: { type: string; dataKey: string }) => (
    <div data-testid="line" data-type={type} data-datakey={dataKey} />
  );
  const MockXAxis = ({ dataKey }: { dataKey: string }) => (
    <div data-testid="x-axis" data-datakey={dataKey} />
  );
  const MockYAxis = ({ ticks, domain }: { ticks: number[]; domain: number[] }) => (
    <div data-testid="y-axis" data-ticks={JSON.stringify(ticks)} data-domain={JSON.stringify(domain)} />
  );
  const MockTooltip = () => <div data-testid="tooltip" />;

  return {
    ResponsiveContainer: MockResponsiveContainer,
    LineChart: MockLineChart,
    Line: MockLine,
    XAxis: MockXAxis,
    YAxis: MockYAxis,
    Tooltip: MockTooltip,
  };
});

const mockHistory: LeagueHistoryEntry[] = [
  { cycleNumber: 5, destinationTier: 'silver', changeType: 'promotion', leaguePoints: 120 },
  { cycleNumber: 12, destinationTier: 'gold', changeType: 'promotion', leaguePoints: 150 },
  { cycleNumber: 18, destinationTier: 'silver', changeType: 'demotion', leaguePoints: 30 },
];

describe('LeagueTimeline', () => {
  it('renders chart with mock history data', () => {
    render(<LeagueTimeline history={mockHistory} currentTier="silver" />);

    expect(screen.getByTestId('league-timeline-chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
  });

  it('shows empty state message when history is empty', () => {
    render(<LeagueTimeline history={[]} currentTier="bronze" emptyMessage="No history yet" />);

    expect(screen.getByTestId('league-timeline-empty')).toBeInTheDocument();
    expect(screen.getByText('No history yet')).toBeInTheDocument();
    expect(screen.queryByTestId('league-timeline-chart')).not.toBeInTheDocument();
  });

  it('shows default empty message when no custom message provided', () => {
    render(<LeagueTimeline history={[]} currentTier="gold" />);

    expect(screen.getByText(/Currently in gold league/)).toBeInTheDocument();
  });

  it('renders with correct tier labels on Y-axis', () => {
    render(<LeagueTimeline history={mockHistory} currentTier="silver" />);

    const yAxis = screen.getByTestId('y-axis');
    expect(yAxis).toHaveAttribute('data-ticks', JSON.stringify([1, 2, 3, 4, 5, 6]));
    expect(yAxis).toHaveAttribute('data-domain', JSON.stringify([0.5, 6.5]));
  });

  it('renders line with stepAfter type', () => {
    render(<LeagueTimeline history={mockHistory} currentTier="silver" />);

    const line = screen.getByTestId('line');
    expect(line).toHaveAttribute('data-type', 'stepAfter');
    expect(line).toHaveAttribute('data-datakey', 'tierValue');
  });

  it('passes correct number of data points to chart', () => {
    render(<LeagueTimeline history={mockHistory} currentTier="silver" />);

    const chart = screen.getByTestId('line-chart');
    expect(chart).toHaveAttribute('data-points', '3');
  });

  it('uses cycleNumber as X-axis data key', () => {
    render(<LeagueTimeline history={mockHistory} currentTier="silver" />);

    const xAxis = screen.getByTestId('x-axis');
    expect(xAxis).toHaveAttribute('data-datakey', 'cycleNumber');
  });
});
