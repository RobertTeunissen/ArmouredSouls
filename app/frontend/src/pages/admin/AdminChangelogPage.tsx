/**
 * ChangelogPage — Retains existing AdminChangelogTab functionality.
 *
 * Requirements: 20.3, 25.1, 25.2, 25.3, 25.4
 */
import { useState, useEffect } from 'react';
import { AdminPageHeader } from '../../components/admin/shared';
import {
  fetchAllEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  publishEntry,
  uploadChangelogImage,
  type ChangelogEntry,
  type CreateChangelogData,
  type UpdateChangelogData,
} from '../../utils/changelogApi';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = ['balance', 'feature', 'bugfix', 'economy'] as const;

const BADGE_COLORS: Record<string, string> = {
  balance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  feature: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  bugfix: 'bg-red-500/20 text-red-400 border-red-500/30',
  economy: 'bg-green-500/20 text-green-400 border-green-500/30',
};

interface FormState {
  title: string;
  body: string;
  category: typeof CATEGORIES[number];
  status: 'draft' | 'published';
  imageUrl: string | null;
}

const emptyForm: FormState = { title: '', body: '', category: 'feature', status: 'draft', imageUrl: null };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function AdminChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const perPage = 20;

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllEntries(page, perPage);
      setEntries(result.entries);
      setTotal(result.total);
    } catch {
      setError('Failed to load changelog entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, [page]);

  const validateForm = (): string[] => {
    const errors: string[] = [];
    if (!form.title.trim()) errors.push('Title is required');
    if (form.title.length > 200) errors.push('Title must be 200 characters or less');
    if (!form.body.trim()) errors.push('Body is required');
    if (form.body.length > 5000) errors.push('Body must be 5000 characters or less');
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();
    if (errors.length > 0) { setFormErrors(errors); return; }
    setFormErrors([]);
    setSaving(true);
    try {
      if (editingId) {
        const data: UpdateChangelogData = { title: form.title, body: form.body, category: form.category, status: form.status, imageUrl: form.imageUrl };
        await updateEntry(editingId, data);
      } else {
        const data: CreateChangelogData = { title: form.title, body: form.body, category: form.category, status: form.status, imageUrl: form.imageUrl };
        await createEntry(data);
      }
      setForm(emptyForm);
      setEditingId(null);
      await loadEntries();
    } catch {
      setFormErrors(['Failed to save entry.']);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: ChangelogEntry) => {
    setForm({ title: entry.title, body: entry.body, category: entry.category, status: entry.status, imageUrl: entry.imageUrl });
    setEditingId(entry.id);
    setFormErrors([]);
  };

  const handlePublish = async (id: number) => {
    try { await publishEntry(id); await loadEntries(); } catch { setError('Failed to publish entry.'); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteEntry(id); setDeleteConfirmId(null); await loadEntries(); } catch { setError('Failed to delete entry.'); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadChangelogImage(file);
      setForm((prev) => ({ ...prev, imageUrl: result.imageUrl }));
    } catch {
      setFormErrors(['Image upload failed.']);
    } finally {
      setUploading(false);
    }
  };

  const drafts = entries.filter((e) => e.status === 'draft');
  const published = entries.filter((e) => e.status === 'published');
  const totalPages = Math.ceil(total / perPage);

  return (
    <div data-testid="changelog-page" className="space-y-6">
      <AdminPageHeader title="Changelog Management" subtitle="Create, edit, and publish changelog entries" />

      {/* Create/Edit Form */}
      <form onSubmit={handleSubmit} className="bg-surface border border-white/10 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit Entry' : 'Create New Entry'}</h3>

        {formErrors.length > 0 && (
          <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg" role="alert">
            {formErrors.map((err, i) => <p key={i} className="text-error text-sm">{err}</p>)}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="changelog-title" className="block text-sm font-medium text-secondary mb-1">Title</label>
            <input id="changelog-title" type="text" maxLength={200} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" placeholder="Entry title" />
          </div>
          <div>
            <label htmlFor="changelog-body" className="block text-sm font-medium text-secondary mb-1">Body</label>
            <textarea id="changelog-body" maxLength={5000} rows={4} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white" placeholder="Entry body" />
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor="changelog-category" className="block text-sm font-medium text-secondary mb-1">Category</label>
              <select id="changelog-category" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as typeof CATEGORIES[number] }))} className="bg-background border border-white/10 rounded-lg px-3 py-2 text-white">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="changelog-status" className="block text-sm font-medium text-secondary mb-1">Status</label>
              <select id="changelog-status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as 'draft' | 'published' }))} className="bg-background border border-white/10 rounded-lg px-3 py-2 text-white">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="changelog-image" className="block text-sm font-medium text-secondary mb-1">Image (optional)</label>
            <input id="changelog-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="text-secondary text-sm" />
            {uploading && <p className="text-xs text-secondary mt-1">Uploading...</p>}
            {form.imageUrl && (
              <div className="mt-2">
                <img src={form.imageUrl} alt="Preview" className="max-h-32 rounded" />
                <button type="button" onClick={() => setForm((p) => ({ ...p, imageUrl: null }))} className="text-xs text-error mt-1">Remove image</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-semibold text-sm disabled:opacity-50">
            {saving ? 'Saving...' : editingId ? 'Update Entry' : 'Create Entry'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setForm(emptyForm); setEditingId(null); setFormErrors([]); }} className="px-4 py-2 border border-white/10 text-secondary rounded-lg hover:text-white text-sm">Cancel</button>
          )}
        </div>
      </form>

      {error && <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">{error}</div>}

      {loading && <div className="text-secondary py-8 text-center">Loading...</div>}

      {!loading && (
        <>
          {/* Drafts */}
          {drafts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-secondary">Drafts</h3>
              <div className="space-y-3">
                {drafts.map((entry) => (
                  <div key={entry.id} className="bg-surface border border-white/10 rounded-lg p-4 opacity-70" data-testid="changelog-draft-entry">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold border bg-white/10 text-secondary border-white/20">DRAFT</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border capitalize ${BADGE_COLORS[entry.category] || ''}`}>{entry.category}</span>
                      <span className="text-xs text-secondary">{formatDate(entry.createdAt)}</span>
                    </div>
                    <h4 className="font-bold text-white mb-1">{entry.title}</h4>
                    <p className="text-sm text-secondary mb-2 line-clamp-2">{entry.body}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handlePublish(entry.id)} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700">Publish</button>
                      <button onClick={() => handleEdit(entry)} className="px-3 py-1 border border-white/10 text-secondary rounded text-xs hover:text-white">Edit</button>
                      {deleteConfirmId === entry.id ? (
                        <span className="flex gap-1">
                          <button onClick={() => handleDelete(entry.id)} className="px-3 py-1 bg-error text-white rounded text-xs font-semibold">Confirm</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1 border border-white/10 text-secondary rounded text-xs">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(entry.id)} className="px-3 py-1 border border-error/30 text-error rounded text-xs hover:bg-error/10">Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Published */}
          {published.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-secondary">Published</h3>
              <div className="space-y-3">
                {published.map((entry) => (
                  <div key={entry.id} className="bg-surface border border-white/10 rounded-lg p-4" data-testid="changelog-published-entry">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border capitalize ${BADGE_COLORS[entry.category] || ''}`}>{entry.category}</span>
                      {entry.publishDate && <span className="text-xs text-secondary">{formatDate(entry.publishDate)}</span>}
                    </div>
                    <h4 className="font-bold text-white mb-1">{entry.title}</h4>
                    <p className="text-sm text-secondary mb-2 line-clamp-2">{entry.body}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(entry)} className="px-3 py-1 border border-white/10 text-secondary rounded text-xs hover:text-white">Edit</button>
                      {deleteConfirmId === entry.id ? (
                        <span className="flex gap-1">
                          <button onClick={() => handleDelete(entry.id)} className="px-3 py-1 bg-error text-white rounded text-xs font-semibold">Confirm</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1 border border-white/10 text-secondary rounded text-xs">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(entry.id)} className="px-3 py-1 border border-error/30 text-error rounded text-xs hover:bg-error/10">Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entries.length === 0 && <div className="text-center py-8 text-secondary">No changelog entries yet. Create one above.</div>}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-2 rounded bg-surface border border-white/10 text-secondary disabled:opacity-40">Previous</button>
              <span className="px-3 py-2 text-secondary">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-2 rounded bg-surface border border-white/10 text-secondary disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AdminChangelogPage;
