/**
 * Unit tests for the admin TournamentsPage (`/admin/tournaments`): one request,
 * the running tournament per type with schedule status, this season per type,
 * the dominance note, every link, Refresh, and errors with Retry.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TournamentsPage from '../TournamentsPage';
import { overview } from './tournamentsFixture';

type Config = { params?: Record<string, unknown>; signal?: AbortSignal };
const mockGet = vi.fn<(url: string, config?: Config) => Promise<{ data: unknown }>>();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (url: string, config?: Config) => mockGet(url, config) },
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/tournaments']}>
      <Routes>
        <Route path="/admin/tournaments" element={<><TournamentsPage /><LocationProbe /></>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const location = (): string => screen.getByTestId('location').textContent ?? '';

describe('TournamentsPage', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: overview() });
  });

  it('loads the overview once', async () => {
    renderPage();
    await screen.findByTestId('tournament-now-robot');
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/api/admin/tournaments/overview');
    expect(screen.getByText('Last updated 07:00:00 UTC')).toBeInTheDocument();
  });

  it('shows the running 1v1 tournament on schedule', async () => {
    renderPage();
    const card = await screen.findByTestId('tournament-now-robot');
    expect(card).toHaveTextContent('1v1 Tournament #9');
    expect(card).toHaveTextContent('On schedule');
    expect(card).toHaveTextContent('Round 11 of 12 · Semi-finals');
    expect(card).toHaveTextContent('3,160 robots · started Oct 19 · finishes Oct 31');
    expect(card).toHaveTextContent('Round 11: 0 of 2 matches · runs 10:00 UTC');
    expect(card).toHaveTextContent('First-round byes: 936 of 2,048 (46%)');
    expect(within(card).getByRole('img', { name: '10 of 12 rounds done, round 11 next' })).toBeInTheDocument();
    expect(within(card).queryByTestId('tournament-status-details')).not.toBeInTheDocument();
  });

  it('explains why a tournament is not on schedule', async () => {
    renderPage();
    const card = await screen.findByTestId('tournament-now-team_2v2');
    expect(card).toHaveTextContent('Not advancing');
    const details = within(card).getByTestId('tournament-status-details');
    expect(details).toHaveTextContent('No match finished for more than 26 hours (last Oct 28)');
    expect(details).toHaveTextContent('3 matches of an earlier round never finished.');
    expect(card).toHaveTextContent('1,201 teams');
  });

  it('says when a type has no running tournament', async () => {
    renderPage();
    expect(await screen.findByTestId('tournament-now-team_3v3')).toHaveTextContent('No 3v3 tournament running');
  });

  it('shows a paused status during the preparation phase', async () => {
    const data = overview();
    data.types[0].current!.status = { level: 'info', reasons: ['paused'] };
    mockGet.mockResolvedValue({ data });
    renderPage();
    const card = await screen.findByTestId('tournament-now-robot');
    expect(card).toHaveTextContent('Paused');
    expect(card).toHaveTextContent('preparation phase');
  });

  it('links the bracket and the tournament battles', async () => {
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByTestId('tournament-now-robot');
    expect(within(card).getByRole('link', { name: /Tournament battles/ })).toHaveAttribute('href', '/admin/battles?mode=tournament_1v1&range=30d');
    await user.click(within(card).getByRole('link', { name: /Bracket/ }));
    expect(location()).toBe('/tournaments/62');
  });

  it('summarises this season per type', async () => {
    renderPage();
    const panel = await screen.findByTestId('tournament-season-robot');
    expect(panel).toHaveTextContent('completed8');
    expect(panel).toHaveTextContent('days on average9.9');
    expect(panel).toHaveTextContent('won by players8/8');
    expect(within(panel).getByRole('img', { name: /robots per tournament, oldest first: 221, 251/ })).toBeInTheDocument();
    expect(panel).toHaveTextContent('3,160 now');
    const stables = within(panel).getByRole('list', { name: '1v1 champion stables' });
    expect(stables).toHaveTextContent('Hit Machine7 of 8');
    const recent = within(panel).getByRole('list', { name: 'Recent 1v1 champions' });
    expect(recent).toHaveTextContent('#8 · Oct 19HitHardHit Machine');
    expect(recent).toHaveTextContent('DeletedUnknown stable');
    expect(await screen.findByTestId('tournament-season-team_3v3')).toHaveTextContent('No tournaments yet this season.');
  });

  it('links champion stables to the player detail and champions to their bracket', async () => {
    const user = userEvent.setup();
    renderPage();
    const panel = await screen.findByTestId('tournament-season-robot');
    expect(within(panel).getByRole('link', { name: '#8 · Oct 19' })).toHaveAttribute('href', '/tournaments/59');
    await user.click(within(within(panel).getByRole('list', { name: '1v1 champion stables' })).getByRole('link', { name: 'Hit Machine' }));
    expect(location()).toBe('/admin/players?user=7');
  });

  it('notes a stable that holds most titles', async () => {
    renderPage();
    const note = await screen.findByTestId('tournament-dominance-note');
    expect(note).toHaveTextContent('Hit Machine won 7 of 8 1v1 and 10 of 12 2v2 tournaments this season; no generated or Automaton stable has won any.');
    expect(within(note).getByRole('link', { name: 'Hit Machine' })).toHaveAttribute('href', '/admin/players?user=7');
    expect(note).toHaveTextContent('One stable wins most titles');
  });

  it('shows no note when no stable dominates', async () => {
    const data = overview();
    data.types.forEach((entry) => { entry.season.dominantStable = null; });
    mockGet.mockResolvedValue({ data });
    renderPage();
    await screen.findByTestId('tournament-now-robot');
    expect(screen.queryByTestId('tournament-dominance-note')).not.toBeInTheDocument();
  });

  it('refreshes on Refresh and keeps the data on screen meanwhile', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('tournament-now-robot');
    let resolve: (value: { data: unknown }) => void = () => {};
    mockGet.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Refreshing…')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-now-robot')).toBeInTheDocument();
    resolve({ data: overview({ generatedAt: '2026-10-30T08:00:00.000Z' }) });
    expect(await screen.findByText('Last updated 08:00:00 UTC')).toBeInTheDocument();
  });

  it('shows an error with Retry when the first load fails', async () => {
    const user = userEvent.setup();
    mockGet.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load tournaments.');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('tournament-now-robot')).toBeInTheDocument();
  });
});
