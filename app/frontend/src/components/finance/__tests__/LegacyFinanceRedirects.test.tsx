import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LegacyCycleSummaryRedirect, LegacyFinancesRedirect } from '../LegacyFinanceRedirects';

function Destination(): React.ReactElement {
  const location = useLocation();
  return <p>{`${location.pathname}${location.search}${location.hash}`}</p>;
}

describe('legacy finance redirects', () => {
  it('preserves query and hash when redirecting /finances', () => {
    render(<MemoryRouter initialEntries={['/finances?tab=robots#atlas']}><Routes><Route path="/finances" element={<LegacyFinancesRedirect />} /><Route path="/income" element={<Destination />} /></Routes></MemoryRouter>);
    expect(screen.getByText('/income?tab=robots#atlas')).toBeInTheDocument();
  });

  it('retains a valid legacy lastNCycles value for exact post-metadata translation', () => {
    render(<MemoryRouter initialEntries={['/cycle-summary?lastNCycles=10']}><Routes><Route path="/cycle-summary" element={<LegacyCycleSummaryRedirect />} /><Route path="/income" element={<Destination />} /></Routes></MemoryRouter>);
    expect(screen.getByText('/income?tab=history&lastNCycles=10')).toBeInTheDocument();
  });

  it('uses last seven completed cycles for malformed legacy state', () => {
    render(<MemoryRouter initialEntries={['/cycle-summary?lastNCycles=nope']}><Routes><Route path="/cycle-summary" element={<LegacyCycleSummaryRedirect />} /><Route path="/income" element={<Destination />} /></Routes></MemoryRouter>);
    expect(screen.getByText('/income?tab=history&scope=last_seven')).toBeInTheDocument();
  });
});
