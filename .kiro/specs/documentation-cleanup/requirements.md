# Requirements Document: Documentation Cleanup and Consolidation

## Introduction

This feature addresses the markdown file clutter in the Armoured Souls project by consolidating, organizing, and archiving documentation while preserving all important information. The current state includes 31 markdown files in the root directory and 167 files in the docs/ folder, many of which are redundant session summaries, implementation logs, and bugfix reports that should be consolidated or archived.

## Glossary

- **Documentation_System**: The collection of markdown files, directories, and organizational structure for project documentation
- **Session_Summary**: A markdown file documenting work completed during a specific development session
- **Implementation_Summary**: A markdown file documenting the implementation details of a feature or fix
- **Bugfix_Report**: A markdown file documenting the resolution of a specific bug
- **Archive**: A storage location for historical documentation that is no longer actively referenced
- **Consolidation**: The process of combining multiple related documents into a single, comprehensive document
- **Root_Directory**: The top-level project directory containing the README.md and other primary files
- **Docs_Directory**: The docs/ folder containing organized project documentation

## Requirements

### Requirement 1: Analyze Current Documentation State

**User Story:** As a developer, I want to analyze the current documentation structure, so that I can identify redundant, outdated, and important files.

#### Acceptance Criteria

1. THE Documentation_System SHALL scan all markdown files in the root directory
2. THE Documentation_System SHALL scan all markdown files in the docs/ directory recursively
3. THE Documentation_System SHALL categorize files by type (session summary, implementation summary, bugfix report, PRD, guide, reference)
4. THE Documentation_System SHALL identify duplicate or overlapping content across files
5. THE Documentation_System SHALL identify files that reference outdated code or features
6. THE Documentation_System SHALL generate a report listing all files with their categories and recommendations

### Requirement 2: Preserve Important Information

**User Story:** As a developer, I want to ensure no important information is lost during cleanup, so that historical context and decisions remain accessible.

#### Acceptance Criteria

1. WHEN a file contains unique implementation details, THEN THE Documentation_System SHALL mark it for preservation
2. WHEN a file contains architectural decisions, THEN THE Documentation_System SHALL mark it for preservation
3. WHEN a file contains bugfix analysis with root cause information, THEN THE Documentation_System SHALL mark it for preservation
4. WHEN a file is a current PRD or active guide, THEN THE Documentation_System SHALL mark it for preservation
5. THE Documentation_System SHALL create a backup of all files before any modifications

### Requirement 3: Consolidate Related Documentation

**User Story:** As a developer, I want related documentation consolidated into comprehensive files, so that I can find information more easily.

#### Acceptance Criteria

1. WHEN multiple session summaries exist for the same feature, THEN THE Documentation_System SHALL consolidate them into a single feature history document
2. WHEN multiple bugfix reports exist for related issues, THEN THE Documentation_System SHALL consolidate them into a single troubleshooting guide
3. WHEN implementation summaries overlap with PRDs, THEN THE Documentation_System SHALL merge implementation status into the PRD
4. THE Documentation_System SHALL maintain chronological order when consolidating time-based documents
5. THE Documentation_System SHALL preserve all unique information from source documents in consolidated files

### Requirement 4: Archive Historical Documentation

**User Story:** As a developer, I want historical documentation archived properly, so that the main directories remain clean while history is preserved.

#### Acceptance Criteria

1. WHEN a session summary is older than 30 days and superseded by newer documentation, THEN THE Documentation_System SHALL move it to the archive
2. WHEN an implementation summary is complete and information is in the PRD, THEN THE Documentation_System SHALL move it to the archive
3. WHEN a bugfix report is resolved and documented elsewhere, THEN THE Documentation_System SHALL move it to the archive
4. THE Documentation_System SHALL maintain the docs/archived/ directory structure with subdirectories by year and month
5. THE Documentation_System SHALL create an archive index file listing all archived documents with descriptions

### Requirement 5: Organize Documentation Structure

**User Story:** As a developer, I want a clear documentation structure, so that I can quickly find the information I need.

#### Acceptance Criteria

1. THE Documentation_System SHALL move all session summaries from root to docs/archived/
2. THE Documentation_System SHALL move all implementation summaries from root to appropriate docs/ subdirectories or archive
3. THE Documentation_System SHALL move all bugfix reports from root to docs/archived/ or consolidate into troubleshooting guides
4. THE Documentation_System SHALL ensure the root directory contains only README.md and CONTRIBUTING.md
5. THE Documentation_System SHALL organize docs/ with clear subdirectories: features/, guides/, reference/, archived/

### Requirement 6: Create Documentation Index

**User Story:** As a developer, I want a comprehensive documentation index, so that I can navigate all project documentation easily.

#### Acceptance Criteria

1. THE Documentation_System SHALL create a docs/INDEX.md file listing all active documentation
2. WHEN listing documentation, THE Documentation_System SHALL organize by category (Getting Started, Features, Guides, Reference, Architecture)
3. WHEN listing documentation, THE Documentation_System SHALL include a brief description for each file
4. THE Documentation_System SHALL indicate the status of each document (Complete, In Progress, Deprecated)
5. THE Documentation_System SHALL include links to archived documentation for historical reference

### Requirement 7: Update Cross-References

**User Story:** As a developer, I want all documentation cross-references updated, so that links remain valid after reorganization.

#### Acceptance Criteria

1. WHEN a file is moved, THE Documentation_System SHALL update all references to that file in other documents
2. WHEN a file is consolidated, THE Documentation_System SHALL update references to point to the new consolidated document
3. WHEN a file is archived, THE Documentation_System SHALL update references to indicate the archive location
4. THE Documentation_System SHALL validate all markdown links after reorganization
5. THE Documentation_System SHALL generate a report of any broken links that require manual review

### Requirement 8: Remove Redundant Files

**User Story:** As a developer, I want redundant files removed, so that the documentation remains concise and maintainable.

#### Acceptance Criteria

1. WHEN two files contain identical content, THEN THE Documentation_System SHALL keep one and remove the other
2. WHEN a file is completely superseded by newer documentation, THEN THE Documentation_System SHALL archive or remove it
3. WHEN a file contains only outdated information with no historical value, THEN THE Documentation_System SHALL remove it after backup
4. THE Documentation_System SHALL require confirmation before removing any files
5. THE Documentation_System SHALL log all file removals with justification

### Requirement 9: Generate Cleanup Report

**User Story:** As a developer, I want a detailed cleanup report, so that I can review all changes made to the documentation.

#### Acceptance Criteria

1. THE Documentation_System SHALL generate a report listing all files moved, consolidated, archived, or removed
2. WHEN generating the report, THE Documentation_System SHALL include before and after file counts
3. WHEN generating the report, THE Documentation_System SHALL include a summary of space saved
4. THE Documentation_System SHALL include recommendations for ongoing documentation maintenance
5. THE Documentation_System SHALL save the report as docs/CLEANUP_REPORT.md

### Requirement 10: Maintain Documentation Quality

**User Story:** As a developer, I want documentation quality maintained during cleanup, so that the resulting documentation is clear and useful.

#### Acceptance Criteria

1. WHEN consolidating files, THE Documentation_System SHALL ensure consistent formatting and style
2. WHEN consolidating files, THE Documentation_System SHALL remove duplicate sections
3. WHEN consolidating files, THE Documentation_System SHALL organize content logically
4. THE Documentation_System SHALL ensure all consolidated documents have clear titles and table of contents
5. THE Documentation_System SHALL validate markdown syntax in all modified files
