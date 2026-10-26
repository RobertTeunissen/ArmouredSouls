/**
 * Battles API helpers: list parameters, and the clipboard copy that starts the
 * write inside the click (ClipboardItem with a promise) with a writeText fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyBattleExport, getBattleExportText, getBattleList } from '../adminBattlesApi';
import { DEFAULT_FILTERS } from '../adminBattlesFormat';

const mockGet = vi.fn();
vi.mock('../api', () => ({ api: { get: (...args: unknown[]) => mockGet(...args) } }));

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalItem = (globalThis as { ClipboardItem?: unknown }).ClipboardItem;

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue('# Battle #1\n');
});

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else delete (navigator as { clipboard?: unknown }).clipboard;
  (globalThis as { ClipboardItem?: unknown }).ClipboardItem = originalItem;
});

describe('getBattleList', () => {
  it('sends the filters with a fixed page size and drops an empty search', async () => {
    mockGet.mockResolvedValue({});
    await getBattleList({ ...DEFAULT_FILTERS, mode: 'koth', page: 2 });
    expect(mockGet).toHaveBeenCalledWith('/api/admin/battles', {
      params: { page: 2, limit: 25, mode: 'koth', stable: 'all', outcome: 'all', range: '7d' },
      signal: undefined,
    });
  });
});

describe('getBattleExportText', () => {
  it('asks for the text format as text', async () => {
    await getBattleExportText(7);
    expect(mockGet).toHaveBeenCalledWith('/api/admin/battles/7/export', { params: { format: 'text' }, responseType: 'text' });
  });
});

describe('copyBattleExport', () => {
  it('writes a ClipboardItem whose text arrives as a promise', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    setClipboard({ write, writeText: vi.fn() });
    class FakeItem { constructor(public items: Record<string, Promise<Blob>>) {} }
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = FakeItem;
    await expect(copyBattleExport(1)).resolves.toBe(12);
    const [[items]] = write.mock.calls as [[FakeItem[]]];
    const blob = await items[0].items['text/plain'];
    expect(await blob.text()).toBe('# Battle #1\n');
  });

  it('falls back to writeText without ClipboardItem', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = undefined;
    await expect(copyBattleExport(1)).resolves.toBe(12);
    expect(writeText).toHaveBeenCalledWith('# Battle #1\n');
  });

  it('falls back to writeText when the ClipboardItem write is refused', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ write: vi.fn().mockRejectedValue(new Error('NotAllowedError')), writeText });
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = class { constructor(public items: unknown) {} };
    await expect(copyBattleExport(1)).resolves.toBe(12);
    expect(writeText).toHaveBeenCalled();
  });

  it('rejects when the export request fails', async () => {
    mockGet.mockRejectedValue(new Error('500'));
    setClipboard({ writeText: vi.fn() });
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = undefined;
    await expect(copyBattleExport(1)).rejects.toThrow('500');
  });
});
