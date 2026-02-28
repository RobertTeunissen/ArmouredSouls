import { useState, useEffect, useMemo } from 'react';

interface RobotImageSelectorProps {
  isOpen: boolean;
  currentImageUrl: string | null;
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
}

// Dynamically import all .webp images from the robots directory
const imageModules = import.meta.glob('/src/assets/robots/*.webp', { eager: true, query: '?url', import: 'default' });

// Helper function to format image name from filename
function formatImageName(filename: string): { name: string; description: string } {
  // Extract the base name without extension
  // e.g., "robot-chassis-humanoid-red" from "/src/assets/robots/robot-chassis-humanoid-red.webp"
  const baseName = filename
    .replace('/src/assets/robots/', '')
    .replace('robot-chassis-', '')
    .replace('.webp', '');
  
  // Split by hyphens and capitalize each word
  const words = baseName.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  );
  
  const name = words.join(' ');
  
  // Generate description based on chassis type
  const descriptions: { [key: string]: string } = {
    'humanoid': 'Standard humanoid combat frame',
    'berserker': 'Heavy assault berserker frame',
    'brawler': 'Close combat brawler frame',
    'defender': 'Defensive tank frame',
    'sniper': 'Long-range sniper platform',
  };
  
  const chassisType = baseName.split('-')[0];
  const description = descriptions[chassisType] || 'Combat robot chassis';
  
  return { name, description };
}

function RobotImageSelector({ isOpen, currentImageUrl, onSelect, onClose }: RobotImageSelectorProps) {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(currentImageUrl);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());

  // Generate available images from dynamically imported modules
  const availableImages = useMemo(() => {
    return Object.entries(imageModules)
      .filter(([path]) => path.endsWith('.webp'))
      .map(([path, url]) => {
        const { name, description } = formatImageName(path);
        return {
          url: url as string, // Use the actual imported URL, not the path
          name,
          description,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
  }, []);

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedImageUrl(currentImageUrl);
      setImageLoadErrors(new Set());
    }
  }, [isOpen, currentImageUrl]);

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleConfirm = () => {
    if (selectedImageUrl) {
      onSelect(selectedImageUrl);
    }
    onClose();
  };

  const handleCancel = () => {
    setSelectedImageUrl(currentImageUrl);
    onClose();
  };

  const handleImageError = (url: string) => {
    setImageLoadErrors(prev => new Set(prev).add(url));
  };

  // Filter out images that failed to load
  const displayImages = availableImages.filter(img => !imageLoadErrors.has(img.url));

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Customize Robot Appearance</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Preview Section */}
          <div className="mb-8 bg-gray-900 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-white">Preview</h3>
            <div className="flex items-center justify-center">
              <div className="relative">
                {selectedImageUrl ? (
                  <img
                    src={selectedImageUrl}
                    alt="Robot preview"
                    className="w-64 h-64 rounded-lg object-cover"
                    onError={() => handleImageError(selectedImageUrl)}
                  />
                ) : (
                  <div className="w-64 h-64 bg-gray-700 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-2">🤖</div>
                      <div className="text-white font-semibold">No Image Selected</div>
                      <div className="text-sm text-gray-400 mt-2">
                        Select an image below
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Image Selection Grid */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-4 text-white">
              Available Images ({displayImages.length})
            </h3>
            
            {displayImages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📁</div>
                <p>No images available yet.</p>
                <p className="text-sm mt-2">Add images to src/assets/robots/</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayImages.map((image) => (
                  <button
                    key={image.url}
                    onClick={() => setSelectedImageUrl(image.url)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedImageUrl === image.url
                        ? 'border-blue-500 bg-blue-900 bg-opacity-30'
                        : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <div className="aspect-square bg-gray-800 rounded overflow-hidden">
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(image.url)}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-6 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedImageUrl}
            className={`px-6 py-2 rounded-lg transition-colors font-semibold ${
              selectedImageUrl
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {selectedImageUrl ? 'Apply Image' : 'Select an Image'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RobotImageSelector;
