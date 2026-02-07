import React, { useState } from 'react';

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
  income_generator: '💰',
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
 * Uses HTML <picture> element for automatic format detection:
 * - Modern browsers load WebP for optimal quality
 * - Older browsers automatically fallback to SVG
 * - If both fail, displays emoji icon
 */
const FacilityIcon: React.FC<FacilityIconProps> = ({ 
  facilityType, 
  facilityName, 
  size = 'medium',
  className 
}) => {
  const [imageError, setImageError] = useState(false);
  
  // Construct image paths
  const webpPath = `/assets/facilities/facility-${facilityType}-icon.webp`;
  const svgPath = `/assets/facilities/facility-${facilityType}-icon.svg`;
  const emojiIcon = EMOJI_FALLBACKS[facilityType] || '❓';
  
  const sizeClass = SIZE_CLASSES[size];
  const emojiSizeClass = EMOJI_SIZE_CLASSES[size];
  
  // If image failed to load, show emoji fallback
  if (imageError) {
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
    <picture className={className || ''}>
      {/* Try WebP first - modern browsers with best quality */}
      <source srcSet={webpPath} type="image/webp" />
      
      {/* Fallback to SVG - universal compatibility */}
      <img 
        src={svgPath}
        alt={facilityName}
        className={`${sizeClass} object-contain`}
        loading="lazy"
        onError={() => setImageError(true)}
        title={facilityName}
      />
    </picture>
  );
};

export default FacilityIcon;
