/**
 * Admin portal barrel export.
 * Single entry point for admin route guard, layout, shared components, and types.
 */

export { default as AdminRoute } from './AdminRoute';
export { default as AdminLayout } from './AdminLayout';

// Shared UI components
export {
  AdminStatCard,
  AdminDataTable,
  AdminFilterBar,
  AdminPageHeader,
  AdminSlideOver,
  AdminEmptyState,
} from './shared';

export type {
  AdminStatCardProps,
  AdminDataTableProps,
  AdminDataTableColumn,
  AdminFilterBarProps,
  FilterChip,
  AdminPageHeaderProps,
  AdminSlideOverProps,
  AdminEmptyStateProps,
} from './shared';

// Shared types
export * from './types';
