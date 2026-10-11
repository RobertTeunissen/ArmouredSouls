import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EventOrderList } from '../EventOrderList';
import { EVENT_ORDER } from './fixtures';

function Harness() {
  const [value, setValue] = useState(EVENT_ORDER);
  return <EventOrderList value={value} onChange={setValue} />;
}

describe('EventOrderList (Event_Order control, R11.10)', () => {
  it('names every button with position and event, and disables the ends', () => {
    render(<Harness />);
    expect(screen.getByRole('list', { name: 'Event order' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(9);
    expect(screen.getByRole('button', { name: 'Move up: 1 2v2 League' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move down: 9 2v2 Tournament' })).toBeDisabled();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('min-h-11', 'min-w-11');
    }
  });

  it('moves an event and keeps focus on the moved row\'s pressed button', () => {
    render(<Harness />);
    const down = screen.getByRole('button', { name: 'Move down: 2 Tag Team' });
    down.focus();
    fireEvent.click(down);
    const moved = screen.getByRole('button', { name: 'Move down: 3 Tag Team' });
    expect(moved).toHaveFocus();
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent('3v3 League');
  });

  it('moves focus to the other button when the pressed one becomes disabled', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Move up: 2 Tag Team' }));
    expect(screen.getByRole('button', { name: 'Move up: 1 Tag Team' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move down: 1 Tag Team' })).toHaveFocus();
  });

  it('lays out two columns at ≥ 1024 px with the DOM order 1–9', () => {
    render(<Harness />);
    const list = screen.getByRole('list', { name: 'Event order' });
    expect(list).toHaveClass('grid-cols-1', 'lg:grid-cols-2', 'lg:grid-flow-col', 'lg:grid-rows-5');
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('span')?.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });
});
