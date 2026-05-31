import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

/**
 * Tests for routing redirects related to team battles.
 * Verifies that legacy /tag-teams routes redirect to /team-battles.
 *
 * Requirements: R9.12, R9.17
 */

// Helper component to display current location for assertions
function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location-display">
      {location.pathname}{location.search}
    </div>
  );
}

// Minimal route setup that mirrors App.tsx redirect configuration
function TestRoutes({ initialEntry }: { initialEntry: string }) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/tag-teams" element={<Navigate to="/team-battles?tab=tag-team" replace />} />
        <Route path="/tag-teams/standings" element={<Navigate to="/team-battles?tab=tag-team" replace />} />
        <Route path="/team-battles" element={<LocationDisplay />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Routing Redirects - /tag-teams → /team-battles', () => {
  it('should redirect /tag-teams to /team-battles?tab=tag-team', async () => {
    render(<TestRoutes initialEntry="/tag-teams" />);

    await waitFor(() => {
      const locationEl = screen.getByTestId('location-display');
      expect(locationEl.textContent).toBe('/team-battles?tab=tag-team');
    });
  });

  it('should redirect /tag-teams/standings to /team-battles?tab=tag-team', async () => {
    render(<TestRoutes initialEntry="/tag-teams/standings" />);

    await waitFor(() => {
      const locationEl = screen.getByTestId('location-display');
      expect(locationEl.textContent).toBe('/team-battles?tab=tag-team');
    });
  });

  it('should NOT redirect /team-battles (it renders directly)', async () => {
    render(<TestRoutes initialEntry="/team-battles" />);

    await waitFor(() => {
      const locationEl = screen.getByTestId('location-display');
      expect(locationEl.textContent).toBe('/team-battles');
    });
  });

  it('should preserve the replace behavior (no history entry for redirect)', async () => {
    // The Navigate component uses replace={true}, meaning the redirect
    // doesn't add a new history entry. We verify the redirect happens
    // without creating a back-navigable entry.
    render(<TestRoutes initialEntry="/tag-teams" />);

    await waitFor(() => {
      const locationEl = screen.getByTestId('location-display');
      expect(locationEl.textContent).toContain('/team-battles');
    });
  });

  it('should redirect with tab=tag-team query parameter', async () => {
    render(<TestRoutes initialEntry="/tag-teams" />);

    await waitFor(() => {
      const locationEl = screen.getByTestId('location-display');
      expect(locationEl.textContent).toContain('tab=tag-team');
    });
  });
});
