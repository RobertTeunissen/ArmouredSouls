import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass = 'bg-blue-600 hover:bg-blue-700',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-75"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4 border border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
        </div>
        
        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-gray-300">{message}</p>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white transition-colors font-medium ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
