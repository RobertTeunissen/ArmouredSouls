import React from 'react';
import { Link } from 'react-router-dom';
import { GuideSection } from '../../utils/guideApi';

interface GuideLandingPageProps {
  sections: GuideSection[];
}

const SECTION_ICONS: Record<string, string> = {
  'getting-started': '🚀',
  'robots': '🤖',
  'combat': '⚔️',
  'weapons': '🔫',
  'leagues': '🏆',
  'tournaments': '🎖️',
  'economy': '💰',
  'facilities': '🏭',
  'prestige-fame': '⭐',
  'strategy': '🧠',
  'integrations': '🔗',
};

const GuideLandingPage: React.FC<GuideLandingPageProps> = ({ sections }) => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Game Guide</h1>
        <p className="text-secondary">
          Everything you need to know about Armoured Souls. Browse sections below or use search to find specific topics.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <Link
            key={section.slug}
            to={`/guide/${section.slug}`}
            className="block p-5 rounded-lg border border-white/10 bg-surface-elevated hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{SECTION_ICONS[section.slug] || '📖'}</span>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-white group-hover:text-primary transition-colors">
                  {section.title}
                </h2>
                {section.description && (
                  <p className="text-sm text-secondary mt-1 line-clamp-2">
                    {section.description}
                  </p>
                )}
                <p className="text-xs text-tertiary mt-2">
                  {section.articles.length} {section.articles.length === 1 ? 'article' : 'articles'}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default GuideLandingPage;
