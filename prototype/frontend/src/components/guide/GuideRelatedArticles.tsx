import React from 'react';
import { Link } from 'react-router-dom';
import { RelatedArticleLink } from '../../utils/guideApi';

interface GuideRelatedArticlesProps {
  relatedArticles: RelatedArticleLink[];
}

const GuideRelatedArticles: React.FC<GuideRelatedArticlesProps> = ({ relatedArticles }) => {
  if (relatedArticles.length === 0) {
    return null;
  }

  return (
    <div className="mt-10 pt-6 border-t border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Related Articles</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {relatedArticles.slice(0, 5).map((article) => (
          <Link
            key={`${article.sectionSlug}/${article.slug}`}
            to={`/guide/${article.sectionSlug}/${article.slug}`}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <span className="text-primary">→</span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{article.title}</div>
              <div className="text-xs text-gray-500">{article.sectionTitle}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default GuideRelatedArticles;
