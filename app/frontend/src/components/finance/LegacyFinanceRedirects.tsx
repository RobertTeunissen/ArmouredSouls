import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export function LegacyFinancesRedirect(): React.ReactElement {
  const location = useLocation();
  return <Navigate replace to={`/income${location.search}${location.hash}`} />;
}

export function LegacyCycleSummaryRedirect(): React.ReactElement {
  const location = useLocation();
  const source = new URLSearchParams(location.search);
  const rawCount = source.get('lastNCycles');
  const validCount = rawCount !== null && /^\d+$/.test(rawCount) && Number(rawCount) >= 1 && Number(rawCount) <= 100
    ? Number(rawCount)
    : null;
  const destination = new URLSearchParams({ tab: 'history' });

  if (validCount === null) destination.set('scope', 'last_seven');
  else destination.set('lastNCycles', String(validCount));

  return <Navigate replace to={`/income?${destination.toString()}`} />;
}
