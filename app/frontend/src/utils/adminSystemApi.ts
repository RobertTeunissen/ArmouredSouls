/**
 * Admin System API (`/admin/system`): server health and what is failing.
 * The response shape is a wire contract in `@shared/types` (admin-system.ts).
 */
import { api } from './api';
import type { SystemOverview } from '@shared/types';

export function getSystemOverview(signal?: AbortSignal): Promise<SystemOverview> {
  return api.get<SystemOverview>('/api/admin/system/overview', { signal });
}
