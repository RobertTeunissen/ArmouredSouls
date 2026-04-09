import React from 'react';
import { Link } from 'react-router-dom';

interface GuideBreadcrumbProps {
  sectionSlug?: string;
  sectionTitle?: string;
  articleTitle?: string;
}

const GuideBreadcrumb: React.FC<GuideBreadcrumbProps> = ({
  sectionSlug,
  sectionTitle,
  articleTitle,
}) => {
  return (
    <nav className="flex items-center text-sm text-secondary mb-4 min-w-0 flex-wrap gap-y-1" aria-label="Breadcrumb">
      <Link to="/guide" className="hover:text-white transition-colors flex-shrink-0">
        Guide
      </Link>

      {sectionSlug && sectionTitle && (
        <>
          <span className="mx-2 flex-shrink-0">›</span>
          {articleTitle ? (
            <Link
              to={`/guide/${sectionSlug}`}
              className="hover:text-white transition-colors flex-shrink-0"
            >
              {sectionTitle}
            </Link>
          ) : (
            <span className="text-gray-200">{sectionTitle}</span>
          )}
        </>
      )}

      {articleTitle && (
        <>
          <span className="mx-2 flex-shrink-0">›</span>
          <span className="text-gray-200">{articleTitle}</span>
        </>
      )}
    </nav>
  );
};

export default GuideBreadcrumb;
