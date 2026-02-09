# Design Document: Documentation Cleanup and Consolidation

## Overview

The Documentation Cleanup system is a command-line tool that analyzes, consolidates, and organizes markdown documentation in the Armoured Souls project. The system will scan all markdown files, categorize them, identify redundancies, consolidate related content, archive historical documents, and reorganize the documentation structure while preserving all important information.

The tool operates in multiple phases:
1. **Analysis Phase**: Scan and categorize all markdown files
2. **Planning Phase**: Generate a cleanup plan with recommendations
3. **Execution Phase**: Perform file operations (move, consolidate, archive, remove)
4. **Validation Phase**: Verify links and generate reports

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Interface                         │
│  (User commands, confirmations, progress display)        │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                 Orchestrator                             │
│  (Coordinates phases, manages state)                     │
└─┬──────────┬──────────┬──────────┬──────────┬──────────┘
  │          │          │          │          │
  ▼          ▼          ▼          ▼          ▼
┌───────┐ ┌──────┐ ┌──────────┐ ┌────────┐ ┌──────────┐
│Scanner│ │Cate- │ │Consoli-  │ │File    │ │Report    │
│       │ │gorizer│ │dator     │ │Manager │ │Generator │
└───────┘ └──────┘ └──────────┘ └────────┘ └──────────┘
    │         │          │          │          │
    └─────────┴──────────┴──────────┴──────────┘
                      │
              ┌───────▼────────┐
              │  File System   │
              │  (Read/Write)  │
              └────────────────┘
```

### Component Responsibilities

**CLI Interface**:
- Parse command-line arguments
- Display progress and status messages
- Request user confirmations for destructive operations
- Show interactive prompts for decisions

**Orchestrator**:
- Coordinate execution of all phases
- Maintain cleanup state and context
- Handle errors and rollback if needed
- Generate final summary

**Scanner**:
- Recursively scan directories for markdown files
- Extract file metadata (size, date, location)
- Read file content for analysis
- Build file inventory

**Categorizer**:
- Analyze file content and naming patterns
- Classify files by type (session, implementation, bugfix, PRD, guide, reference)
- Identify relationships between files
- Detect duplicate or overlapping content

**Consolidator**:
- Merge related documents
- Preserve unique information from all sources
- Maintain chronological order
- Generate consolidated documents with proper formatting

**File Manager**:
- Execute file operations (move, copy, delete)
- Create directory structures
- Maintain backups
- Update file references and links

**Report Generator**:
- Generate analysis reports
- Create cleanup summaries
- Document all changes made
- Provide recommendations

## Components and Interfaces

### Scanner Component

```typescript
interface FileMetadata {
  path: string;
  name: string;
  size: number;
  created: Date;
  modified: Date;
  content: string;
  lineCount: number;
}

interface ScanResult {
  files: FileMetadata[];
  totalSize: number;
  directories: string[];
}

class Scanner {
  scanDirectory(path: string, recursive: boolean): ScanResult;
  readMarkdownFile(path: string): FileMetadata;
  filterMarkdownFiles(files: string[]): string[];
}
```

### Categorizer Component

```typescript
enum DocumentType {
  SESSION_SUMMARY = 'session_summary',
  IMPLEMENTATION_SUMMARY = 'implementation_summary',
  BUGFIX_REPORT = 'bugfix_report',
  PRD = 'prd',
  GUIDE = 'guide',
  REFERENCE = 'reference',
  ARCHITECTURE = 'architecture',
  UNKNOWN = 'unknown'
}

enum DocumentStatus {
  ACTIVE = 'active',
  OUTDATED = 'outdated',
  SUPERSEDED = 'superseded',
  DUPLICATE = 'duplicate'
}

interface CategorizedFile {
  metadata: FileMetadata;
  type: DocumentType;
  status: DocumentStatus;
  relatedFiles: string[];
  importance: number; // 0-10 scale
  recommendation: CleanupAction;
}

enum CleanupAction {
  KEEP = 'keep',
  ARCHIVE = 'archive',
  CONSOLIDATE = 'consolidate',
  REMOVE = 'remove'
}

class Categorizer {
  categorizeFile(file: FileMetadata): CategorizedFile;
  detectDocumentType(content: string, filename: string): DocumentType;
  assessImportance(file: FileMetadata, type: DocumentType): number;
  findRelatedFiles(file: CategorizedFile, allFiles: CategorizedFile[]): string[];
  detectDuplicates(files: CategorizedFile[]): Map<string, string[]>;
}
```

### Consolidator Component

```typescript
interface ConsolidationGroup {
  targetName: string;
  sourceFiles: CategorizedFile[];
  consolidationType: 'chronological' | 'topical' | 'merge';
}

interface ConsolidatedDocument {
  path: string;
  content: string;
  sourceFiles: string[];
  metadata: {
    title: string;
    created: Date;
    lastUpdated: Date;
    contributors: string[];
  };
}

class Consolidator {
  identifyConsolidationGroups(files: CategorizedFile[]): ConsolidationGroup[];
  consolidateChronological(group: ConsolidationGroup): ConsolidatedDocument;
  consolidateTopical(group: ConsolidationGroup): ConsolidatedDocument;
  mergeDocuments(group: ConsolidationGroup): ConsolidatedDocument;
  extractUniqueContent(files: FileMetadata[]): string[];
  generateTableOfContents(content: string): string;
}
```

### File Manager Component

```typescript
interface FileOperation {
  type: 'move' | 'copy' | 'delete' | 'create';
  source: string;
  destination?: string;
  content?: string;
}

interface BackupManifest {
  timestamp: Date;
  operations: FileOperation[];
  backupPath: string;
}

class FileManager {
  createBackup(files: string[]): BackupManifest;
  executeOperation(operation: FileOperation): boolean;
  rollback(manifest: BackupManifest): boolean;
  updateReferences(oldPath: string, newPath: string, files: string[]): void;
  validateLinks(files: string[]): Map<string, string[]>; // file -> broken links
  createDirectory(path: string): boolean;
}
```

### Report Generator Component

```typescript
interface CleanupReport {
  summary: {
    filesScanned: number;
    filesArchived: number;
    filesConsolidated: number;
    filesRemoved: number;
    spaceSaved: number;
  };
  operations: FileOperation[];
  brokenLinks: Map<string, string[]>;
  recommendations: string[];
}

interface AnalysisReport {
  filesByType: Map<DocumentType, number>;
  filesByStatus: Map<DocumentStatus, number>;
  duplicates: Map<string, string[]>;
  consolidationOpportunities: ConsolidationGroup[];
  largestFiles: FileMetadata[];
}

class ReportGenerator {
  generateAnalysisReport(files: CategorizedFile[]): AnalysisReport;
  generateCleanupReport(operations: FileOperation[], results: any): CleanupReport;
  formatReportAsMarkdown(report: CleanupReport | AnalysisReport): string;
  saveReport(report: string, path: string): boolean;
}
```

## Data Models

### File Classification Rules

The categorizer uses pattern matching and content analysis to classify files:

**Session Summary Detection**:
- Filename patterns: `SESSION_SUMMARY_*.md`, `*_SESSION_*.md`
- Content markers: "Session Summary", "What Was Accomplished", "Date:", "Status:"
- Typical sections: Commits, Changes, Testing, Next Steps

**Implementation Summary Detection**:
- Filename patterns: `IMPLEMENTATION_SUMMARY_*.md`, `*_IMPLEMENTATION_*.md`, `*_COMPLETE.md`
- Content markers: "Implementation Summary", "Files Modified", "Changes Made"
- Typical sections: Overview, Changes, Testing, Metrics

**Bugfix Report Detection**:
- Filename patterns: `BUGFIX_*.md`, `FIX_*.md`, `*_FIX_*.md`
- Content markers: "Bug Fix", "Problem Statement", "Root Cause", "Resolution"
- Typical sections: Investigation, The Bug, The Fix, Testing

**PRD Detection**:
- Filename patterns: `PRD_*.md`
- Content markers: "Product Requirements", "User Story", "Acceptance Criteria"
- Typical sections: Overview, Requirements, Success Criteria

**Guide Detection**:
- Filename patterns: `*_GUIDE.md`, `*_TESTING_*.md`, `QUICK_REFERENCE_*.md`
- Content markers: "Guide", "How to", "Instructions", "Quick Reference"
- Typical sections: Setup, Usage, Examples

**Reference Detection**:
- Filename patterns: `*_REFERENCE.md`, `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`
- Content markers: "Reference", "Schema", "API", "Architecture"
- Typical sections: Definitions, Specifications, Diagrams

### Consolidation Strategies

**Chronological Consolidation** (for session summaries):
```markdown
# Feature Name - Development History

## Session 1: Initial Implementation (Date)
[Content from first session]

## Session 2: Bug Fixes (Date)
[Content from second session]

## Session 3: Enhancements (Date)
[Content from third session]

## Summary
- Total sessions: 3
- Total commits: 15
- Key achievements: [list]
```

**Topical Consolidation** (for related features):
```markdown
# Feature Name - Complete Documentation

## Overview
[Combined overview from all sources]

## Implementation Details
[Merged implementation information]

## Testing
[Combined testing information]

## Known Issues
[Consolidated issues and resolutions]
```

**Merge Consolidation** (for PRD + implementation):
```markdown
# Feature Name - PRD

## Requirements
[Original requirements]

## Implementation Status
✅ Requirement 1: Implemented in v1.2
✅ Requirement 2: Implemented in v1.0
⏳ Requirement 3: In progress

## Implementation Notes
[Key implementation details from summaries]
```

### Archive Organization

```
docs/archived/
├── 2026/
│   ├── 01-january/
│   │   ├── session-summaries/
│   │   ├── implementation-summaries/
│   │   └── bugfix-reports/
│   ├── 02-february/
│   │   ├── session-summaries/
│   │   ├── implementation-summaries/
│   │   └── bugfix-reports/
├── 2025/
│   └── ...
└── INDEX.md  # Archive index with descriptions
```

### Documentation Structure (Target)

```
docs/
├── INDEX.md                    # Main documentation index
├── getting-started/
│   ├── README.md
│   ├── SETUP.md
│   └── QUICK_START.md
├── features/
│   ├── battle-history/
│   │   ├── PRD.md
│   │   ├── GUIDE.md
│   │   └── HISTORY.md
│   ├── income-dashboard/
│   │   ├── PRD.md
│   │   ├── GUIDE.md
│   │   └── HISTORY.md
│   └── ...
├── guides/
│   ├── TESTING_GUIDE.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── TROUBLESHOOTING.md
├── reference/
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_REFERENCE.md
│   └── DESIGN_SYSTEM.md
├── archived/
│   ├── 2026/
│   ├── 2025/
│   └── INDEX.md
└── brand/
    └── ...
```

## CLI Design

### Command Structure

```bash
# Analyze documentation (dry run)
npm run docs:analyze

# Generate cleanup plan
npm run docs:plan

# Execute cleanup (with confirmation)
npm run docs:cleanup

# Execute cleanup (auto-confirm)
npm run docs:cleanup --yes

# Rollback last cleanup
npm run docs:rollback

# Validate links
npm run docs:validate
```

### Interactive Flow

```
$ npm run docs:cleanup

📚 Documentation Cleanup Tool
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase 1: Scanning files...
✓ Found 198 markdown files
✓ Root directory: 31 files
✓ Docs directory: 167 files

Phase 2: Analyzing content...
✓ Categorized 198 files
  - Session summaries: 15
  - Implementation summaries: 12
  - Bugfix reports: 8
  - PRDs: 25
  - Guides: 18
  - Reference docs: 20
  - Other: 100

Phase 3: Identifying actions...
✓ Files to archive: 35
✓ Files to consolidate: 18 → 6 documents
✓ Files to remove: 5 (duplicates)
✓ Files to keep: 140

Cleanup Plan:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Archive:
  • 15 session summaries → docs/archived/2026/02-february/
  • 12 implementation summaries → docs/archived/2026/02-february/
  • 8 bugfix reports → docs/archived/2026/02-february/

Consolidate:
  • Battle History (3 sessions) → docs/features/battle-history/HISTORY.md
  • Income Dashboard (3 sessions) → docs/features/income-dashboard/HISTORY.md
  • Economy System (4 docs) → docs/features/economy/COMPLETE.md

Remove:
  • VISUAL_COMPARISON.md (duplicate of archived version)
  • TEST_COVERAGE_ANALYSIS.md (superseded by TESTING_STRATEGY.md)
  • [3 more files...]

Space savings: ~2.5 MB → ~800 KB (68% reduction)

⚠️  This will modify 58 files. A backup will be created.

Continue? (y/N): 
```

## Error Handling

### Error Categories

**File System Errors**:
- Permission denied
- File not found
- Disk space issues
- Backup creation failures

**Content Errors**:
- Invalid markdown syntax
- Broken links
- Missing required sections
- Encoding issues

**Logic Errors**:
- Circular references
- Conflicting consolidation groups
- Invalid categorization

### Error Recovery

**Backup Strategy**:
1. Create timestamped backup before any operations
2. Store backup manifest with all planned operations
3. Provide rollback command to restore from backup
4. Keep backups for 30 days

**Validation Strategy**:
1. Dry-run mode to preview all changes
2. Validate all operations before execution
3. Check for broken links after moves
4. Verify markdown syntax after consolidation

**Rollback Strategy**:
```typescript
class ErrorHandler {
  handleError(error: Error, context: OperationContext): void {
    // Log error with context
    logger.error(error, context);
    
    // Attempt automatic recovery
    if (this.canRecover(error)) {
      this.recover(context);
    } else {
      // Prompt user for rollback
      this.promptRollback(context.backupManifest);
    }
  }
  
  recover(context: OperationContext): void {
    // Undo last operation
    // Continue with remaining operations
  }
  
  rollback(manifest: BackupManifest): void {
    // Restore all files from backup
    // Delete any created files
    // Restore original state
  }
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to avoid redundancy:

- Properties 5.1, 5.2, 5.3 (moving specific file types) can be combined into a single property about file relocation based on type
- Properties 7.1, 7.2, 7.3 (updating references) can be combined into a single property about reference updates
- Properties 2.1, 2.2, 2.3, 2.4 (marking for preservation) can be combined into a single property about preservation logic
- Properties 3.1, 3.2, 3.3 (consolidation strategies) are distinct and should remain separate
- Properties 6.2, 6.3, 6.4, 6.5 (index content) can be combined into a single property about index completeness

### Core Properties

**Property 1: Complete File Discovery**
*For any* markdown file in the project directory tree, the scanner should discover and include it in the file inventory, regardless of directory depth or location.
**Validates: Requirements 1.1, 1.2**

**Property 2: Correct File Categorization**
*For any* markdown file with recognizable patterns (filename or content markers), the categorizer should assign the correct document type based on the classification rules.
**Validates: Requirements 1.3**

**Property 3: Duplicate Detection**
*For any* pair of files with identical or highly similar content (>90% similarity), the system should identify them as duplicates.
**Validates: Requirements 1.4**

**Property 4: Report Completeness**
*For any* analysis run, the generated report should include all discovered files with their assigned categories and recommendations.
**Validates: Requirements 1.6**

**Property 5: Preservation of Important Content**
*For any* file containing unique implementation details, architectural decisions, root cause analysis, or being an active PRD/guide, the system should mark it for preservation rather than removal.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

**Property 6: Backup Before Modification**
*For any* cleanup operation that modifies files, a complete backup should be created before any changes are made, and the backup should contain all original file contents.
**Validates: Requirements 2.5**

**Property 7: Chronological Consolidation Preserves Order**
*For any* set of time-based documents being consolidated, the resulting document should maintain chronological order from oldest to newest.
**Validates: Requirements 3.4**

**Property 8: Consolidation Preserves Unique Information**
*For any* consolidation operation, all unique content from source documents should appear in the consolidated output (no information loss).
**Validates: Requirements 3.5**

**Property 9: Session Summary Consolidation**
*For any* set of session summaries related to the same feature, the system should consolidate them into a single feature history document with chronological sections.
**Validates: Requirements 3.1**

**Property 10: Bugfix Report Consolidation**
*For any* set of related bugfix reports, the system should consolidate them into a troubleshooting guide organized by issue type.
**Validates: Requirements 3.2**

**Property 11: Implementation Status Merging**
*For any* implementation summary that overlaps with a PRD, the system should merge the implementation status into the PRD document.
**Validates: Requirements 3.3**

**Property 12: Age-Based Archival**
*For any* session summary older than 30 days that is superseded by newer documentation, the system should move it to the archive with correct year/month structure.
**Validates: Requirements 4.1**

**Property 13: Redundancy-Based Archival**
*For any* implementation summary or bugfix report whose information is fully covered in other active documentation, the system should move it to the archive.
**Validates: Requirements 4.2, 4.3**

**Property 14: Archive Directory Structure**
*For any* file being archived, the system should place it in the correct docs/archived/YYYY/MM-month/ subdirectory based on the file's date.
**Validates: Requirements 4.4**

**Property 15: Archive Index Generation**
*For any* archival operation, the system should update or create an archive index file that lists all archived documents with descriptions.
**Validates: Requirements 4.5**

**Property 16: File Type Relocation**
*For any* file of type session summary, implementation summary, or bugfix report in the root directory, the system should move it to the appropriate docs/ subdirectory or archive.
**Validates: Requirements 5.1, 5.2, 5.3**

**Property 17: Root Directory Cleanup**
*For any* cleanup operation, the final state of the root directory should contain only README.md and CONTRIBUTING.md (all other markdown files moved).
**Validates: Requirements 5.4**

**Property 18: Documentation Structure Creation**
*For any* cleanup operation, the system should ensure the docs/ directory contains the required subdirectories: features/, guides/, reference/, and archived/.
**Validates: Requirements 5.5**

**Property 19: Index File Completeness**
*For any* generated documentation index, it should include all active documentation files organized by category, with descriptions, status indicators, and links to archived docs.
**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

**Property 20: Reference Update on File Operations**
*For any* file that is moved, consolidated, or archived, all references to that file in other documents should be updated to point to the new location or consolidated document.
**Validates: Requirements 7.1, 7.2, 7.3**

**Property 21: Link Validation**
*For any* cleanup operation, after all file operations are complete, the system should validate all markdown links and identify any broken links.
**Validates: Requirements 7.4**

**Property 22: Broken Link Reporting**
*For any* link validation that finds broken links, the system should generate a report listing all broken links by file for manual review.
**Validates: Requirements 7.5**

**Property 23: Duplicate File Removal**
*For any* pair of files with identical content, the system should keep one file and remove the other (after backup).
**Validates: Requirements 8.1**

**Property 24: Superseded File Archival**
*For any* file that is completely superseded by newer documentation, the system should archive or remove it (with backup).
**Validates: Requirements 8.2**

**Property 25: Removal Logging**
*For any* file removal operation, the system should log the removal with the file path and justification in the cleanup report.
**Validates: Requirements 8.5**

**Property 26: Cleanup Report Generation**
*For any* cleanup operation, the system should generate a report listing all files moved, consolidated, archived, or removed, with before/after counts and space savings.
**Validates: Requirements 9.1, 9.2, 9.3**

**Property 27: Maintenance Recommendations**
*For any* cleanup report, the system should include recommendations for ongoing documentation maintenance based on patterns observed.
**Validates: Requirements 9.4**

**Property 28: Duplicate Section Removal**
*For any* consolidation operation, the resulting document should not contain duplicate sections (same heading and content appearing multiple times).
**Validates: Requirements 10.2**

**Property 29: Consolidated Document Structure**
*For any* consolidated document, it should have a clear title and table of contents at the beginning.
**Validates: Requirements 10.4**

**Property 30: Markdown Syntax Validation**
*For any* file modified during cleanup (consolidation, reference updates, etc.), the system should validate that the resulting markdown syntax is correct.
**Validates: Requirements 10.5**

## Testing Strategy

### Dual Testing Approach

The Documentation Cleanup system will use both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** will focus on:
- Specific file categorization examples (e.g., "SESSION_SUMMARY_BATTLE_HISTORY.md" → SESSION_SUMMARY type)
- Edge cases (empty files, malformed markdown, special characters in filenames)
- Error conditions (permission denied, disk full, invalid paths)
- CLI interaction flows (confirmation prompts, progress display)
- Specific consolidation examples with known inputs and outputs

**Property-Based Tests** will focus on:
- Universal properties that hold for all inputs (file discovery, categorization, consolidation)
- Comprehensive input coverage through randomization (various file structures, content patterns)
- Invariants that must hold after operations (no information loss, correct directory structure)
- Reference integrity across all file operations

### Property-Based Testing Configuration

**Testing Library**: We will use **fast-check** for TypeScript property-based testing.

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `// Feature: documentation-cleanup, Property N: [property text]`

**Example Property Test Structure**:
```typescript
import fc from 'fast-check';

describe('Documentation Cleanup - Property Tests', () => {
  it('Property 1: Complete File Discovery', () => {
    // Feature: documentation-cleanup, Property 1: Complete File Discovery
    fc.assert(
      fc.property(
        fc.array(fc.record({
          path: fc.string(),
          name: fc.string().filter(s => s.endsWith('.md')),
          content: fc.string()
        })),
        (files) => {
          // Create temporary directory structure with files
          const tempDir = createTempDirectory(files);
          
          // Run scanner
          const result = scanner.scanDirectory(tempDir, true);
          
          // Verify all files discovered
          expect(result.files.length).toBe(files.length);
          expect(result.files.map(f => f.name).sort())
            .toEqual(files.map(f => f.name).sort());
          
          // Cleanup
          removeTempDirectory(tempDir);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('Property 8: Consolidation Preserves Unique Information', () => {
    // Feature: documentation-cleanup, Property 8: Consolidation Preserves Unique Information
    fc.assert(
      fc.property(
        fc.array(fc.record({
          content: fc.string(),
          uniqueMarker: fc.string()
        }), { minLength: 2, maxLength: 5 }),
        (sourceFiles) => {
          // Create files with unique markers
          const files = sourceFiles.map((f, i) => ({
            ...createMockFile(),
            content: `${f.content}\n\nUNIQUE_${f.uniqueMarker}_${i}`
          }));
          
          // Consolidate
          const consolidated = consolidator.consolidateChronological({
            targetName: 'test-consolidated.md',
            sourceFiles: files,
            consolidationType: 'chronological'
          });
          
          // Verify all unique markers present
          sourceFiles.forEach((f, i) => {
            expect(consolidated.content).toContain(`UNIQUE_${f.uniqueMarker}_${i}`);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Coverage Goals

- **Unit Test Coverage**: 80%+ of code paths
- **Property Test Coverage**: All 30 correctness properties implemented
- **Integration Tests**: End-to-end cleanup scenarios with real file structures
- **Error Handling Tests**: All error conditions and recovery paths

### Testing Phases

**Phase 1: Component Testing**
- Test each component in isolation (Scanner, Categorizer, Consolidator, etc.)
- Mock file system operations for fast execution
- Focus on logic correctness

**Phase 2: Integration Testing**
- Test components working together
- Use temporary directories with real file operations
- Verify end-to-end workflows

**Phase 3: Property Testing**
- Implement all 30 property-based tests
- Run with 100+ iterations each
- Verify invariants hold across random inputs

**Phase 4: Manual Testing**
- Run on actual project documentation
- Verify cleanup results manually
- Test rollback functionality
- Validate generated reports

