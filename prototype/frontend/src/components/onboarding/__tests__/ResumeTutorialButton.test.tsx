import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ResumeTutorialButton from '../ResumeTutorialButton';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderButton = (props = {}) => {
  return render(
    <MemoryRouter>
      <ResumeTutorialButton {...props} />
    </MemoryRouter>
  );
};

describe('ResumeTutorialButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with default "Resume Tutorial" text', () => {
    renderButton();
    expect(screen.getByText('Resume Tutorial')).toBeInTheDocument();
  });

  it('should render with custom label', () => {
    renderButton({ label: 'Replay Tutorial' });
    expect(screen.getByText('Replay Tutorial')).toBeInTheDocument();
  });

  it('should navigate to /onboarding when clicked', () => {
    renderButton();
    fireEvent.click(screen.getByText('Resume Tutorial'));
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
  });

  it('should be disabled when disabled prop is true', () => {
    renderButton({ disabled: true });
    expect(screen.getByText('Resume Tutorial')).toBeDisabled();
  });

  it('should not navigate when disabled', () => {
    renderButton({ disabled: true });
    fireEvent.click(screen.getByText('Resume Tutorial'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    renderButton({ className: 'custom-class' });
    const button = screen.getByText('Resume Tutorial');
    expect(button).toHaveClass('custom-class');
  });
});
