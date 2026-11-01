/**
 * URL state and text helpers of the admin Image Uploads page.
 */
import type { ImagesFilter } from './adminImagesApi';

export interface ImagesViewState {
  filter: ImagesFilter;
  q: string;
  page: number;
  /** Open image (slide-over), by inventory id. */
  image: number | null;
}

function positive(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

export function readImagesView(params: URLSearchParams): ImagesViewState {
  return {
    filter: params.get('filter') === 'anyway' ? 'anyway' : 'all',
    q: (params.get('q') ?? '').slice(0, 50),
    page: positive(params.get('page')) ?? 1,
    image: positive(params.get('image')),
  };
}

export function writeImagesView(params: URLSearchParams, patch: Partial<ImagesViewState>): URLSearchParams {
  const view = { ...readImagesView(params), ...patch };
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null): void => {
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
  };
  set('filter', view.filter === 'all' ? null : view.filter);
  set('q', view.q.trim() === '' ? null : view.q);
  set('page', view.page > 1 ? String(view.page) : null);
  set('image', view.image === null ? null : String(view.image));
  return next;
}

/** "3.3 MB", "38 KB", "512 B". */
export function bytesText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "28 Oct" (UTC). */
export function dayMonth(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "28 Oct 2026, 14:02 UTC". */
export function fullDateTime(iso: string): string {
  const date = new Date(iso);
  return `${dayMonth(iso)} ${date.getUTCFullYear()}, ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`;
}

export function ownerLabel(owner: { stableName: string | null; username: string | null; userId: number }): string {
  return owner.stableName ?? owner.username ?? `Deleted stable #${owner.userId}`;
}

export function robotsText(count: number): string {
  return `${count} ${count === 1 ? 'robot' : 'robots'}`;
}
