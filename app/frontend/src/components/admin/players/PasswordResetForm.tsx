/**
 * Admin password reset of one player account. The server signs the player
 * out everywhere, logs the reset and applies the same rules as checked here.
 */
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import { ApiError } from '../../../utils/ApiError';
import { resetPlayerPassword } from '../../../utils/adminPlayersApi';
import { passwordProblem } from '../../../utils/adminPlayersFormat';

export interface PasswordResetFormProps {
  userId: number;
  username: string;
}


const INPUT = `min-h-11 w-full rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white placeholder:text-secondary ${ADMIN_FOCUS_RING}`;

export function PasswordResetForm({ userId, username }: PasswordResetFormProps): ReactNode {
  const id = useId();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const issue = passwordProblem(password) ?? (password !== confirm ? 'Passwords do not match' : null);
    setProblem(issue);
    setResult(null);
    if (issue) return;
    setBusy(true);
    try {
      await resetPlayerPassword(userId, password);
      setResult({ tone: 'success', text: `Password reset for ${username}. They are signed out everywhere.` });
      setPassword('');
      setConfirm('');
    } catch (err) {
      setResult({ tone: 'error', text: (err instanceof ApiError && err.message) || 'The password could not be reset.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3" aria-labelledby={`${id}-heading`} noValidate>
      <div>
        <h3 id={`${id}-heading`} className="text-sm font-semibold text-white">Password reset</h3>
        <p className="text-xs text-secondary">Signs the player out everywhere. Logged in the audit log.</p>
      </div>
      {result && (
        <p role={result.tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${result.tone === 'error' ? 'border-error/40 bg-error/10 text-error' : 'border-success/40 bg-success/10 text-success'}`}>
          {result.text}
        </p>
      )}
      <div>
        <label htmlFor={`${id}-password`} className="sr-only">New password</label>
        <input id={`${id}-password`} type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => { setPassword(e.target.value); setProblem(null); }} className={INPUT} aria-describedby={`${id}-rules`} aria-invalid={problem !== null || undefined} />
      </div>
      <div>
        <label htmlFor={`${id}-confirm`} className="sr-only">Confirm password</label>
        <input id={`${id}-confirm`} type="password" autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setProblem(null); }} className={INPUT} />
      </div>
      <p id={`${id}-rules`} className="text-xs text-secondary">At least 8 characters with an uppercase letter, a lowercase letter and a number.</p>
      {problem && <p role="alert" className="text-sm text-error">{problem}</p>}
      <button
        type="submit"
        disabled={busy}
        className={`min-h-11 rounded-md border border-error/60 bg-error/15 px-4 text-sm font-semibold text-error hover:bg-error/25 disabled:opacity-50 ${ADMIN_FOCUS_RING}`}
      >
        {busy ? 'Resetting…' : 'Reset password'}
      </button>
    </form>
  );
}
