/**
 * CustomNameEditor — Inline editor for `WeaponInventory.customName` (Spec #34).
 *
 * Two visual modes:
 *   - Display mode (default): renders the current customName in italic, or a
 *     muted "Set name…" placeholder when null. Clicking the surface switches
 *     to edit mode.
 *   - Edit mode: input field pre-filled with the current value, plus Save
 *     and Cancel buttons. Empty input on Save clears the name (passes
 *     `null` to `onSave`).
 *
 * The component does NOT call the API directly — the parent (InventoryRow,
 * Task 19) wires `onSave` to `apiClient.patch('/api/weapon-inventory/:id/custom-name')`.
 * Keeping the API call in the parent matches the layering used elsewhere in
 * the weapon-shop component family (e.g. ConfirmSaleModal forwards results
 * upward but the row owns the data refresh).
 *
 * Validation mirrors the backend `safeName` Zod primitive in
 * `app/backend/src/utils/securityValidation.ts`:
 *   - Length 1–60 (empty is treated as "clear", which is allowed).
 *   - Character set: letters, digits, space, underscore, hyphen, apostrophe,
 *     period, exclamation mark.
 *
 * If the backend changes the `safeName` regex, this regex must change with
 * it — there is no shared validation primitive between FE and BE for this
 * field today.
 *
 * Spec: 34-weapon-refinement.
 */

import { useEffect, useRef, useState } from 'react';
import type { WeaponInventoryItem } from '../weapon-shop/types';

interface CustomNameEditorProps {
  inventoryItem: WeaponInventoryItem;
  /**
   * Persists the new name. The parent is responsible for the network call,
   * for normalising the response into refreshed state, and for surfacing
   * any post-save side-effects (toasts, list refresh, etc.).
   *
   * Empty input is converted to `null` before this callback fires.
   * Throwing from this callback puts the editor into an error state.
   */
  onSave: (newName: string | null) => Promise<void>;
}

/**
 * Mirrors `safeName` from `app/backend/src/utils/securityValidation.ts`
 * (`/^[a-zA-Z0-9 _\-'.!]+$/`), with `+` relaxed to `*` so the empty-string
 * case is handled by the "empty → null clears the name" branch in handleSave
 * rather than by failing the regex check.
 */
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9 _\-'.!]*$/;
const MAX_LENGTH = 60;

/**
 * Pull a human-readable error message off whatever the parent threw. We
 * prefer the API error envelope (`response.data.error`) — that's where the
 * backend's 429 / 400 / 403 messages land — and fall back to `error.message`
 * for thrown JS errors. Anything else becomes a generic fallback so the UI
 * never renders `[object Object]`.
 */
function extractErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const apiErr = err as { response?: { data?: { error?: string } }; message?: string };
    const apiMsg = apiErr.response?.data?.error;
    if (typeof apiMsg === 'string' && apiMsg.length > 0) return apiMsg;
    if (typeof apiErr.message === 'string' && apiErr.message.length > 0) return apiErr.message;
  }
  return 'Failed to save custom name.';
}

export function CustomNameEditor({ inventoryItem, onSave }: CustomNameEditorProps) {
  const currentName = inventoryItem.customName ?? '';

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus the input when entering edit mode so the player can start
  // typing immediately. Also re-sync the draft to the latest persisted
  // value, in case the inventory item was updated externally while the
  // component was in display mode.
  useEffect(() => {
    if (isEditing) {
      setDraft(inventoryItem.customName ?? '');
      // Defer to the next paint so the input is mounted before focus().
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isEditing, inventoryItem.customName]);

  const enterEditMode = () => {
    setError(null);
    setDraft(inventoryItem.customName ?? '');
    setIsEditing(true);
  };

  const cancel = () => {
    setIsEditing(false);
    setError(null);
    setDraft(inventoryItem.customName ?? '');
  };

  const handleSave = async () => {
    if (submitting) return;

    const trimmed = draft.trim();

    // Empty input clears the custom name. Skip regex validation for the
    // clear case so the UI never blocks "I want to remove my name".
    if (trimmed.length === 0) {
      // No-op if there was nothing to clear in the first place — just exit.
      if (currentName === '') {
        setIsEditing(false);
        setError(null);
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        await onSave(null);
        setIsEditing(false);
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (trimmed.length > MAX_LENGTH) {
      setError(`Custom name must be ${MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (!SAFE_NAME_PATTERN.test(trimmed)) {
      setError(
        "Custom name may contain letters, digits, spaces, and the symbols _ - ' . !",
      );
      return;
    }

    // No-op if the value matches what's already persisted.
    if (trimmed === currentName) {
      setIsEditing(false);
      setError(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  // ── Display mode ───────────────────────────────────────────────────
  if (!isEditing) {
    const hasName = currentName.length > 0;
    return (
      <button
        type="button"
        onClick={enterEditMode}
        title={hasName ? 'Click to edit custom name' : 'Click to set a custom name'}
        aria-label={
          hasName
            ? `Edit custom weapon name: ${currentName}`
            : 'Set custom weapon name'
        }
        className={
          'inline-flex items-center text-sm rounded px-2 py-0.5 transition-colors ' +
          'hover:bg-surface-elevated/60 focus:outline-none focus:ring-2 focus:ring-primary ' +
          (hasName ? 'italic text-secondary' : 'italic text-secondary/60')
        }
        data-testid="custom-name-editor-display"
      >
        {hasName ? `“${currentName}”` : 'Set name…'}
      </button>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────
  return (
    <div
      className="inline-flex flex-col gap-1"
      data-testid="custom-name-editor-edit"
    >
      <div className="inline-flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={submitting}
          maxLength={MAX_LENGTH}
          aria-label="Custom weapon name"
          aria-invalid={error !== null}
          placeholder="Custom name"
          className={
            'bg-surface-elevated border border-secondary/40 rounded px-2 py-1 text-sm text-white ' +
            'focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50'
          }
          data-testid="custom-name-editor-input"
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={submitting}
          aria-label="Save custom name"
          className={
            'bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-3 py-1 rounded ' +
            'transition-colors disabled:opacity-50'
          }
          data-testid="custom-name-editor-save"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={submitting}
          aria-label="Cancel editing custom name"
          className={
            'bg-surface-elevated hover:bg-surface-elevated/70 text-white text-sm px-3 py-1 rounded ' +
            'transition-colors disabled:opacity-50'
          }
          data-testid="custom-name-editor-cancel"
        >
          Cancel
        </button>
      </div>
      {error !== null && (
        <span
          role="alert"
          className="text-xs text-red-300"
          data-testid="custom-name-editor-error"
        >
          {error}
        </span>
      )}
    </div>
  );
}
