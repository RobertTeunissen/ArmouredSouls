/**
 * Typed API of the admin Meta page (`/admin/meta`).
 *
 * The page reads the choice sections of `GET /api/admin/meta/choices`
 * (`app/backend/src/services/admin/meta/metaChoicesService.ts`) and the build
 * sections of `GET /api/admin/meta/builds`
 * (`app/backend/src/services/admin/meta/metaBuildsService.ts`), both per
 * stable type (`stables`). The response shapes are wire contracts in
 * `@shared/types` (admin-analysis.ts).
 */
import { api } from './api';
import type { StableScope } from './adminStableScope';
import type { MetaBuilds, MetaChoices } from '@shared/types';
export function getMetaChoices(stables: StableScope, signal?: AbortSignal): Promise<MetaChoices> {
  return api.get<MetaChoices>('/api/admin/meta/choices', { params: { stables }, signal });
}

export function getMetaBuilds(stables: StableScope, signal?: AbortSignal): Promise<MetaBuilds> {
  return api.get<MetaBuilds>('/api/admin/meta/builds', { params: { stables }, signal });
}
