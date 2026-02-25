import { useState } from 'react';
import apiClient from '../utils/apiClient';

interface StableNameModalProps {
  onComplete: () => void;
}

function StableNameModal({ onComplete }: StableNameModalProps) {
  const [stableName, setStableName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stableName.trim()) {
      setError('Stable name is required');
      return;
    }

    if (stableName.length > 100) {
      setError('Stable name must be 100 characters or less');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiClient.put('/api/user/stable-name', {
        stableName: stableName.trim(),
      });
      
      onComplete();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to set stable name');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-3xl font-bold mb-4 text-white">Welcome to Armoured Souls!</h2>
        <p className="text-gray-300 mb-6">
          Before you begin your journey, you need to name your stable. This will be the home for all your battle robots.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="stableName" className="block text-sm font-medium text-gray-300 mb-2">
              Stable Name
            </label>
            <input
              type="text"
              id="stableName"
              value={stableName}
              onChange={(e) => setStableName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter your stable name..."
              maxLength={100}
              disabled={submitting}
              autoFocus
            />
            <p className="text-sm text-gray-400 mt-1">
              Choose wisely - this represents your battle legacy!
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !stableName.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded transition-colors"
          >
            {submitting ? 'Creating Stable...' : 'Begin Your Journey'}
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-500 text-center">
          💰 You start with ₡2,000,000 credits
        </div>
      </div>
    </div>
  );
}

export default StableNameModal;
