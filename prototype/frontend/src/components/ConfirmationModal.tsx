import React from 'react';

interface ConfirmationModalProps {
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-75"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4 border border-gray-700 animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
        </div>
        
        {/* Body */}
        <div className="px-6 py-4">
          {typeof message === 'string' ? (
            <p className="text-gray-300">{message}</p>
          ) : (
            message
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-white transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
              isDestructive 
                ? 'bg-error hover:bg-error/80' 
                : 'bg-primary hover:bg-primary-dark'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
