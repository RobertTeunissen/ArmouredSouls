/**
 * StableNoteCard — the dashboard's read-only private strategy note (#611).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StableNoteCard } from '../StableNoteCard';

function renderCard(note: string | null | undefined) {
  return render(
    <MemoryRouter>
      <StableNoteCard note={note} />
    </MemoryRouter>,
  );
}

describe('StableNoteCard', () => {
  it('renders nothing when the note is null', () => {
    const { container } = renderCard(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the note is undefined', () => {
    const { container } = renderCard(undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the note is only whitespace', () => {
    const { container } = renderCard('   \n  ');
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the note content when present', () => {
    renderCard('Rush bronze, bank for diamond.');
    expect(screen.getByText('Stable Notes')).toBeInTheDocument();
    expect(screen.getByText('Rush bronze, bank for diamond.')).toBeInTheDocument();
  });

  it('preserves multi-line content with whitespace-pre-wrap', () => {
    const multiline = 'Line one\nLine two\n\nParagraph two';
    renderCard(multiline);
    const noteEl = screen.getByText((_, el) => el?.textContent === multiline && el.tagName === 'P');
    expect(noteEl).toHaveClass('whitespace-pre-wrap');
  });

  it('links to the profile page for editing', () => {
    renderCard('A note');
    const link = screen.getByRole('link', { name: /Edit in Profile/i });
    expect(link).toHaveAttribute('href', '/profile');
  });
});
