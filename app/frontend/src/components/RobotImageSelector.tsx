import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

interface RobotImageSelectorProps {
  isOpen: boolean;
  currentImageUrl: string | null;
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
  robotId?: number;
}

// Dynamically import all .webp images from the robots directory
const imageModules = import.meta.glob('/src/assets/robots/*.webp', { eager: true, query: '?url', import: 'default' });

// Helper function to format image name from filename
function formatImageName(filename: string): { name: string; description: string } {
  const baseName = filename
    .replace('/src/assets/robots/', '')
    .replace('robot-chassis-', '')
    .replace('.webp', '');

  const words = baseName.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  );

  const name = words.join(' ');

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

// --- Client-side file validation ---
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUploadFile(file: File): FileValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, and WebP images are allowed.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File must be under 2 MB.' };
  }
  return { valid: true };
}

// --- Upload state types ---
type UploadTab = 'presets' | 'upload';

interface UploadState {
  file: File | null;
  clientPreview: string | null;
  serverPreview: string | null;
  confirmationToken: string | null;
  robotLikenessRejected: boolean;
  uploading: boolean;
  confirming: boolean;
  error: string | null;
}

const INITIAL_UPLOAD_STATE: UploadState = {
  file: null,
  clientPreview: null,
  serverPreview: null,
  confirmationToken: null,
  robotLikenessRejected: false,
  uploading: false,
  confirming: false,
  error: null,
};

// --- Client-side 512×512 center-crop preview ---
function createCropPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 512, 512);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// --- Upload Tab Component ---
function UploadTab({
  robotId,
  onUploadComplete,
}: {
  robotId: number;
  onUploadComplete: (imageUrl: string) => void;
}) {
  const [state, setState] = useState<UploadState>(INITIAL_UPLOAD_STATE);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setState(INITIAL_UPLOAD_STATE);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateUploadFile(file);
    if (!validation.valid) {
      setState(prev => ({ ...prev, error: validation.error ?? 'Invalid file.', file: null, clientPreview: null }));
      return;
    }

    try {
      const preview = await createCropPreview(file);
      setState({
        ...INITIAL_UPLOAD_STATE,
        file,
        clientPreview: preview,
      });
    } catch {
      setState(prev => ({ ...prev, error: 'Failed to generate preview.', file: null, clientPreview: null }));
    }
  };

  const uploadFile = async (acknowledgeRobotLikeness = false) => {
    if (!state.file) return;

    setState(prev => ({ ...prev, uploading: true, error: null, robotLikenessRejected: false }));

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('image', state.file);

      let url = `/api/robots/${robotId}/image`;
      if (acknowledgeRobotLikeness) {
        url += '?acknowledgeRobotLikeness=true';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        const code = data.code as string | undefined;

        if (code === 'IMAGE_MODERATION_FAILED') {
          setState(prev => ({
            ...prev,
            uploading: false,
            error: 'This image was not approved. Please choose a different image.',
            serverPreview: null,
            confirmationToken: null,
          }));
          return;
        }

        if (code === 'LOW_ROBOT_LIKENESS') {
          setState(prev => ({
            ...prev,
            uploading: false,
            robotLikenessRejected: true,
            error: null,
          }));
          return;
        }

        if (code === 'RATE_LIMIT_EXCEEDED') {
          setState(prev => ({
            ...prev,
            uploading: false,
            error: 'Too many uploads. Please wait a few minutes and try again.',
          }));
          return;
        }

        setState(prev => ({
          ...prev,
          uploading: false,
          error: data.error || 'Upload failed. Please try again.',
        }));
        return;
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        uploading: false,
        serverPreview: data.preview,
        confirmationToken: data.confirmationToken,
        robotLikenessRejected: false,
      }));
    } catch {
      setState(prev => ({
        ...prev,
        uploading: false,
        error: 'Network error. Please check your connection and try again.',
      }));
    }
  };

  const handleConfirm = async () => {
    if (!state.confirmationToken) return;

    setState(prev => ({ ...prev, confirming: true, error: null }));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/robots/${robotId}/image/confirm`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmationToken: state.confirmationToken }),
      });

      if (!response.ok) {
        const data = await response.json();
        const code = data.code as string | undefined;

        if (code === 'PREVIEW_EXPIRED') {
          setState(prev => ({
            ...prev,
            confirming: false,
            error: 'Preview expired, please re-upload the image.',
            serverPreview: null,
            confirmationToken: null,
          }));
          return;
        }

        setState(prev => ({
          ...prev,
          confirming: false,
          error: data.error || 'Confirmation failed. Please try again.',
        }));
        return;
      }

      const data = await response.json();
      const newImageUrl = data.robot?.imageUrl;
      if (newImageUrl) {
        onUploadComplete(newImageUrl);
      }
      resetState();
    } catch {
      setState(prev => ({
        ...prev,
        confirming: false,
        error: 'Network error. Please check your connection and try again.',
      }));
    }
  };

  // --- Render: Robot-likeness warning ---
  if (state.robotLikenessRejected && state.clientPreview) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <img
          src={state.clientPreview}
          alt="Upload preview"
          className="w-48 h-48 sm:w-64 sm:h-64 rounded-lg object-cover max-w-full"
        />
        <div className="bg-yellow-900/40 border border-yellow-600/50 rounded-lg p-4 text-center max-w-md">
          <p className="text-yellow-300 font-medium">This doesn&apos;t look like a robot — are you sure?</p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => uploadFile(true)}
            disabled={state.uploading}
            className="min-w-[44px] min-h-[44px] px-5 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50"
          >
            {state.uploading ? 'Uploading…' : 'Upload anyway'}
          </button>
          <button
            onClick={resetState}
            className="min-w-[44px] min-h-[44px] px-5 py-3 bg-surface-elevated hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // --- Render: Server preview confirmation ---
  if (state.serverPreview) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <h4 className="text-lg font-semibold text-white">Server-Processed Preview</h4>
        <img
          src={state.serverPreview}
          alt="Server-processed preview"
          className="w-48 h-48 sm:w-64 sm:h-64 rounded-lg object-cover max-w-full"
        />
        <p className="text-secondary text-sm text-center">This is how your robot image will look. Confirm to apply.</p>
        {state.error && (
          <div className="bg-red-900/40 border border-red-600/50 rounded-lg p-3 text-red-300 text-sm text-center max-w-md">
            {state.error}
          </div>
        )}
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={handleConfirm}
            disabled={state.confirming}
            className="min-w-[44px] min-h-[44px] px-5 py-3 bg-primary hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50"
          >
            {state.confirming ? 'Confirming…' : 'Confirm'}
          </button>
          <button
            onClick={resetState}
            disabled={state.confirming}
            className="min-w-[44px] min-h-[44px] px-5 py-3 bg-surface-elevated hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // --- Render: Client-side crop preview ---
  if (state.clientPreview) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <h4 className="text-lg font-semibold text-white">Crop Preview</h4>
        <img
          src={state.clientPreview}
          alt="Crop preview"
          className="w-48 h-48 sm:w-64 sm:h-64 rounded-lg object-cover max-w-full"
        />
        <p className="text-secondary text-sm text-center">This is how your image will be cropped to 512×512.</p>
        {state.error && (
          <div className="bg-red-900/40 border border-red-600/50 rounded-lg p-3 text-red-300 text-sm text-center max-w-md">
            {state.error}
          </div>
        )}
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => uploadFile(false)}
            disabled={state.uploading}
            className="min-w-[44px] min-h-[44px] px-5 py-3 bg-primary hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50"
          >
            {state.uploading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading…
              </span>
            ) : (
              'Upload'
            )}
          </button>
          <button
            onClick={resetState}
            disabled={state.uploading}
            className="min-w-[44px] min-h-[44px] px-5 py-3 bg-surface-elevated hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // --- Render: File selection ---
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="text-6xl mb-2">📤</div>
      <p className="text-white font-semibold text-lg">Upload a Custom Image</p>
      <p className="text-secondary text-sm text-center max-w-sm">
        Choose a JPEG, PNG, or WebP image (max 2 MB). It will be cropped to 512×512.
      </p>
      {state.error && (
        <div className="bg-red-900/40 border border-red-600/50 rounded-lg p-3 text-red-300 text-sm text-center max-w-md">
          {state.error}
        </div>
      )}
      <label className="min-w-[44px] min-h-[44px] px-6 py-3 bg-primary hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold cursor-pointer text-center">
        Choose File
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </label>
    </div>
  );
}

// --- Main Component ---
function RobotImageSelector({ isOpen, currentImageUrl, onSelect, onClose, robotId }: RobotImageSelectorProps) {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(currentImageUrl);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<UploadTab>('presets');

  const showUploadTab = robotId !== undefined;

  // Generate available images from dynamically imported modules
  const availableImages = useMemo(() => {
    return Object.entries(imageModules)
      .filter(([path]) => path.endsWith('.webp'))
      .map(([path, url]) => {
        const { name, description } = formatImageName(path);
        return {
          url: url as string,
          name,
          description,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedImageUrl(currentImageUrl);
      setImageLoadErrors(new Set());
      setActiveTab('presets');
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
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleUploadComplete = (imageUrl: string) => {
    onSelect(imageUrl);
    onClose();
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
      <div className="bg-surface rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-white/10 p-4 sm:p-6 flex justify-between items-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Customize Robot Appearance</h2>
          <button
            onClick={handleCancel}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-secondary hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        {showUploadTab && (
          <div className="flex border-b border-white/10 px-4 sm:px-6" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'presets'}
              onClick={() => setActiveTab('presets')}
              className={`min-h-[44px] px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'presets'
                  ? 'border-primary text-white'
                  : 'border-transparent text-secondary hover:text-white'
              }`}
            >
              Preset Images
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'upload'}
              onClick={() => setActiveTab('upload')}
              className={`min-h-[44px] px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'upload'
                  ? 'border-primary text-white'
                  : 'border-transparent text-secondary hover:text-white'
              }`}
            >
              Upload Custom Image
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'presets' ? (
            <>
              {/* Preview Section */}
              <div className="mb-8 bg-background rounded-lg p-4 sm:p-6">
                <h3 className="text-xl font-semibold mb-4 text-white">Preview</h3>
                <div className="flex items-center justify-center">
                  <div className="relative">
                    {selectedImageUrl ? (
                      <img
                        src={selectedImageUrl}
                        alt="Robot preview"
                        className="w-48 h-48 sm:w-64 sm:h-64 rounded-lg object-cover"
                        onError={() => handleImageError(selectedImageUrl)}
                      />
                    ) : (
                      <div className="w-48 h-48 sm:w-64 sm:h-64 bg-surface-elevated rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-6xl mb-2">🤖</div>
                          <div className="text-white font-semibold">No Image Selected</div>
                          <div className="text-sm text-secondary mt-2">
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
                  <div className="text-center py-8 text-secondary">
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
                        className={`min-h-[44px] p-3 rounded-lg border-2 transition-all ${
                          selectedImageUrl === image.url
                            ? 'border-blue-500 bg-blue-900 bg-opacity-30'
                            : 'border-gray-600 bg-surface-elevated hover:border-gray-500'
                        }`}
                      >
                        <div className="aspect-square bg-surface rounded overflow-hidden">
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
            </>
          ) : (
            /* Upload Tab */
            <UploadTab
              robotId={robotId!}
              onUploadComplete={handleUploadComplete}
            />
          )}
        </div>

        {/* Footer — only show for presets tab */}
        {activeTab === 'presets' && (
          <div className="sticky bottom-0 bg-surface border-t border-white/10 p-4 sm:p-6 flex justify-end gap-3">
            <button
              onClick={handleCancel}
              className="min-w-[44px] min-h-[44px] px-6 py-2 bg-surface-elevated hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedImageUrl}
              className={`min-w-[44px] min-h-[44px] px-6 py-2 rounded-lg transition-colors font-semibold ${
                selectedImageUrl
                  ? 'bg-primary hover:bg-blue-700 text-white'
                  : 'bg-gray-600 text-secondary cursor-not-allowed'
              }`}
            >
              {selectedImageUrl ? 'Apply Image' : 'Select an Image'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RobotImageSelector;
