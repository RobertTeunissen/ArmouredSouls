import React from 'react';
import GridIcon from '../assets/icons/view-modes/grid.svg?react';
import ListIcon from '../assets/icons/view-modes/list.svg?react';

interface ViewModeToggleProps {
  viewMode: 'card' | 'table';
  onViewModeChange: (mode: 'card' | 'table') => void;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ viewMode, onViewModeChange }) => {
  return (
    <div className="flex items-center gap-2 bg-surface rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('card')}
        className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
          viewMode === 'card'
            ? 'bg-primary text-white'
            : 'text-secondary hover:text-white hover:bg-surface-elevated'
        }`}
        aria-label="Card View"
        title="Card View"
      >
        <GridIcon className="w-5 h-5" />
        <span className="text-sm font-medium">Card</span>
      </button>
      <button
        onClick={() => onViewModeChange('table')}
        className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
          viewMode === 'table'
            ? 'bg-primary text-white'
            : 'text-secondary hover:text-white hover:bg-surface-elevated'
        }`}
        aria-label="Table View"
        title="Table View"
      >
        <ListIcon className="w-5 h-5" />
        <span className="text-sm font-medium">Table</span>
      </button>
    </div>
  );
};

export default ViewModeToggle;
