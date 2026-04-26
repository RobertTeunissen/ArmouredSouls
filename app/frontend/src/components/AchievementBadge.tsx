import { getTierColor } from '../utils/achievementUtils';
import { getAchievementImageUrl } from '../utils/achievementImages';

interface AchievementBadgeProps {
  tier: string;
  badgeIconFile?: string;
  size?: 64 | 128 | 48;
  locked?: boolean;
  secret?: boolean;
  className?: string;
}

// CSS polygon matching the SVG hexagon points (normalized to 0–100%)
const HEX_CLIP = 'polygon(50% 3%, 94% 27%, 94% 73%, 50% 97%, 6% 73%, 6% 27%)';

export default function AchievementBadge({
  tier,
  badgeIconFile,
  size = 64,
  locked = false,
  secret = false,
  className = '',
}: AchievementBadgeProps) {
  const tierColor = locked ? '#57606a' : getTierColor(tier);
  const sizeClass = size === 128 ? 'w-32 h-32' : size === 48 ? 'w-12 h-12' : 'w-16 h-16';
  const imageUrl = badgeIconFile ? getAchievementImageUrl(badgeIconFile, size <= 64 ? 64 : 128) : undefined;

  // Secret + locked: generic "???" placeholder badge with purple border
  if (secret && locked) {
    return (
      <div className={`${sizeClass} relative flex items-center justify-center ${className}`}>
        <svg viewBox="0 0 128 128" className="w-full h-full">
          <polygon
            points="64,4 120,34 120,94 64,124 8,94 8,34"
            fill="#1a1f29"
            stroke="#a371f7"
            strokeWidth="4"
          />
          <text x="64" y="72" textAnchor="middle" fill="#a371f7" fontSize="36" fontWeight="bold">
            ???
          </text>
          <circle cx="64" cy="118" r="4" fill="#a371f7" />
        </svg>
      </div>
    );
  }

  // Has an actual image — render as HTML img with CSS hex clip
  if (imageUrl) {
    return (
      <div
        className={`${sizeClass} relative ${locked ? 'achievement-badge--locked' : 'achievement-badge--unlocked'} ${className}`}
      >
        {/* Hex border ring (SVG behind the image) */}
        <svg viewBox="0 0 128 128" className="absolute inset-0 w-full h-full">
          <polygon
            points="64,4 120,34 120,94 64,124 8,94 8,34"
            fill="#1a1f29"
            stroke={tierColor}
            strokeWidth="4"
          />
          <circle cx="64" cy="118" r="4" fill={tierColor} />
        </svg>
        {/* Badge image clipped to hexagon */}
        <img
          src={imageUrl}
          alt={badgeIconFile ?? 'achievement badge'}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ clipPath: HEX_CLIP }}
          loading="lazy"
        />
        {/* Border overlay on top of image */}
        <svg viewBox="0 0 128 128" className="absolute inset-0 w-full h-full pointer-events-none">
          <polygon
            points="64,4 120,34 120,94 64,124 8,94 8,34"
            fill="none"
            stroke={tierColor}
            strokeWidth="4"
          />
          <circle cx="64" cy="118" r="4" fill={tierColor} />
        </svg>
      </div>
    );
  }

  // Fallback: text placeholder when no image exists
  return (
    <div
      className={`${sizeClass} relative ${locked ? 'achievement-badge--locked' : 'achievement-badge--unlocked'} ${className}`}
    >
      <svg viewBox="0 0 128 128" className="w-full h-full">
        <polygon
          points="64,4 120,34 120,94 64,124 8,94 8,34"
          fill="#1a1f29"
          stroke={tierColor}
          strokeWidth="4"
        />
        <text x="64" y="72" textAnchor="middle" fill={tierColor} fontSize="24" fontWeight="bold">
          {badgeIconFile?.replace('achievement-', '').toUpperCase() || '?'}
        </text>
        <circle cx="64" cy="118" r="4" fill={tierColor} />
      </svg>
      {!locked && (
        <div
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `inset 0 0 8px ${tierColor}33` }}
        />
      )}
    </div>
  );
}
