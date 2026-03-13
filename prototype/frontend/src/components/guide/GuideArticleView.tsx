import React from 'react';
import { Link } from 'react-router-dom';
import { GuideArticle } from '../../utils/guideApi';
import GuideBreadcrumb from './GuideBreadcrumb';
import GuideTableOfContents from './GuideTableOfContents';
import ContentRenderer from './ContentRenderer';
import GuideRelatedArticles from './GuideRelatedArticles';

interface GuideArticleViewProps {
  article: GuideArticle;
}

const GuideArticleView: React.FC<GuideArticleViewProps> = ({ article }) => {
  return (
    <div className="flex gap-6">
      {/* Main content area */}
      <div className="flex-1 min-w-0">
        <GuideBreadcrumb
          sectionSlug={article.sectionSlug}
          sectionTitle={article.sectionTitle}
          articleTitle={article.title}
        />

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{article.title}</h1>
        <p className="text-sm text-gray-500 mb-6">
          Last updated: {new Date(article.lastUpdated).toLocaleDateString()}
        </p>

        <ContentRenderer content={article.body} />

        <GuideRelatedArticles relatedArticles={article.relatedArticles} />

        {/* Previous / Next navigation */}
        <div className="mt-10 pt-6 border-t border-gray-700 flex flex-col sm:flex-row justify-between gap-3">
          {article.previousArticle ? (
            <Link
              to={`/guide/${article.previousArticle.sectionSlug}/${article.previousArticle.slug}`}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors min-w-0"
            >
              <span className="flex-shrink-0">←</span>
              <span>{article.previousArticle.title}</span>
            </Link>
          ) : (
            <div />
          )}
          {article.nextArticle ? (
            <Link
              to={`/guide/${article.nextArticle.sectionSlug}/${article.nextArticle.slug}`}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors min-w-0 sm:text-right"
            >
              <span>{article.nextArticle.title}</span>
              <span className="flex-shrink-0">→</span>
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>

      {/* Table of Contents sidebar — hidden below lg to avoid squeezing article content */}
      <GuideTableOfContents headings={article.headings} />
    </div>
  );
};

export default GuideArticleView;
