import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  GuideSection,
  GuideArticle,
  fetchGuideSections,
  fetchGuideArticle,
} from '../utils/guideApi';
import Navigation from '../components/Navigation';
import GuideNavigation from '../components/guide/GuideNavigation';
import GuideSearch from '../components/guide/GuideSearch';
import GuideLandingPage from '../components/guide/GuideLandingPage';
import GuideArticleView from '../components/guide/GuideArticleView';
import GuideBreadcrumb from '../components/guide/GuideBreadcrumb';

type ErrorState = {
  type: 'not-found' | 'server-error' | 'network-error';
  message: string;
} | null;

function GuidePage(): React.ReactElement {
  const { sectionSlug, articleSlug } = useParams<{
    sectionSlug?: string;
    articleSlug?: string;
  }>();
  const navigate = useNavigate();

  const [sections, setSections] = useState<GuideSection[]>([]);
  const [cachedSections, setCachedSections] = useState<GuideSection[]>([]);
  const [article, setArticle] = useState<GuideArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorState>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Fetch sections on mount
  useEffect(() => {
    let cancelled = false;
    const loadSections = async (): Promise<void> => {
      try {
        const data = await fetchGuideSections();
        if (!cancelled) {
          setSections(data);
          setCachedSections(data);
          setIsOffline(false);
        }
      } catch {
        if (!cancelled) {
          setIsOffline(true);
          // Use cached sections if available
          if (cachedSections.length === 0) {
            setError({ type: 'network-error', message: 'Unable to load guide. Check your connection.' });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadSections();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch article when slug params change
  useEffect(() => {
    if (!sectionSlug || !articleSlug) {
      setArticle(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const loadArticle = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchGuideArticle(sectionSlug, articleSlug);
        if (!cancelled) {
          setArticle(data);
          setIsOffline(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 404) {
            setError({ type: 'not-found', message: 'Article not found' });
          } else if (status && status >= 500) {
            setError({ type: 'server-error', message: 'Something went wrong' });
          } else {
            setIsOffline(true);
            setError({ type: 'network-error', message: 'Unable to load content. Check your connection.' });
          }
          setArticle(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadArticle();
    return () => { cancelled = true; };
  }, [sectionSlug, articleSlug]);

  const handleRetry = useCallback((): void => {
    if (sectionSlug && articleSlug) {
      setError(null);
      setLoading(true);
      fetchGuideArticle(sectionSlug, articleSlug)
        .then((data) => {
          setArticle(data);
          setIsOffline(false);
        })
        .catch(() => {
          setError({ type: 'server-error', message: 'Something went wrong' });
        })
        .finally(() => setLoading(false));
    }
  }, [sectionSlug, articleSlug]);

  const handleSearchSelect = useCallback(
    (secSlug: string, artSlug: string): void => {
      navigate(`/guide/${secSlug}/${artSlug}`);
      setSidebarOpen(false);
    },
    [navigate]
  );

  // Find current section for section-only view
  const currentSection = sections.find((s) => s.slug === sectionSlug) ||
    cachedSections.find((s) => s.slug === sectionSlug);

  const displaySections = sections.length > 0 ? sections : cachedSections;

  const renderContent = (): React.ReactNode => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400">Loading...</div>
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
              <button
                key={art.slug}
                onClick={() => navigate(`/guide/${sectionSlug}/${art.slug}`)}
                className="w-full text-left p-4 rounded-lg border border-gray-700 bg-surface-elevated hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <h3 className="text-white font-medium">{art.title}</h3>
                <p className="text-sm text-gray-400 mt-1">{art.description}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Landing page
    return <GuideLandingPage sections={displaySections} />;
  };

  const renderError = (): React.ReactNode => {
    if (!error) return null;

    switch (error.type) {
      case 'not-found':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-white mb-2">Article not found</h2>
            <p className="text-gray-400 mb-6">The article you're looking for doesn't exist or has been moved.</p>
            <button
              onClick={() => navigate('/guide')}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Back to Guide
            </button>
          </div>
        );
      case 'server-error':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-6">We couldn't load this content. Please try again.</p>
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
            <p className="text-gray-400 mb-6">{error.message}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Sidebar navigation */}
        <GuideNavigation
          sections={displaySections}
          currentSectionSlug={sectionSlug}
          currentArticleSlug={articleSlug}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main content */}
        <main className="flex-1 w-full px-4 sm:px-6 md:px-8 py-6 max-w-4xl min-w-0">
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
              className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors text-sm"
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
