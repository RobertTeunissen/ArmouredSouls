import { useState } from 'react';

interface RobotImageProps {
  imageUrl: string | null;
  robotName: string;
  size?: 'small' | 'medium' | 'large' | 'hero';
  className?: string;
  showEdit?: boolean;
  onEditClick?: () => void;
}

const SIZE_CLASSES = {
  small: 'w-16 h-16',
  medium: 'w-32 h-32',
  large: 'w-48 h-48',
  hero: 'w-64 h-64',
};

function RobotImage({ 
  imageUrl,
  robotName,
  size = 'medium', 
  className = '',
  showEdit = false,
  onEditClick 
}: RobotImageProps) {
  const [imageError, setImageError] = useState(false);
  
  const sizeClass = SIZE_CLASSES[size];

  // Show placeholder if no image selected or image failed to load
  if (!imageUrl || imageError) {
    return (
      <div 
        className={`${sizeClass} ${className} bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 relative group`}
      >
        <div className="text-center">
          <div className={`${size === 'hero' ? 'text-6xl' : size === 'large' ? 'text-5xl' : size === 'medium' ? 'text-4xl' : 'text-2xl'} mb-1`}>
            🤖
          </div>
          <div className="text-gray-400 text-xs">{robotName.charAt(0).toUpperCase()}</div>
        </div>
        {showEdit && onEditClick && (
          <button
            onClick={onEditClick}
            className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
            title="Select robot image"
          >
            <span className="text-white text-sm font-semibold">🖼️ Select Image</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`${sizeClass} ${className} relative group flex-shrink-0`}>
      <img
        src={imageUrl}
        alt={`${robotName} robot portrait`}
        className="w-full h-full object-cover rounded-lg"
        onError={() => setImageError(true)}
      />
      {showEdit && onEditClick && (
        <button
          onClick={onEditClick}
          className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg"
          title="Change robot image"
        >
          <span className="text-white text-sm font-semibold">🖼️ Change Image</span>
        </button>
      )}
    </div>
  );
}

export default RobotImage;
