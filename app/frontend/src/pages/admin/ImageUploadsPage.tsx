/**
 * ImageUploadsPage — Retains existing ImageUploadsTab functionality with
 * added rejection reasons display.
 *
 * Requirements: 20.1, 20.2, 25.1, 25.2, 25.3, 25.4
 */
import { useState, useEffect, useCallback } from 'react';
import { AdminPageHeader, AdminDataTable } from '../../components/admin/shared';
import apiClient from '../../utils/apiClient';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UploadEntry {
  userId: number;
  username: string;
  robotId: number;
  robotName: string;
  imageUrl: string;
  fileSize: number;
  uploadDate: string;
  [key: string]: unknown;
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
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function ImageUploadsPage() {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterUserId, setFilterUserId] = useState('');
  const [uploadsLoading, setUploadsLoading] = useState(true);
  const [uploadsError, setUploadsError] = useState<string | null>(null);

  const [moderationEvents, setModerationEvents] = useState<ModerationEvent[]>([]);
  const [modEventsLoading, setModEventsLoading] = useState(true);

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
          e.eventType === 'image_robot_likeness_override',
      );
      setModerationEvents(imageEvents);
    } catch {
      // Non-critical
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
    <div data-testid="image-uploads-page" className="space-y-6">
      <AdminPageHeader title="Image Uploads" subtitle="Uploaded images, moderation events, and orphan cleanup" />

      {/* Moderation Events with Rejection Reasons */}
      <div>
        <h3 className="text-lg font-semibold mb-3">🛡️ Image Moderation Events</h3>
        {modEventsLoading ? (
          <div className="text-secondary py-4">Loading moderation events…</div>
        ) : moderationEvents.length === 0 ? (
          <div className="bg-surface rounded-lg p-6 text-center text-secondary">No image moderation events recorded yet.</div>
        ) : (
          <AdminDataTable<ModerationEvent>
            columns={[
              { key: 'timestamp', label: 'Time', render: (row) => new Date(row.timestamp).toLocaleString() },
              { key: 'eventType', label: 'Event', render: (row) => (
                <span className={`px-2 py-1 rounded text-xs font-medium ${row.eventType === 'image_moderation_rejection' ? 'bg-red-500/20 text-red-400' : row.eventType === 'image_robot_likeness_warning' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {row.eventType.replace('image_', '').replace(/_/g, ' ')}
                </span>
              )},
              { key: 'severity', label: 'Severity', render: (row) => (
                <span className={`px-2 py-1 rounded text-xs ${row.severity === 'critical' ? 'bg-red-500/20 text-red-400' : row.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {row.severity}
                </span>
              )},
              { key: 'userId', label: 'User ID' },
              { key: 'details', label: 'Rejection Reason', render: (row) => {
                const details = row.details;
                if (row.eventType === 'image_moderation_rejection' && details) {
                  const category = details.category || details.nsfwCategory || 'Unknown';
                  const confidence = details.confidence || details.score;
                  return (
                    <span className="text-red-400 text-xs">
                      {String(category)}{confidence != null ? ` (${(Number(confidence) * 100).toFixed(1)}%)` : ''}
                    </span>
                  );
                }
                return <span className="text-secondary text-xs font-mono">{JSON.stringify(details)}</span>;
              }},
            ]}
            data={moderationEvents}
            emptyMessage="No moderation events"
          />
        )}
      </div>

      {/* Uploaded Images */}
      <div>
        <h3 className="text-lg font-semibold mb-3">📤 Uploaded Images</h3>
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div>
            <label className="block text-secondary text-xs mb-1">Filter by User ID</label>
            <input type="text" value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)} placeholder="User ID" className="bg-surface border border-white/10 rounded px-3 py-2 text-white text-sm w-32" />
          </div>
          <button onClick={() => { setPage(1); fetchUploads(1); }} className="px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded text-sm font-medium">Search</button>
          <span className="text-secondary text-sm ml-auto">{total} total uploads</span>
        </div>

        {uploadsError && <div className="bg-red-900/40 border border-red-600/50 rounded-lg p-3 text-red-300 text-sm mb-4">{uploadsError}</div>}

        <AdminDataTable<UploadEntry>
          columns={[
            { key: 'imageUrl', label: 'Preview', render: (row) => <img src={row.imageUrl} alt={`Upload by ${row.username}`} className="w-12 h-12 rounded object-cover bg-surface-elevated" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} /> },
            { key: 'username', label: 'User', render: (row) => <span>{row.username} <span className="text-secondary text-xs">(#{row.userId})</span></span> },
            { key: 'robotName', label: 'Robot', render: (row) => <span>{row.robotName} <span className="text-secondary text-xs">(#{row.robotId})</span></span> },
            { key: 'fileSize', label: 'Size', render: (row) => formatBytes(row.fileSize) },
            { key: 'uploadDate', label: 'Date', render: (row) => new Date(row.uploadDate).toLocaleString() },
          ]}
          data={uploads}
          loading={uploadsLoading}
          emptyMessage="No uploaded images found"
          pagination={totalPages > 1 ? { page, totalPages, onPageChange: setPage } : undefined}
        />
      </div>

      {/* Orphan Cleanup */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">🧹 Orphan Cleanup</h3>
        <p className="text-secondary text-sm mb-4">Scan uploaded images and delete any files not referenced by a robot.</p>
        <button onClick={handleCleanup} disabled={cleanupRunning} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium disabled:opacity-50">
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
      </div>
    </div>
  );
}

export default ImageUploadsPage;
