// Common/utility services barrel file

// Event logging
export { EventLogger, EventType, clearSequenceCache } from './eventLogger';

// Event compression
export { stripDebugFields, compressEventsForStorage, estimateEventSize, estimateEventsMemory, logEventMemoryStats } from './eventCompression';

// Data integrity
export { DataIntegrityService } from './dataIntegrityService';
export type { IntegrityIssue, IntegrityReport } from './dataIntegrityService';

// Query service
export { QueryService } from './queryService';
export type { EventFilters, AuditLogEntry, QueryResult } from './queryService';

// Reset service
export { validateResetEligibility, performAccountReset, getResetHistory } from './resetService';
export type { ResetBlocker, ResetEligibility, ResetHistoryEntry } from './resetService';

// Markdown parser
export { slugify, extractHeadings, stripMarkdown, validateFrontmatter, parseMarkdown } from './markdown-parser';
export type { ArticleHeading, ArticleFrontmatter, ParsedArticle } from './markdown-parser';

// Guide service
export { GuideService } from './guide-service';
export type { GuideArticleSummary, GuideSection, GuideArticleLink, RelatedArticleLink, GuideArticle, SearchIndexEntry } from './guide-service';
