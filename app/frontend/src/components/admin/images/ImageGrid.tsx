/**
 * Images in use, newest upload first: filter (All / Uploaded anyway), a
 * search on stable or robot name, and a grid of thumbnails. A thumbnail opens
 * the image's slide-over.
 */
import { useId } from 'react';
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import { AdminPagination } from '../shared';
import type { ImagesFilter, ImagesPage } from '../../../utils/adminImagesApi';
import { dayMonth, ownerLabel, robotsText } from '../../../utils/adminImagesFormat';
import { formatCount } from '../../../utils/adminDashboardFormat';

export interface ImageGridProps {
  data: ImagesPage | null;
  loading: boolean;
  filter: ImagesFilter;
  q: string;
  selectedId: number | null;
  onFilter: (filter: ImagesFilter) => void;
  onSearch: (q: string) => void;
  onPage: (page: number) => void;
  onOpen: (id: number) => void;
}

export function ImageGrid({ data, loading, filter, q, selectedId, onFilter, onSearch, onPage, onOpen }: ImageGridProps): ReactNode {
  const searchId = useId();
  const headingId = useId();
  const filters: { key: ImagesFilter; label: string }[] = [
    { key: 'all', label: `All${data ? ` · ${formatCount(data.counts.all)}` : ''}` },
    { key: 'anyway', label: `Uploaded anyway${data ? ` · ${formatCount(data.counts.anyway)}` : ''}` },
  ];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section aria-labelledby={headingId} aria-busy={loading || undefined} className="rounded-lg border border-white/10 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id={headingId} className="text-base font-semibold text-white">Images in use</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter images">
            {filters.map((option) => {
              const pressed = option.key === filter;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onFilter(option.key)}
                  className={`min-h-11 rounded-full border px-4 text-sm ${pressed ? 'border-primary bg-primary/15 text-primary' : 'border-white/10 bg-surface-elevated text-white hover:bg-white/10'} ${ADMIN_FOCUS_RING}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="w-full sm:w-64">
          <label htmlFor={searchId} className="sr-only">Search stable or robot</label>
          <input
            id={searchId}
            type="search"
            value={q}
            maxLength={50}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search stable or robot"
            className={`min-h-11 w-full rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white placeholder:text-secondary ${ADMIN_FOCUS_RING}`}
          />
        </div>
      </div>

      {!data ? (
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-square animate-pulse rounded-md bg-white/5 motion-reduce:animate-none" />)}
        </div>
      ) : data.images.length === 0 ? (
        <p className="px-5 py-6 text-sm text-secondary">
          {filter === 'anyway' ? 'No image in use was uploaded after a "not a robot" warning.' : q ? 'No image matches this search.' : 'No robot uses an uploaded image.'}
        </p>
      ) : (
        <>
          <p className="px-5 pt-3 text-xs text-secondary">Newest upload first. Click an image to open it.</p>
          <ul className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8" aria-label="Images in use">
            {data.images.map((tile) => (
              <li key={tile.id}>
                <button
                  type="button"
                  onClick={() => onOpen(tile.id)}
                  aria-label={`Image from ${ownerLabel(tile.owner)}, ${robotsText(tile.robotCount)}, uploaded ${dayMonth(tile.uploadedAt)}`}
                  className={`group block w-full rounded-md text-left ${selectedId === tile.id ? 'ring-2 ring-primary' : ''} ${ADMIN_FOCUS_RING}`}
                >
                  <span className="relative block aspect-square overflow-hidden rounded-md bg-surface-elevated">
                    <img src={tile.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform motion-reduce:transition-none group-hover:scale-105" />
                    {tile.uploadedAnyway && (
                      <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-warning">Uploaded anyway</span>
                    )}
                  </span>
                  <span className="mt-2 block truncate text-sm font-semibold text-white">{ownerLabel(tile.owner)}</span>
                  <span className="block truncate text-xs text-secondary">{robotsText(tile.robotCount)} · {dayMonth(tile.uploadedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          {data.total > data.pageSize && (
            <div className="border-t border-white/10 px-5 py-3">
              <AdminPagination page={data.page} totalPages={totalPages} total={data.total} pageSize={data.pageSize} loading={loading} noun="images" onPage={onPage} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
