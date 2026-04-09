import React, { useState, useEffect } from 'react';

interface FacilityIconProps {
  facilityType: string;
  facilityName: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

// Emoji fallbacks for when images are not available
const EMOJI_FALLBACKS: Record<string, string> = {
  training_facility: '🏋️',
  weapons_workshop: '🔧',
  repair_bay: '🔩',
  merchandising_hub: '💰',
  streaming_studio: '📺',
  roster_expansion: '🏭',
  storage_facility: '📦',
  combat_training_academy: '⚔️',
  defense_training_academy: '🛡️',
  mobility_training_academy: '🦿',
  ai_training_academy: '🤖',
  research_lab: '🔬',
  medical_bay: '⚕️',
  coaching_staff: '📋',
  booking_office: '🏆',
};

const SIZE_CLASSES = {
  small: 'w-12 h-12',
  medium: 'w-16 h-16',
  large: 'w-24 h-24',
};

const EMOJI_SIZE_CLASSES = {
  small: 'text-2xl',
  medium: 'text-4xl',
  large: 'text-6xl',
};

/**
 * FacilityIcon component that loads WebP images with SVG fallback
 * Falls back to emoji if images are not available
 * 
 * Uses dynamic import for Vite compatibility:
 * - Tries to load SVG from assets directory
 * - Falls back to emoji if SVG not found
 */
const FacilityIcon: React.FC<FacilityIconProps> = ({ 
  facilityType, 
  facilityName, 
  size = 'medium',
  className 
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  
  useEffect(() => {
    // Dynamically import the SVG file for this facility
    const loadImage = async () => {
      try {
        const svgModule = await import(`../assets/facilities/facility-${facilityType}-icon.svg`);
        setImageSrc(svgModule.default);
      } catch {
        // If import fails, we'll fall back to emoji
        setImageError(true);
      }
    };
    
    loadImage();
  }, [facilityType]);
  
  const emojiIcon = EMOJI_FALLBACKS[facilityType] || '❓';
  
  const sizeClass = SIZE_CLASSES[size];
  const emojiSizeClass = EMOJI_SIZE_CLASSES[size];
  
  // If image failed to load or not yet loaded, show emoji fallback
  if (imageError || !imageSrc) {
    return (
      <div 
        className={`${emojiSizeClass} flex items-center justify-center ${className || ''}`}
        title={facilityName}
        role="img"
        aria-label={facilityName}
      >
        {emojiIcon}
      </div>
    );
  }
  
  return (
    <img 
      src={imageSrc}
      alt={facilityName}
      className={`${sizeClass} object-contain ${className || ''}`}
      loading="lazy"
      onError={() => setImageError(true)}
      title={facilityName}
    />
  );
};

export default FacilityIcon;
