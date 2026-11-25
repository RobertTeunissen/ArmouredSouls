const BADGE_COLORS: Record<string, string> = {
  balance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  feature: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  bugfix: 'bg-red-500/20 text-red-400 border-red-500/30',
  economy: 'bg-green-500/20 text-green-400 border-green-500/30',
};

interface ChangelogCategoryBadgeProps {
  category: string;
  testId?: string;
}

/** Coloured category pill shared by the What's New page, its modal and the admin editor. */
function ChangelogCategoryBadge({ category, testId }: ChangelogCategoryBadgeProps) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-semibold border capitalize ${BADGE_COLORS[category] || ''}`}
      data-testid={testId}
    >
      {category}
    </span>
  );
}

export default ChangelogCategoryBadge;
