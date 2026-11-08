import { describe, it, expect, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScrollRow } from '../ScrollRow';

/** jsdom has no layout: give the scroll container the sizes a phone would. */
function sizeRow(row: HTMLElement, { scrollWidth, clientWidth, scrollLeft }: { scrollWidth: number; clientWidth: number; scrollLeft: number }) {
  Object.defineProperty(row, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(row, 'clientWidth', { configurable: true, value: clientWidth });
  row.scrollLeft = scrollLeft;
}

function renderRow() {
  render(
    <ScrollRow label="Record groups">
      <button type="button">One</button>
      <button type="button">Two</button>
    </ScrollRow>,
  );
  return screen.getByRole('group', { name: 'Record groups' });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ScrollRow', () => {
  it('shows no fade when everything fits', () => {
    renderRow();
    expect(screen.queryByTestId('scroll-fade-start')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-fade-end')).not.toBeInTheDocument();
  });

  it('fades the edges that still have chips beyond them', () => {
    const row = renderRow();

    sizeRow(row, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(row);
    expect(screen.queryByTestId('scroll-fade-start')).not.toBeInTheDocument();
    expect(screen.getByTestId('scroll-fade-end')).toBeInTheDocument();

    sizeRow(row, { scrollWidth: 600, clientWidth: 300, scrollLeft: 150 });
    fireEvent.scroll(row);
    expect(screen.getByTestId('scroll-fade-start')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-fade-end')).toBeInTheDocument();

    sizeRow(row, { scrollWidth: 600, clientWidth: 300, scrollLeft: 300 });
    fireEvent.scroll(row);
    expect(screen.getByTestId('scroll-fade-start')).toBeInTheDocument();
    expect(screen.queryByTestId('scroll-fade-end')).not.toBeInTheDocument();
  });

  it('can label a row of links as navigation', () => {
    render(<ScrollRow label="Records in this group" as="navigation"><a href="/x">X</a></ScrollRow>);
    expect(screen.getByRole('navigation', { name: 'Records in this group' })).toBeInTheDocument();
  });
});
