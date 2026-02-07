/**
 * BattleReadinessBadge Component
 * 
 * Displays the battle readiness status of a robot
 * States: Ready, Needs Repair, No Weapon
 */

interface BattleReadinessBadgeProps {
  status: 'ready' | 'needs-repair' | 'no-weapon';
  size?: 'sm' | 'md';
}

function BattleReadinessBadge({ status, size = 'md' }: BattleReadinessBadgeProps) {
  // Status configurations
  const statusConfig = {
    ready: {
      label: 'Ready',
      bgColor: 'bg-success',
      textColor: 'text-white',
      icon: '✓',
    },
    'needs-repair': {
      label: 'Needs Repair',
      bgColor: 'bg-error',
      textColor: 'text-white',
      icon: '⚠',
    },
    'no-weapon': {
      label: 'No Weapon',
      bgColor: 'bg-warning',
      textColor: 'text-gray-900',
      icon: '!',
    },
  };
  
  const config = statusConfig[status];
  
  // Size variants
  const textSizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };
  
  return (
    <span 
      className={`
        inline-flex items-center gap-1
        ${config.bgColor} ${config.textColor}
        ${textSizes[size]}
        rounded-full font-semibold
      `}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

export default BattleReadinessBadge;
