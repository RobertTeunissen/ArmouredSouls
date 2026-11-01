/**
 * ImageUploadsPage: cards, uploads per week, moderation summary, the image
 * grid (filter, debounced search, open), the slide-over (scores, Remove image
 * with reason and confirmation) and storage (Preview cleanup, Clean up).
 * Every button is exercised.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ImageUploadsPage from '../ImageUploadsPage';
import type { CleanupPreview, ImageDetail, ImagesOverview, ImagesPage, ImageTile } from '../../../utils/adminImagesApi';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

const OVERVIEW: ImagesOverview = {
  generatedAt: '2026-11-01T12:00:00.000Z',
  inUse: { images: 62, robots: 73, stables: 20 },
  savedNotInUse: 10,
  season: {
    number: 1, startedAt: '2026-07-29T14:33:00.000Z', uploads: 43, firstWeekUploads: 18,
    weeks: [{ start: '2026-07-27T00:00:00.000Z', uploads: 18 }, { start: '2026-08-03T00:00:00.000Z', uploads: 2 }],
  },
  moderation: { windowDays: 30, saved: 2, blocked: 0, warned: 1, uploadedAnyway: 1, gaveUp: 0, filterOffline: 0 },
  storage: { files: 72, bytes: 3_460_000, orphanFiles: 0, missing: { robots: 0, archived: 30 } },
};

function tile(id: number, overrides: Partial<ImageTile> = {}): ImageTile {
  return {
    id, imageUrl: `/uploads/user-robots/3/${id}.webp`,
    owner: { userId: 3, stableName: `Stable ${id}`, username: `player_${id}`, stableType: 'human' },
    robotCount: 1, robotNames: [`Robot ${id}`], uploadedAt: '2026-10-28T14:02:00.000Z', uploadedAnyway: false,
    ...overrides,
  };
}

const ALL: ImageTile[] = [tile(1, { robotCount: 2, robotNames: ['Iron Warden', 'Iron Warden II'], uploadedAnyway: true }), tile(2), tile(3)];

function page(images: ImageTile[]): ImagesPage {
  return { images, total: images.length, page: 1, pageSize: 24, counts: { all: ALL.length, anyway: 1 } };
}

const DETAIL: ImageDetail = {
  id: 1, imageUrl: '/uploads/user-robots/3/1.webp',
  owner: { userId: 3, stableName: 'Stable 1', username: 'player_1', stableType: 'human' },
  uploadedAt: '2026-10-28T14:02:00.000Z', fileSize: 38_000, uploadedAnyway: true,
  robots: [{ id: 10, name: 'Iron Warden' }, { id: 11, name: 'Iron Warden II' }],
  archivedSeasons: [0], library: { saved: 1, limit: 20 },
  moderation: { scores: { neutral: 0.62, drawing: 0.31, sexy: 0.04, hentai: 0.02, porn: 0.01 }, robotLikenessScore: 0.93 },
  thresholds: { nsfw: { porn: 0.3, hentai: 0.3, sexy: 0.5 }, robotLikeness: 0.6 },
};

const PREVIEW: CleanupPreview = {
  orphanFiles: [], orphanCount: 0, orphanBytes: 0,
  missing: { robots: 0, archived: 30, paths: ['/uploads/user-robots/9/gone.webp'] },
};

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
  mockGet.mockImplementation(async (url: string, config?: { params?: { filter?: string; q?: string } }) => {
    if (url === '/api/admin/images/overview') return { data: OVERVIEW };
    if (url === '/api/admin/images') {
      const q = config?.params?.q ?? '';
      const filtered = ALL.filter((t) => (config?.params?.filter === 'anyway' ? t.uploadedAnyway : true) && (q === '' || t.robotNames.some((n) => n.toLowerCase().includes(q.toLowerCase()))));
      return { data: page(filtered) };
    }
    if (url === '/api/admin/images/1') return { data: DETAIL };
    if (url === '/api/admin/images/cleanup') return { data: PREVIEW };
    throw new Error(`unexpected GET ${url}`);
  });
});

function LocationProbe(): React.ReactElement {
  return <output data-testid="location">{useLocation().search}</output>;
}
const search = (): URLSearchParams => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

function renderPage(path = '/admin/image-uploads') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/image-uploads" element={<><ImageUploadsPage /><LocationProbe /></>} />
        <Route path="/admin/players" element={<p>players page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const grid = (): HTMLElement => screen.getByRole('region', { name: 'Images in use' });

describe('ImageUploadsPage', () => {
  it('shows the cards, the weekly chart and the moderation summary', async () => {
    renderPage();
    expect(await screen.findByTestId('image-card-in-use')).toHaveTextContent('In use62images on 73 robots · 20 stables');
    expect(screen.getByTestId('image-card-season')).toHaveTextContent('18 in the first week');
    expect(screen.getByTestId('image-card-disk')).toHaveTextContent('3.3 MB72 files');
    expect(screen.getByRole('img', { name: 'Uploads per week, oldest first: 27 Jul 18, 3 Aug 2' })).toBeInTheDocument();
    const moderation = screen.getByRole('region', { name: 'Moderation, last 30 days' });
    expect(within(moderation).getByText('then uploaded anyway').nextSibling).toHaveTextContent('1');
  });

  it('lists images in use, newest first, and filters to "Uploaded anyway"', async () => {
    const user = userEvent.setup();
    renderPage();
    const list = await within(await screen.findByRole('region', { name: 'Images in use' })).findByRole('list', { name: 'Images in use' });
    expect(within(list).getAllByRole('button')).toHaveLength(3);
    expect(within(list).getByRole('button', { name: 'Image from Stable 1, 2 robots, uploaded 28 Oct' })).toHaveTextContent('Uploaded anyway');

    await user.click(within(grid()).getByRole('button', { name: 'Uploaded anyway · 1' }));
    await waitFor(() => expect(within(grid()).getAllByRole('button', { name: /^Image from/ })).toHaveLength(1));
    expect(search().get('filter')).toBe('anyway');
  });

  it('debounces the search into the URL and the request', async () => {
    const user = userEvent.setup();
    renderPage();
    await within(grid()).findAllByRole('button', { name: /^Image from/ });
    await user.type(within(grid()).getByRole('searchbox', { name: 'Search stable or robot' }), 'warden');
    await waitFor(() => expect(search().get('q')).toBe('warden'));
    await waitFor(() => expect(within(grid()).getAllByRole('button', { name: /^Image from/ })).toHaveLength(1));
    const searchCalls = mockGet.mock.calls.filter(([url, config]) => url === '/api/admin/images' && (config as { params: { q: string } }).params.q !== '');
    expect(searchCalls).toHaveLength(1);
  });

  it('opens an image with its scores and thresholds', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await within(grid()).findByRole('button', { name: /^Image from Stable 1/ }));
    const panel = await screen.findByRole('dialog', { name: 'Image from Stable 1' });
    expect(search().get('image')).toBe('1');
    expect(within(panel).getByText('Iron Warden, Iron Warden II')).toBeInTheDocument();
    expect(within(panel).getByText('Season 0')).toBeInTheDocument();
    expect(within(panel).getByText('Passed')).toBeInTheDocument();
    expect(within(panel).getByText(/robot likeness 0.93/)).toBeInTheDocument();
    expect(within(panel).getByText('blocks at 0.50', { exact: false })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /Players/ })).toHaveAttribute('href', '/admin/players?user=3');

    await user.click(within(panel).getByRole('button', { name: 'Close panel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(search().get('image')).toBeNull();
  });

  it('removes an image only with a reason and a second confirmation', async () => {
    const user = userEvent.setup();
    mockDelete.mockResolvedValue({ data: { imageUrl: DETAIL.imageUrl, robotsCleared: 2, archivedCleared: 1 } });
    renderPage('/admin/image-uploads?image=1');
    const panel = await screen.findByRole('dialog', { name: 'Image from Stable 1' });
    const remove = await within(panel).findByRole('button', { name: 'Remove image' });
    expect(remove).toBeDisabled();

    await user.type(within(panel).getByLabelText('Reason (required)'), 'explicit content past the filter');
    await user.click(remove);
    const confirm = within(panel).getByRole('alertdialog');
    expect(confirm).toHaveTextContent('Remove this image from Iron Warden, Iron Warden II and 1 archived season? This cannot be undone.');

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(within(panel).queryByRole('alertdialog')).toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();

    await user.click(within(panel).getByRole('button', { name: 'Remove image' }));
    await user.click(within(panel).getByRole('button', { name: 'Yes, remove' }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/admin/images/1', expect.objectContaining({ data: { confirm: true, reason: 'explicit content past the filter' } })));
    expect(await screen.findByText('Image removed: 2 robots and 1 archived entries now show the default frame.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows the removal error and keeps the panel open', async () => {
    const user = userEvent.setup();
    mockDelete.mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { status: 404, data: { error: 'Image not found', code: 'IMAGE_NOT_FOUND' } } }));
    renderPage('/admin/image-uploads?image=1');
    const panel = await screen.findByRole('dialog', { name: 'Image from Stable 1' });
    await user.type(await within(panel).findByLabelText('Reason (required)'), 'explicit content');
    await user.click(within(panel).getByRole('button', { name: 'Remove image' }));
    await user.click(within(panel).getByRole('button', { name: 'Yes, remove' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Image not found');
  });

  it('previews the cleanup, then cleans up and refreshes', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ data: { filesDeleted: 0, bytesReclaimed: 0, referencesCleared: { robots: 0, archived: 30 }, errors: [] } });
    renderPage();
    const storage = await screen.findByRole('region', { name: 'Storage' });
    expect(within(storage).getByTestId('missing-count')).toHaveTextContent('30');

    await user.click(within(storage).getByRole('button', { name: 'Preview cleanup' }));
    const preview = await within(storage).findByTestId('cleanup-preview');
    expect(preview).toHaveTextContent('Would delete 0 orphan files (0 B) and clear 0 robot and 30 archived references to missing files.');
    expect(mockPost).not.toHaveBeenCalled();

    const overviewCalls = mockGet.mock.calls.filter(([url]) => url === '/api/admin/images/overview').length;
    await user.click(within(preview).getByRole('button', { name: 'Clean up' }));
    expect(await within(storage).findByTestId('cleanup-result')).toHaveTextContent('Deleted 0 files (0 B), cleared 0 robot and 30 archived references.');
    expect(mockPost).toHaveBeenCalledWith('/api/admin/images/cleanup');
    await waitFor(() => expect(mockGet.mock.calls.filter(([url]) => url === '/api/admin/images/overview').length).toBe(overviewCalls + 1));
  });

  it('says so when there is nothing to clean up', async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(async (url: string) => {
      if (url === '/api/admin/images/overview') return { data: OVERVIEW };
      if (url === '/api/admin/images') return { data: page(ALL) };
      if (url === '/api/admin/images/cleanup') return { data: { ...PREVIEW, missing: { robots: 0, archived: 0, paths: [] } } };
      throw new Error(`unexpected GET ${url}`);
    });
    renderPage();
    const storage = await screen.findByRole('region', { name: 'Storage' });
    await user.click(within(storage).getByRole('button', { name: 'Preview cleanup' }));
    expect(await within(storage).findByText('Nothing to clean up.')).toBeInTheDocument();
    expect(within(storage).queryByRole('button', { name: 'Clean up' })).toBeNull();
  });
});
