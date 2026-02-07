/**
 * HPBar Component
 * 
 * Displays a health bar with color coding based on percentage
 * Per design system: Green (70-100%), Yellow (30-69%), Red (0-29%)
 */

interface HPBarProps {
  current: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function HPBar({ current, max, label = 'HP', showPercentage = true, size = 'md' }: HPBarProps) {
  // Calculate percentage
  const percentage = max > 0 ? Math.round((current / max) * 100) : 0;
  
  // Determine color based on percentage (design system rules)
  let barColor = 'bg-success'; // Green (70-100%)
  let textColor = 'text-success';
  
  if (percentage < 30) {
    barColor = 'bg-error'; // Red (0-29%)
    textColor = 'text-error';
  } else if (percentage < 70) {
    barColor = 'bg-warning'; // Yellow (30-69%)
    textColor = 'text-warning';
  }
  
  // Size variants
  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };
  
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };
  
  return (
    <div className="w-full">
      {/* Label and percentage */}
      {showPercentage && (
        <div className="flex justify-between items-center mb-1">
          <span className={`${textSizes[size]} text-gray-400`}>{label}:</span>
          <span className={`${textSizes[size]} font-semibold ${textColor}`}>
            {percentage}%
          </span>
        </div>
      )}
      
      {/* Bar */}
      <div className={`w-full ${heights[size]} bg-gray-700 rounded-full overflow-hidden`}>
        <div
          className={`${heights[size]} ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default HPBar;
