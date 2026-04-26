import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AchievementBadge from './AchievementBadge';
import type { UnlockedAchievement } from '../utils/achievementUtils';

interface AchievementToastProps {
  achievement: UnlockedAchievement;
  onDismiss: () => void;
}

export default function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in on next frame
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      onClick={() => navigate('/achievements')}
      className={`flex items-center gap-3 bg-surface border border-white/20 rounded-lg p-3 shadow-xl cursor-pointer transition-all duration-300 ease-out motion-reduce:transition-none ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      style={{ minWidth: 0 }}
    >
      <AchievementBadge
        tier={achievement.tier}
        badgeIconFile={achievement.badgeIconFile}
        size={48}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">🏆 {achievement.name}</p>
        <p className="text-xs text-secondary truncate">{achievement.description}</p>
        <p className="text-xs text-success">
          +₡{achievement.rewardCredits.toLocaleString()} +{achievement.rewardPrestige} prestige
        </p>
      </div>
    </div>
  );
}
