/**
 * Unit Tests for AdminEmptyState
 *
 * Tests icon, title, description, and action button rendering.
 *
 * _Requirements: 26.6_
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminEmptyState } from '../AdminEmptyState';

describe('AdminEmptyState', () => {
  it('should render the title', () => {
    render(<AdminEmptyState title="No data available" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should render the icon when provided', () => {
    render(<AdminEmptyState icon="📭" title="No messages" />);

    expect(screen.getByText('📭')).toBeInTheDocument();
  });

  it('should not render icon element when icon is not provided', () => {
    const { container } = render(<AdminEmptyState title="Empty" />);

    const iconElements = container.querySelectorAll('[role="img"]');
    expect(iconElements.length).toBe(0);
  });

  it('should render the description when provided', () => {
    render(
      <AdminEmptyState
        title="No players"
        description="Try adjusting your search filters"
      />,
    );

    expect(screen.getByText('Try adjusting your search filters')).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    render(<AdminEmptyState title="Empty" />);

    // Only the title heading should be present
    const paragraphs = screen.queryAllByRole('paragraph');
    // No description paragraph
    expect(screen.queryByText('Try adjusting')).not.toBeInTheDocument();
  });

  it('should render the action button when action is provided', () => {
    const onClick = vi.fn();

    render(
      <AdminEmptyState
        title="No results"
        action={{ label: 'Reset Filters', onClick }}
      />,
    );

    const button = screen.getByText('Reset Filters');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('should call action onClick when the button is clicked', () => {
    const onClick = vi.fn();

    render(
      <AdminEmptyState
        title="No results"
        action={{ label: 'Try Again', onClick }}
      />,
    );

    fireEvent.click(screen.getByText('Try Again'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should not render action button when action is not provided', () => {
    render(<AdminEmptyState title="Empty" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render all props together', () => {
    const onClick = vi.fn();

    render(
      <AdminEmptyState
        icon="🔍"
        title="No matches found"
        description="We couldn't find any results for your query"
        action={{ label: 'Clear Search', onClick }}
      />,
    );

    expect(screen.getByText('🔍')).toBeInTheDocument();
    expect(screen.getByText('No matches found')).toBeInTheDocument();
    expect(screen.getByText("We couldn't find any results for your query")).toBeInTheDocument();
    expect(screen.getByText('Clear Search')).toBeInTheDocument();
  });
});
