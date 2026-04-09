/**
 * ResumeTutorialButton component
 * A button that navigates to the onboarding tutorial.
 * Used in settings page or dashboard to resume/replay the tutorial.
 *
 * Requirements: 22.5-22.10
 */

import { useNavigate } from 'react-router-dom';

interface ResumeTutorialButtonProps {
  /** Button label text. Defaults to "Resume Tutorial". */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

const ResumeTutorialButton = ({
  label = 'Resume Tutorial',
  className = '',
  disabled = false,
}: ResumeTutorialButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/onboarding');
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded transition-colors ${className}`}
      aria-label={label}
    >
      {label}
    </button>
  );
};

export default ResumeTutorialButton;
