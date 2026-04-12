/**
 * ImageUploadsTab — Admin portal tab for reviewing uploaded robot images,
 * moderation events (NSFW rejections, robot-likeness warnings/overrides),
 * and triggering orphan cleanup.
 *
 * Consumes:
 *   GET  /api/admin/uploads          — paginated uploaded images
 *   GET  /api/admin/security/events  — moderation-related security events
 *   POST /api/admin/uploads/cleanup  — on-demand orphan cleanup
 */
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../utils/apiClient';

interface UploadEntry {
  userId: number;
  username: string;
  robotId: number;
  robotName: string;
  imageUrl: string;
  fileSize: number;
  uploadDate: string;
}

interface UploadsResponse {
  uploads: UploadEntry[];
  total: number;
  page: number;
  limit: number;
}

interface CleanupResult {
  success: boolean;
  filesDeleted: number;
  bytesReclaimed: number;
  errors: string[];
}

interface ModerationEvent {
  eventType: string;
  severity: string;
  userId: number;
  timestamp: string;
  details: Record<string, unknown>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function ImageUploadsTab() {
  // --- Uploads state ---
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterUserId, setFilterUserId] = useState('');
  const [uploadsLoading, setUploadsLoading] = useState(true);
  const [uploadsError, setUploadsError] = useState<string | null>(null);

  // --- Moderation events state ---
  const [moderationEvents, setModerationEvents] = useState<ModerationEvent[]>([]);
  const [modEventsLoading, setModEventsLoading] = useState(true);

  // --- Cleanup state ---
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  const LIMIT = 20;

  const fetchUploads = useCallback(async (p: number = page) => {
    setUploadsLoading(true);
    setUploadsError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (filterUserId.trim()) params.set('userId', filterUserId.trim());
      const res = await apiClient.get<UploadsResponse>(`/api/admin/uploads?${params}`);
      setUploads(res.data.uploads);
      setTotal(res.data.total);
    } catch {
      setUploadsError('Failed to load uploads');
    } finally {
      setUploadsLoading(false);
    }
  }, [page, filterUserId]);

  const fetchModerationEvents = useCallback(async () => {
    setModEventsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      const res = await apiClient.get<{ events: ModerationEvent[] }>(`/api/admin/security/events?${params}`);
      const imageEvents = (res.data?.events ?? []).filter(
        (e: ModerationEvent) =>
          e.eventType === 'image_moderation_rejection' ||
          e.eventType === 'image_robot_likeness_warning' ||
          e.eventType === 'image_robot_likeness_override'
      );
      setModerationEvents(imageEvents);
    } catch {
      // Non-critical — just show empty
    } finally {
      setModEventsLoading(false);
    }
  }, []);

  const handleCleanup = async () => {
    setCleanupRunning(true);
    setCleanupResult(null);
    try {
      const res = await apiClient.post<CleanupResult>('/api/admin/uploads/cleanup');
      setCleanupResult(res.data);
    } catch {
      setCleanupResult({ success: false, filesDeleted: 0, bytesReclaimed: 0, errors: ['Cleanup request failed'] });
    } finally {
      setCleanupRunning(false);
    }
  };

  useEffect(() => { fetchUploads(page); }, [page, fetchUploads]);
  useEffect(() => { fetchModerationEvents(); }, [fetchModerationEvents]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-8">
      {/* --- Moderation Events --- */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-white">🛡️ Image Moderation Events</h2>
        <p className="text-secondary text-sm mb-4">
          Real-time moderation events from SecurityMonitor. NSFW rejections, robot-likeness warnings, and overrides.
        </p>
        {modEventsLoading ? (
          <div className="text-secondary py-4">Loading moderation events…</div>
        ) : moderationEvents.length === 0 ? (
          <div className="bg-surface rounded-lg p-6 text-center text-secondary">
            No image moderation events recorded yet.
          </div>
        ) : (
          <div className="bg-surface rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-secondary">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {moderationEvents.map((event, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-secondary whitespace-nowrap">{formatDate(event.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        event.eventType === 'image_moderation_rejection' ? 'bg-red-500/20 text-red-400' :
                        event.eventType === 'image_robot_likeness_warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {event.eventType.replace('image_', '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        event.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        event.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white">{event.userId}</td>
                    <td className="px-4 py-3 text-secondary text-xs font-mono">
                      {JSON.stringify(event.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Uploaded Images --- */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-white">📤 Uploaded Images</h2>
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div>
            <label className="block text-secondary text-xs mb-1">Filter by User ID</label>
            <input
              type="text"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              placeholder="User ID"
              className="bg-surface border border-white/10 rounded px-3 py-2 text-white text-sm w-32"
            />
          </div>
          <button
            onClick={() => { setPage(1); fetchUploads(1); }}
            className="px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded text-sm font-medium"
          >
            Search
          </button>
          <span className="text-secondary text-sm ml-auto">{total} total uploads</span>
        </div>

        {uploadsError && (
          <div className="bg-red-900/40 border border-red-600/50 rounded-lg p-3 text-red-300 text-sm mb-4">
            {uploadsError}
          </div>
        )}

        {uploadsLoading ? (
          <div className="text-secondary py-4">Loading uploads…</div>
        ) : uploads.length === 0 ? (
          <div className="bg-surface rounded-lg p-6 text-center text-secondary">
            No uploaded images found.
          </div>
        ) : (
          <div className="bg-surface rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-secondary">
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Robot</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <img
                        src={upload.imageUrl}
                        alt={`Upload by ${upload.username}`}
                        className="w-12 h-12 rounded object-cover bg-surface-elevated"
                        onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).alt = '❌'; }}
                      />
                    </td>
                    <td className="px-4 py-3 text-white">
                      <a href={`/stables/${upload.username}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                        {upload.username}
                      </a>
                      {' '}<span className="text-secondary text-xs">(#{upload.userId})</span>
                    </td>
                    <td className="px-4 py-3 text-white">
                      <a href={`/robots/${upload.robotId}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                        {upload.robotName}
                      </a>
                      {' '}<span className="text-secondary text-xs">(#{upload.robotId})</span>
                    </td>
                    <td className="px-4 py-3 text-secondary">{formatBytes(upload.fileSize)}</td>
                    <td className="px-4 py-3 text-secondary whitespace-nowrap">{formatDate(upload.uploadDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-white/10">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-surface-elevated rounded text-sm disabled:opacity-50"
                >
                  ← Prev
                </button>
                <span className="text-secondary text-sm">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 bg-surface-elevated rounded text-sm disabled:opacity-50"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* --- Orphan Cleanup --- */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-white">🧹 Orphan Cleanup</h2>
        <p className="text-secondary text-sm mb-4">
          Scan uploaded images and delete any files not referenced by a robot. Also runs automatically as Step 15 in the daily settlement cycle.
        </p>
        <button
          onClick={handleCleanup}
          disabled={cleanupRunning}
          className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium disabled:opacity-50"
        >
          {cleanupRunning ? 'Running cleanup…' : 'Run Orphan Cleanup'}
        </button>
        {cleanupResult && (
          <div className={`mt-4 rounded-lg p-4 text-sm ${cleanupResult.success ? 'bg-green-900/40 border border-green-600/50 text-green-300' : 'bg-red-900/40 border border-red-600/50 text-red-300'}`}>
            <p>Files deleted: {cleanupResult.filesDeleted}</p>
            <p>Space reclaimed: {formatBytes(cleanupResult.bytesReclaimed)}</p>
            {cleanupResult.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">Errors:</p>
                {cleanupResult.errors.map((err, i) => <p key={i} className="text-xs">{err}</p>)}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
