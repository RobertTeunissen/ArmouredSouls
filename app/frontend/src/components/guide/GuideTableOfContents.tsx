import React from 'react';
import { ArticleHeading } from '../../utils/guideApi';

interface GuideTableOfContentsProps {
  headings: ArticleHeading[];
}

const GuideTableOfContents: React.FC<GuideTableOfContentsProps> = ({ headings }) => {
  if (headings.length <= 3) {
    return null;
  }

  return (
    <div className="sticky top-20 hidden lg:block w-56 flex-shrink-0 pl-6">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary mb-3">
        On this page
      </h4>
      <nav className="space-y-1" aria-label="Table of contents">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={`block text-sm transition-colors hover:text-white ${
              heading.level === 3 ? 'pl-4 text-tertiary' : 'text-secondary'
            }`}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </div>
  );
};

export default GuideTableOfContents;
