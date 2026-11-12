/**
 * Typed API of the admin Security page (`/admin/security`). Mirrors
 * `app/backend/src/services/security/securityOverviewService.ts`.
 */
import { api } from './api';
import type { SecurityOverview, SecurityWindow } from '@shared/types';

export const SECURITY_WINDOWS: readonly SecurityWindow[] = ['24h', '7d', '30d'];
export const DEFAULT_SECURITY_WINDOW: SecurityWindow = '7d';

export const getSecurityOverview = (window: SecurityWindow, signal?: AbortSignal): Promise<SecurityOverview> =>
  api.get<SecurityOverview>('/api/admin/security/overview', { params: { window }, signal });
