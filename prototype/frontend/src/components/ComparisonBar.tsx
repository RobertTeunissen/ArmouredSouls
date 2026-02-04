interface ComparisonBarProps {
  selectedCount: number;
  onCompare: () => void;
  onClear: () => void;
}

export default function ComparisonBar({ selectedCount, onCompare, onClear }: ComparisonBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50">
      <span className="font-semibold">
        {selectedCount} weapon{selectedCount > 1 ? 's' : ''} selected
      </span>
      <button
        onClick={onCompare}
        disabled={selectedCount < 2}
        className="bg-white text-blue-600 px-4 py-1 rounded-full font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Compare →
      </button>
      <button
        onClick={onClear}
        className="text-white hover:text-blue-100 underline"
      >
        Clear
      </button>
    </div>
  );
}
