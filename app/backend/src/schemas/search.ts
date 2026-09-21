import { z } from 'zod';
import { MAXIMUM_QUERY_LENGTH } from '../services/search/searchTypes';

const SEARCH_QUERY_FIELD_MESSAGE = 'Search query must be a string';
const SEARCH_QUERY_LENGTH_MESSAGE = `Search query cannot exceed ${MAXIMUM_QUERY_LENGTH} characters`;
const SEARCH_QUERY_ONLY_FIELD_MESSAGE = 'Search query may contain only q';

/**
 * Strict request schema for GET /api/search.
 *
 * Trimming happens before the maximum-length check. Deliberately no minimum
 * length is enforced here: a valid short query is handled by the search
 * service/client as an empty grouped response without source access.
 */
const searchQueryObjectSchema = z.object({
  q: z
    .string({ message: SEARCH_QUERY_FIELD_MESSAGE })
    .trim()
    .max(MAXIMUM_QUERY_LENGTH, SEARCH_QUERY_LENGTH_MESSAGE),
});

/**
 * Validate the exact query-key boundary without reflecting arbitrary submitted
 * key names in the player-facing validation message. The object schema itself
 * strips unknown keys only after this check has rejected them.
 */
export const searchQuerySchema = z.preprocess((input: unknown, context) => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    context.addIssue({
      code: 'custom',
      path: ['q'],
      message: SEARCH_QUERY_FIELD_MESSAGE,
    });
    return {};
  }

  const unknownKeys = Object.keys(input).some((key) => key !== 'q');
  if (unknownKeys) {
    context.addIssue({
      code: 'custom',
      path: [],
      message: SEARCH_QUERY_ONLY_FIELD_MESSAGE,
    });
  }

  return input;
}, searchQueryObjectSchema);

export type SearchQuery = z.infer<typeof searchQuerySchema>;
