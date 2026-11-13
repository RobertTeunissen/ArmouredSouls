/**
 * Security signals (`security_events`) and the stored JSON shapes of the
 * admin Security & Moderation pages (`security_events.details`,
 * `uploaded_images.moderation_scores`).
 *
 * A signal either fired or it did not: there are no severity levels. Admin
 * page views and routine purchases are not signals and are not stored.
 */
import type { SecuritySignal } from '../shared/types';

// The signal union is a wire contract (shared admin-security.ts).
export type { SecuritySignal };

/** Why a login failed. Never the submitted name or password. */
export type FailedLoginReason = 'unknown_account' | 'wrong_password' | 'automaton';

/** `security_events.details`: small, signal-specific facts. */
export interface SecurityEventDetails {
  /** failed_login */
  reason?: FailedLoginReason;
  /** ownership_violation: robot | weapon | facility | admin_endpoint */
  resourceType?: string;
  resourceId?: number;
  /** race_condition_burst / robot_creation_burst: events inside the window */
  count?: number;
  windowMs?: number;
  /** malformed_request: invalid_params | invalid_query | invalid_headers | invalid_body */
  violationType?: string;
}

