import React, { useState, useCallback } from 'react';
import { useApiQuery } from '../hooks/useApiQuery';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { fetchGuideSections, fetchGuideArticle } from '../utils/guideApi';
import GuideNavigation from '../components/guide/GuideNavigation';
import GuideSearch from '../components/guide/GuideSearch';
import GuideLandingPage from '../components/guide/GuideLandingPage';
import GuideArticleView from '../components/guide/GuideArticleView';
import GuideBreadcrumb from '../components/guide/GuideBreadcrumb';
import { ApiError } from '../utils/ApiError';
import type { GuideArticle, GuideSection } from '@shared/types';

type ErrorState = {
  type: 'not-found' | 'server-error' | 'network-error';
  message: string;
} | null;

/**
 * `api` rejects with an ApiError (statusCode 0 for a network failure), never
 * an axios error, so a missing article must not read as "offline".
 */
function classifyArticleError(err: unknown): ErrorState {
  if (!err) return null;
  const status = err instanceof ApiError ? err.statusCode : undefined;
  if (status === 404) return { type: 'not-found', message: 'Article not found' };
  if (status && status >= 500) return { type: 'server-error', message: 'Something went wrong' };
  return { type: 'network-error', message: 'Unable to load content. Check your connection.' };
}

function GuidePage(): React.ReactElement {
  const { sectionSlug, articleSlug } = useParams<{
    sectionSlug?: string;
    articleSlug?: string;
  }>();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sectionsQuery = useApiQuery(() => fetchGuideSections(), []);
  const wantsArticle = Boolean(sectionSlug && articleSlug);
  const articleKey = `${sectionSlug}/${articleSlug}`;
  const articleQuery = useApiQuery(
    async () => ({ key: articleKey, article: await fetchGuideArticle(sectionSlug!, articleSlug!) }),
    [articleKey, sectionSlug, articleSlug],
    { enabled: wantsArticle },
  );

  const sections: GuideSection[] = sectionsQuery.data ?? [];
  // Never show the previous article under a new address.
  const article: GuideArticle | null =
    wantsArticle && articleQuery.data?.key === articleKey ? articleQuery.data.article : null;
  const articleError = wantsArticle ? classifyArticleError(articleQuery.error) : null;
  const sectionsError: ErrorState = sectionsQuery.error && sections.length === 0
    ? { type: 'network-error', message: 'Unable to load guide. Check your connection.' }
    : null;
  const error: ErrorState = articleError ?? sectionsError;
  const loading = sectionsQuery.loading || (wantsArticle && articleQuery.loading);
  const isOffline = Boolean(sectionsQuery.error) || articleError?.type === 'network-error';
  const handleRetry = articleQuery.refetch;

  const handleSearchSelect = useCallback(
    (secSlug: string, artSlug: string): void => {
      navigate(`/guide/${secSlug}/${artSlug}`);
      setSidebarOpen(false);
    },
    [navigate]
  );

  // Find current section for section-only view
  const currentSection = sections.find((s) => s.slug === sectionSlug);

  const renderContent = (): React.ReactNode => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-secondary">Loading...</div>
        </div>
      );
    }

    if (error) {
      return renderError();
    }

    // Article view
    if (sectionSlug && articleSlug && article) {
      return <GuideArticleView article={article} />;
    }

    // Section view — show articles list for the section
    if (sectionSlug && currentSection) {
      return (
        <div>
          <GuideBreadcrumb sectionSlug={sectionSlug} sectionTitle={currentSection.title} />
          <h1 className="text-3xl font-bold text-white mb-6">{currentSection.title}</h1>
          <div className="space-y-3">
            {currentSection.articles.map((art) => (
              <Link
                key={art.slug}
                to={`/guide/${sectionSlug}/${art.slug}`}
                className="block w-full text-left p-4 rounded-lg border border-white/10 bg-surface-elevated hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <h3 className="text-white font-medium">{art.title}</h3>
                <p className="text-sm text-secondary mt-1">{art.description}</p>
              </Link>
            ))}
          </div>
        </div>
      );
    }

    // Landing page
    return <GuideLandingPage sections={sections} />;
  };

  const renderError = (): React.ReactNode => {
    if (!error) return null;

    switch (error.type) {
      case 'not-found':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-white mb-2">Article not found</h2>
            <p className="text-secondary mb-6">The article you're looking for doesn't exist or has been moved.</p>
            <Link
              to="/guide"
              className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Back to Guide
            </Link>
          </div>
        );
      case 'server-error':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-secondary mb-6">We couldn't load this content. Please try again.</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        );
      case 'network-error':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-white mb-2">Connection Error</h2>
            <p className="text-secondary mb-6">{error.message}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-white">

      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Sidebar navigation */}
        <GuideNavigation
          sections={sections}
          currentSectionSlug={sectionSlug}
          currentArticleSlug={articleSlug}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main content */}
        <main className="flex-1 w-full px-4 sm:px-6 md:px-8 py-6 pb-24 lg:pb-6 max-w-4xl min-w-0">
          {/* Offline indicator */}
          {isOffline && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>Offline — showing cached content</span>
            </div>
          )}

          {/* Mobile menu toggle + search */}
          <div className="md:hidden flex items-center gap-3 mb-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="px-3 py-2 rounded-lg border border-white/10 text-secondary hover:text-white hover:border-gray-500 transition-colors text-sm"
              aria-label="Open guide navigation"
            >
              ☰ Menu
            </button>
            <div className="flex-1">
              <GuideSearch onResultSelect={handleSearchSelect} />
            </div>
          </div>

          {/* Desktop search */}
          <div className="hidden md:block mb-6">
            <GuideSearch onResultSelect={handleSearchSelect} />
          </div>

          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default GuidePage;
