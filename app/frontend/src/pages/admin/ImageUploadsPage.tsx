/**
 * ImageUploadsPage — "Is every image on a robot acceptable?"
 * (`/admin/image-uploads`).
 *
 * Sections: six cards (in use, saved but unused, uploads this season, NSFW
 * blocks, uploaded anyway, disk), uploads per week this season, moderation
 * outcomes of the last 30 days, the images in use (newest first, filter and
 * search in the URL), the image slide-over (`?image=`) with "Remove image",
 * and storage (orphan files, missing files, preview and clean up).
 * Data: `GET /api/admin/images/overview`, `GET /api/admin/images`,
 * `GET /api/admin/images/:id`, `DELETE /api/admin/images/:id`,
 * `GET|POST /api/admin/images/cleanup`.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Image Uploads.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ADMIN_FOCUS_RING, AdminPageHeader, PanelError, PanelSkeleton } from '../../components/admin/shared';
import { ImageDetailPanel, ImageGrid, ImageStatCards, ModerationSummary, StoragePanel, UploadsPerWeek } from '../../components/admin/images';
import { apiErrorMessage } from '../../utils/ApiError';
import { useApiQuery } from '../../hooks/useApiQuery';
import { getImagesInUse, getImagesOverview } from '../../utils/adminImagesApi';
import { readImagesView, writeImagesView, type ImagesViewState } from '../../utils/adminImagesFormat';
import { formatUtcTime } from '../../utils/adminDashboardFormat';

/** Search is debounced so typing does not fire a request per key. */
const SEARCH_DEBOUNCE_MS = 300;


function ImageUploadsPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const view = readImagesView(params);
  const [searchText, setSearchText] = useState(view.q);
  const [notice, setNotice] = useState<string | null>(null);

  const update = useCallback((patch: Partial<ImagesViewState>): void => {
    setParams((current) => writeImagesView(current, patch), { replace: true });
  }, [setParams]);

  const overviewQuery = useApiQuery((signal) => getImagesOverview(signal), []);
  const overview = overviewQuery.data;
  const overviewError = apiErrorMessage(overviewQuery.error, 'Could not load the image overview.');
  const { filter, q, page } = view;
  const imagesQuery = useApiQuery((signal) => getImagesInUse(filter, q, page, signal), [filter, q, page]);
  const images = imagesQuery.data;
  const imagesLoading = imagesQuery.loading;
  const imagesError = apiErrorMessage(imagesQuery.error, 'Could not load the images.');
  // Debounce the search box into the URL.
  useEffect(() => {
    if (searchText === q) return undefined;
    const timer = setTimeout(() => update({ q: searchText, page: 1 }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, q, update]);

  const refresh = (): void => {
    overviewQuery.refetch();
    imagesQuery.refetch();
  };

  return (
    <div data-testid="image-uploads-page" className="space-y-6">
      <AdminPageHeader
        title="Image Uploads"
        subtitle="Is every image on a robot acceptable?"
        actions={(
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
              {overview ? `Last updated ${formatUtcTime(overview.generatedAt, true)}` : ''}
            </span>
            <button
              type="button"
              onClick={refresh}
              className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 ${ADMIN_FOCUS_RING}`}
            >
              <span aria-hidden="true">↻ </span>Refresh
            </button>
          </div>
        )}
      />

      {notice && (
        <p role="status" className="flex items-start justify-between gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-white">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className={`text-xs text-secondary hover:text-white ${ADMIN_FOCUS_RING}`}>Dismiss</button>
        </p>
      )}

      {overviewError && (
        <div className="rounded-lg border border-white/10 bg-surface">
          <PanelError message={overviewError} onRetry={refresh} />
        </div>
      )}

      {!overview && !overviewError && <div className="rounded-lg border border-white/10 bg-surface"><PanelSkeleton rows={4} /></div>}

      {overview && (
        <>
          <ImageStatCards overview={overview} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <UploadsPerWeek overview={overview} />
            <ModerationSummary overview={overview} />
          </div>
        </>
      )}

      {imagesError && (
        <div className="rounded-lg border border-white/10 bg-surface">
          <PanelError message={imagesError} onRetry={refresh} />
        </div>
      )}

      <ImageGrid
        data={images}
        loading={imagesLoading}
        filter={view.filter}
        q={searchText}
        selectedId={view.image}
        onFilter={(next) => update({ filter: next, page: 1 })}
        onSearch={setSearchText}
        onPage={(next) => update({ page: next })}
        onOpen={(id) => update({ image: id })}
      />

      {overview && <StoragePanel overview={overview} onCleaned={refresh} />}

      <ImageDetailPanel
        imageId={view.image}
        onClose={() => update({ image: null })}
        onRemoved={(message) => {
          setNotice(message);
          update({ image: null });
          refresh();
        }}
      />
    </div>
  );
}

export default ImageUploadsPage;
