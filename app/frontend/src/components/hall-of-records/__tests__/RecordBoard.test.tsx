import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RecordBoard } from '../RecordBoard';
import { buildRecordCatalogue, findMyPlaces } from '../../../utils/hallOfRecords';
import { fullRecords, VIEWER } from './fixtures';
import { RECORD_GROUPS } from '../types';

const catalogue = buildRecordCatalogue(fullRecords()).filter((r) => r.variants.length > 0);

function renderBoard(collapseOnMobile: boolean) {
  return render(
    <MemoryRouter>
      <RecordBoard
        records={catalogue}
        groups={RECORD_GROUPS}
        viewerId={VIEWER.userId}
        places={findMyPlaces(catalogue, VIEWER.userId)}
        detailHref={() => '/x'}
        collapseOnMobile={collapseOnMobile}
      />
    </MemoryRouter>,
  );
}

const hiddenOnPhones = (key: string) => screen.getByTestId(`record-tile-${key}`).className.includes('max-md:hidden');

describe('RecordBoard — phones', () => {
  it('shows the first two tiles of each group and a "Show all" button', () => {
    renderBoard(true);
    expect(hiddenOnPhones('mostBattles')).toBe(false);
    expect(hiddenOnPhones('highestWinRate')).toBe(false);
    expect(hiddenOnPhones('highestElo')).toBe(true);
    const toggle = screen.getByTestId('record-group-toggle-robots');
    expect(toggle).toHaveTextContent('Show all 6 records');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveClass('md:hidden');
  });

  it('expands and collapses one group at a time', async () => {
    const user = userEvent.setup();
    renderBoard(true);

    await user.click(screen.getByTestId('record-group-toggle-robots'));

    expect(hiddenOnPhones('highestElo')).toBe(false);
    expect(screen.getByTestId('record-group-toggle-robots')).toHaveTextContent('Show fewer');
    expect(hiddenOnPhones('kothZoneTime')).toBe(true);

    await user.click(screen.getByTestId('record-group-toggle-robots'));
    expect(hiddenOnPhones('highestElo')).toBe(true);
  });

  it('shows every tile and no button when not collapsing', () => {
    renderBoard(false);
    expect(hiddenOnPhones('highestElo')).toBe(false);
    expect(screen.queryByTestId('record-group-toggle-robots')).not.toBeInTheDocument();
  });
});

describe('RecordBoard — wide screens', () => {
  it('picks the column count per group that leaves the fewest gaps', () => {
    renderBoard(false);
    const grid = (group: string) => within(screen.getByTestId(`record-group-${group}`)).getAllByRole('article')[0].parentElement;
    // Six robot records fill two rows of three.
    expect(grid('robots')?.className).toContain('xl:grid-cols-3');
    // Seven KotH & Melee records: four columns leave one gap, three leave two.
    expect(grid('koth-melee')?.className).toContain('xl:grid-cols-4');
  });
});
