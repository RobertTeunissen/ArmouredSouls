import React from 'react';
import GridIcon from '../assets/icons/view-modes/grid.svg?react';
import ListIcon from '../assets/icons/view-modes/list.svg?react';

interface ViewModeToggleProps {
  viewMode: 'card' | 'table';
  onViewModeChange: (mode: 'card' | 'table') => void;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ viewMode, onViewModeChange }) => {
  return (
    <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('card')}
        className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
          viewMode === 'card'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-700'
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
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-700'
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
