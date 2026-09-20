import {
  GuideSearchResult,
  GuideSearchSource,
  RobotSearchResult,
  RobotSearchSource,
  StableSearchResult,
  StableSearchSource,
} from './searchTypes';

/**
 * Trims an optional display value and omits it when it has no visible content.
 *
 * Search references deliberately do not fall back to account identifiers when
 * a stable name is absent. This keeps the response limited to the approved
 * display fields and preserves the stable-name eligibility rule.
 */
function trimOptionalDisplayValue(value: string | null): string | undefined {
  const trimmedValue = value?.trim() ?? '';
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

/**
 * Builds the allow-listed robot reference used by the search response.
 *
 * The source may contain additional private fields at runtime, but only the
 * robot identity, display name, and optional named-stable subtitle are copied.
 */
export function buildRobotSearchResult(source: RobotSearchSource): RobotSearchResult {
  const subtitle = trimOptionalDisplayValue(source.stableName);

  return subtitle === undefined
    ? {
        category: 'robots',
        id: source.id,
        label: source.name,
      }
    : {
        category: 'robots',
        id: source.id,
        label: source.name,
        subtitle,
      };
}

/**
 * Builds the allow-listed stable reference used by the search response.
 *
 * A stable is eligible only when its trimmed stable name is non-empty. The
 * function intentionally does not inspect username, profile visibility, or
 * generated-account metadata, so named generated/test stables remain eligible.
 */
export function buildStableSearchResult(source: StableSearchSource): StableSearchResult | null {
  const label = trimOptionalDisplayValue(source.stableName);

  if (label === undefined) {
    return null;
  }

  return {
    category: 'stables',
    userId: source.userId,
    label,
  };
}

/**
 * Builds the allow-listed guide reference used by the search response.
 *
 * Guide body and description text are search-only source fields and are never
 * copied to the player-facing reference. The existing guide-index slug is the
 * article identity used with its section slug by the client route builder.
 */
export function buildGuideSearchResult(source: GuideSearchSource): GuideSearchResult {
  return {
    category: 'guide',
    title: source.title,
    sectionTitle: source.sectionTitle,
    sectionSlug: source.sectionSlug,
    articleSlug: source.slug,
  };
}
