/**
 * Hall of Records — Automaton_Badge on every record (Spec #55 decision 42).
 *
 * Every record that names a stable shows the badge directly after an Automaton
 * stable's name: on the board tile and in the full list. Human and generated
 * stables get none.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecordStableName } from '../RecordStableName';
import { RecordDetail } from '../RecordDetail';
import { RecordTile } from '../RecordTile';
import { buildRecordCatalogue } from '../../../utils/hallOfRecords';
import { AUTO, HUMAN, fullRecords } from './fixtures';

const catalogue = buildRecordCatalogue(fullRecords()).filter((r) => r.variants.length > 0);

describe('RecordStableName', () => {
  it('adds the badge after an Automaton stable name on the same line', () => {
    render(<p><RecordStableName name={AUTO.username} stableType="automaton" /></p>);
    const wrapper = screen.getByTestId('record-stable-name');
    expect(wrapper).toHaveClass('flex-nowrap');
    expect(wrapper.firstElementChild).toHaveTextContent(AUTO.username);
    expect(wrapper.lastElementChild).toHaveAttribute('data-testid', 'automaton-badge');
  });

  it.each(['human', 'generated', null, undefined] as const)('renders plain text for %s stables', (stableType) => {
    const { container } = render(<p><RecordStableName name={HUMAN.username} stableType={stableType} /></p>);
    expect(container.textContent).toBe(HUMAN.username);
    expect(screen.queryByTestId('automaton-badge')).not.toBeInTheDocument();
  });
});

describe('Hall of Records — badge on every record (decision 42)', () => {
  it('covers every record in the fixture', () => {
    expect(catalogue.map((r) => r.key)).toHaveLength(23);
  });

  it.each(catalogue.map((r) => [r.key, r] as const))('%s tile badges its Automaton holder', (_key, record) => {
    render(
      <MemoryRouter>
        <RecordTile record={record} detailHref="/x" viewerId={null} myBest={null} />
      </MemoryRouter>,
    );
    const tile = screen.getByTestId(`record-tile-${record.key}`);
    const automatonRows = record.variants.filter((v) => v.rows[0].holder.stable.stableType === 'automaton').length;
    expect(within(tile).getAllByTestId('automaton-badge').length).toBe(automatonRows);
  });

  it('badges Automaton rows only in the full list', () => {
    const record = catalogue.find((r) => r.key === 'highestElo');
    if (!record) throw new Error('missing record');
    render(
      <MemoryRouter>
        <RecordDetail record={record} siblings={[record]} variantKey={null} viewerId={null} backHref="/" detailHref={() => '/'} />
      </MemoryRouter>,
    );
    const rows = screen.getAllByTestId('record-detail-row');
    expect(within(rows[0]).getByTestId('automaton-badge')).toBeInTheDocument();
    expect(within(rows[1]).queryByTestId('automaton-badge')).not.toBeInTheDocument();
  });
});
