/**
 * Slide-over for one image: full size, owner, where it is used, the
 * moderation scores at upload against the thresholds, and "Remove image" —
 * for an image that got past the NSFW filter. Removal needs a reason and a
 * second confirmation naming the robots; the player is not notified.
 */
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING, AdminSlideOver, PanelError, PanelSkeleton } from '../shared';
import { ApiError } from '../../../utils/ApiError';
import { isAbortError } from '../../../utils/abort';
import { getImageDetail, removeImage, type ImageDetail, type ModerationScores } from '../../../utils/adminImagesApi';
import { bytesText, fullDateTime, ownerLabel } from '../../../utils/adminImagesFormat';

export interface ImageDetailPanelProps {
  imageId: number | null;
  onClose: () => void;
  /** Called after a successful removal so the page can refresh. */
  onRemoved: (message: string) => void;
}

const SCORE_ORDER: (keyof ModerationScores)[] = ['neutral', 'drawing', 'sexy', 'hentai', 'porn'];

function Scores({ detail }: { detail: ImageDetail }): ReactNode {
  if (!detail.moderation) {
    return <p className="text-sm text-secondary">Not recorded: uploaded before scores were kept.</p>;
  }
  const { scores, robotLikenessScore } = detail.moderation;
  const nsfw = detail.thresholds.nsfw;
  const blocked = scores.porn >= nsfw.porn || scores.hentai >= nsfw.hentai || scores.sexy >= nsfw.sexy;
  return (
    <div className="space-y-2 rounded-md bg-surface-elevated/60 p-3">
      <p className="flex flex-wrap items-center gap-2 text-xs text-secondary">
        <span className={`rounded-full px-2 py-0.5 ${blocked ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>{blocked ? 'Above a block threshold' : 'Passed'}</span>
        {robotLikenessScore !== null && (
          <span>robot likeness {robotLikenessScore.toFixed(2)} (drawing + neutral, needs {detail.thresholds.robotLikeness.toFixed(2)})</span>
        )}
      </p>
      <dl className="space-y-1">
        {SCORE_ORDER.map((key) => {
          const limit = key === 'sexy' || key === 'hentai' || key === 'porn' ? nsfw[key] : null;
          return (
            <div key={key} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
              <dt className="text-secondary">{key}</dt>
              <span className="relative block h-2 rounded-sm bg-surface" aria-hidden="true">
                <span className={`block h-full rounded-sm ${limit !== null ? 'bg-error/70' : 'bg-secondary/70'}`} style={{ width: `${Math.min(100, scores[key] * 100)}%` }} />
                {limit !== null && <span className="absolute -top-0.5 h-3 w-px bg-error" style={{ left: `${limit * 100}%` }} />}
              </span>
              <dd className="tabular-nums text-white">
                {scores[key].toFixed(2)}{limit !== null && <span className="text-secondary"> · blocks at {limit.toFixed(2)}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function RemoveForm({ detail, onRemoved }: { detail: ImageDetail; onRemoved: (message: string) => void }): ReactNode {
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const robots = detail.robots.map((r) => r.name);
  const valid = reason.trim().length >= 3;

  const remove = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await removeImage(detail.id, reason.trim());
      onRemoved(`Image removed: ${result.robotsCleared} robots and ${result.archivedCleared} archived entries now show the default frame.`);
    } catch (err) {
      setError((err instanceof ApiError && err.message) || 'The image could not be removed.');
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <section aria-labelledby={`${reasonId}-heading`} className="space-y-3 border-t border-white/10 pt-5">
      <h4 id={`${reasonId}-heading`} className="text-sm font-semibold text-white">Remove image</h4>
      <p className="text-xs text-secondary">
        Only for an image that got past the NSFW filter. {robots.length > 0 ? `Its ${robots.length === 1 ? 'robot falls' : `${robots.length} robots fall`} back to the default frame, ` : ''}
        archived seasons lose the reference, and the file is deleted. The player is not notified. Logged in the audit log with your account.
      </p>
      <label htmlFor={reasonId} className="block text-xs text-secondary">Reason (required)</label>
      <input
        id={reasonId}
        type="text"
        value={reason}
        maxLength={200}
        onChange={(e) => { setReason(e.target.value); setConfirming(false); }}
        placeholder='e.g. "explicit content past the filter"'
        className={`min-h-11 w-full rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white placeholder:text-secondary ${ADMIN_FOCUS_RING}`}
      />
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {!confirming ? (
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => setConfirming(true)}
          className={`min-h-11 rounded-md border border-error/60 bg-error/15 px-4 text-sm text-error hover:bg-error/25 disabled:opacity-50 ${ADMIN_FOCUS_RING}`}
        >
          Remove image
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby={`${reasonId}-confirm`} className="space-y-3 rounded-md border border-error/40 bg-error/10 p-3">
          <p id={`${reasonId}-confirm`} className="text-sm text-white">
            {robots.length > 0 ? `Remove this image from ${robots.join(', ')}` : 'Remove this image'}
            {detail.archivedSeasons.length > 0 ? ` and ${detail.archivedSeasons.length === 1 ? '1 archived season' : `${detail.archivedSeasons.length} archived seasons`}` : ''}? This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => { void remove(); }} className={`min-h-11 rounded-md bg-error px-4 text-sm font-semibold text-background hover:bg-error/90 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}>
              {busy ? 'Removing…' : 'Yes, remove'}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={`min-h-11 rounded-md bg-surface-elevated px-4 text-sm text-white hover:bg-white/10 ${ADMIN_FOCUS_RING}`}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ImageDetailPanel({ imageId, onClose, onRemoved }: ImageDetailPanelProps): ReactNode {
  const [detail, setDetail] = useState<ImageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (imageId === null) return undefined;
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    getImageDetail(imageId, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setDetail(data); })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load the image.');
      });
    return () => controller.abort();
  }, [imageId]);

  const title = detail ? `Image from ${ownerLabel(detail.owner)}` : 'Image';

  return (
    <AdminSlideOver open={imageId !== null} onClose={onClose} title={title} width="xl">
      {error && <PanelError message={error} />}
      {!detail && !error && <PanelSkeleton rows={8} />}
      {detail && (
        <div className="space-y-5" data-testid="image-detail">
          <p className="text-xs text-secondary">Uploaded {fullDateTime(detail.uploadedAt)} · 512 × 512 WebP · {bytesText(detail.fileSize)}</p>
          <div className="flex flex-wrap items-start gap-4">
            <img src={detail.imageUrl} alt={`Uploaded robot image from ${ownerLabel(detail.owner)}`} className="aspect-square w-full max-w-xs rounded-md bg-surface-elevated object-cover" />
            <a href={detail.imageUrl} target="_blank" rel="noopener noreferrer" className={`text-xs text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
              Open original <span aria-hidden="true">↗</span>
            </a>
          </div>

          <section className="space-y-1">
            <h4 className="text-sm font-semibold text-white">Owner</h4>
            <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-white">
              <span>{ownerLabel(detail.owner)}{detail.owner.username ? ` · @${detail.owner.username}` : ''}</span>
              <Link to={`/admin/players?user=${detail.owner.userId}`} className={`text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
                Players <span aria-hidden="true">↗</span>
              </Link>
            </p>
          </section>

          <section className="space-y-1">
            <h4 className="text-sm font-semibold text-white">Where it is used</h4>
            <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-y-1 text-sm">
              <dt className="text-secondary">Current robots</dt>
              <dd className="text-white">{detail.robots.length > 0 ? detail.robots.map((r) => r.name).join(', ') : 'none'}</dd>
              <dt className="text-secondary">Archived seasons</dt>
              <dd className="text-white">{detail.archivedSeasons.length > 0 ? detail.archivedSeasons.map((n) => `Season ${n}`).join(', ') : 'none'}</dd>
              <dt className="text-secondary">Library</dt>
              <dd className="text-white">{detail.library.saved} of {detail.library.limit} saved images</dd>
              {detail.uploadedAnyway && (<><dt className="text-secondary">Warning</dt><dd className="text-warning">Uploaded anyway after &quot;doesn&apos;t look like a robot&quot;</dd></>)}
            </dl>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-white">Moderation at upload</h4>
            <Scores detail={detail} />
          </section>

          <RemoveForm key={detail.id} detail={detail} onRemoved={onRemoved} />
        </div>
      )}
    </AdminSlideOver>
  );
}
