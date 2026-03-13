import React from 'react';
import { Link } from 'react-router-dom';
import { GuideSection } from '../../utils/guideApi';

interface GuideNavigationProps {
  sections: GuideSection[];
  currentSectionSlug?: string;
  currentArticleSlug?: string;
  isOpen: boolean;
  onToggle: () => void;
}

interface SectionItemProps {
  section: GuideSection;
  isCurrentSection: boolean;
  currentArticleSlug?: string;
}

function SectionItem({ section, isCurrentSection, currentArticleSlug }: SectionItemProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(isCurrentSection);

  React.useEffect(() => {
    if (isCurrentSection) {
      setExpanded(true);
    }
  }, [isCurrentSection]);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isCurrentSection
            ? 'text-primary bg-primary/10'
            : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}
        aria-expanded={expanded}
      >
        <Link
          to={`/guide/${section.slug}`}
          className="flex-1 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {section.title}
        </Link>
        <span className={`ml-2 transition-transform text-xs ${expanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </button>

      {expanded && section.articles.length > 0 && (
        <div className="ml-3 mt-1 space-y-0.5 border-l border-gray-700 pl-3">
          {section.articles.map((article) => {
            const isActive = isCurrentSection && currentArticleSlug === article.slug;
            return (
              <Link
                key={article.slug}
                to={`/guide/${section.slug}/${article.slug}`}
                className={`block px-2 py-1.5 rounded text-sm transition-colors ${
                  isActive
                    ? 'text-primary bg-primary/15 font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {article.title}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const GuideNavigation: React.FC<GuideNavigationProps> = ({
  sections,
  currentSectionSlug,
  currentArticleSlug,
  isOpen,
  onToggle,
}) => {
  const navContent = (
    <nav className="py-4 space-y-1" aria-label="Guide navigation">
      {sections.map((section) => (
        <SectionItem
          key={section.slug}
          section={section}
          isCurrentSection={currentSectionSlug === section.slug}
          currentArticleSlug={currentArticleSlug}
        />
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 flex-shrink-0 overflow-y-auto border-r border-gray-700 bg-surface-elevated px-2">
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={onToggle}
            aria-hidden="true"
          />
          <aside className="md:hidden fixed top-0 left-0 bottom-0 w-72 bg-surface-elevated z-50 overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Guide</h2>
              <button
                onClick={onToggle}
                className="text-gray-400 hover:text-white p-1"
                aria-label="Close navigation"
              >
                ✕
              </button>
            </div>
            <div className="px-2">
              {navContent}
            </div>
          </aside>
        </>
      )}
    </>
  );
};

export default GuideNavigation;
