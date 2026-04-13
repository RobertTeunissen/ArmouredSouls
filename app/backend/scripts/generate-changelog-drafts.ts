/**
 * Auto-Generator Script: Changelog Draft Entries
 *
 * Runs as a post-deploy step in GitHub Actions.
 * Scans git commits and completed specs since the last deploy tag,
 * then creates draft changelog entries via the admin API.
 *
 * Environment variables:
 *   CHANGELOG_API_URL  — Base URL for the changelog admin API
 *   CHANGELOG_DEPLOY_TOKEN — Deploy service token for Authorization header
 *
 * Usage:
 *   npx ts-node app/backend/scripts/generate-changelog-drafts.ts
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftEntry {
  title: string;
  body: string;
  category: 'balance' | 'feature' | 'bugfix' | 'economy';
  status: 'draft';
  sourceType: 'spec' | 'commit';
  sourceRef: string;
}

interface CommitInfo {
  sha: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Core exported functions (testable independently)
// ---------------------------------------------------------------------------

/**
 * Categorize a spec based on its directory name.
 * - Contains "fix" or "bug" → bugfix
 * - Contains "balance" → balance
 * - Otherwise → feature
 */
export function categorizeSpec(specName: string): 'bugfix' | 'balance' | 'feature' {
  const lower = specName.toLowerCase();
  if (lower.includes('fix') || lower.includes('bug')) {
    return 'bugfix';
  }
  if (lower.includes('balance')) {
    return 'balance';
  }
  return 'feature';
}

/**
 * Parse git log output into structured commit objects.
 * Each line is expected in the format: "<sha> <message>"
 */
export function parseCommits(gitLogOutput: string): CommitInfo[] {
  if (!gitLogOutput.trim()) return [];
  return gitLogOutput
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx === -1) return { sha: line.trim(), message: '' };
      return {
        sha: line.substring(0, spaceIdx).trim(),
        message: line.substring(spaceIdx + 1).trim(),
      };
    });
}

/**
 * Generate draft entries from completed specs and commits.
 * Checks existingSourceRefs to ensure idempotency (no duplicates).
 */
export function generateDrafts(
  specDirs: string[],
  commits: CommitInfo[],
  existingSourceRefs: Set<string>,
  readSpecIntro: (specDir: string) => string,
): DraftEntry[] {
  const drafts: DraftEntry[] = [];

  // One draft per completed spec
  for (const specDir of specDirs) {
    const specName = path.basename(specDir);
    if (existingSourceRefs.has(specName)) continue;

    const intro = readSpecIntro(specDir);
    const category = categorizeSpec(specName);

    // Strip leading number prefix for a cleaner title (e.g., "24-in-game-changelog" → "in-game-changelog")
    const titleBase = specName.replace(/^\d+-/, '');
    const title = titleBase
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    drafts.push({
      title,
      body: intro || `Changes from spec: ${specName}`,
      category,
      status: 'draft',
      sourceType: 'spec',
      sourceRef: specName,
    });
  }

  // Filter out commits that are spec-related (already covered above)
  const nonSpecCommits = commits.filter(
    (c) => !c.message.toLowerCase().includes('[spec]'),
  );

  if (nonSpecCommits.length > 0) {
    const firstSha = nonSpecCommits[0].sha.substring(0, 7);
    const lastSha = nonSpecCommits[nonSpecCommits.length - 1].sha.substring(0, 7);
    const sourceRef = `${firstSha}..${lastSha}`;

    if (!existingSourceRefs.has(sourceRef)) {
      const deployDate = new Date().toISOString().split('T')[0];
      const groupedMessages = nonSpecCommits
        .map((c) => `- ${c.message}`)
        .join('\n');

      drafts.push({
        title: `Deploy ${deployDate}`,
        body: `Commits included in this deploy:\n${groupedMessages}`,
        category: 'bugfix',
        status: 'draft',
        sourceType: 'commit',
        sourceRef,
      });
    }
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function getLastDeployTag(): string {
  try {
    const tag = execSync(
      'git tag --sort=-creatordate | grep -E "^deploy-(acc|prd)-" | head -n 1',
      { encoding: 'utf-8' },
    ).trim();
    return tag;
  } catch {
    throw new Error('Failed to find last deploy tag');
  }
}

function getCommitsSinceTag(tag: string): string {
  try {
    return execSync(`git log --oneline ${tag}..HEAD`, {
      encoding: 'utf-8',
    }).trim();
  } catch {
    throw new Error(`Failed to get commits since tag ${tag}`);
  }
}

function getSpecDirsSinceTag(tag: string): string[] {
  try {
    const output = execSync(
      `git diff --name-only ${tag}..HEAD -- .kiro/specs/done-*`,
      { encoding: 'utf-8' },
    ).trim();
    if (!output) return [];

    // Extract unique spec directory names
    const dirs = new Set<string>();
    for (const filePath of output.split('\n')) {
      // e.g., ".kiro/specs/done-april26/5-some-spec/requirements.md"
      const parts = filePath.split('/');
      if (parts.length >= 4) {
        dirs.add(parts.slice(0, 4).join('/'));
      }
    }
    return Array.from(dirs);
  } catch {
    throw new Error(`Failed to get spec dirs since tag ${tag}`);
  }
}

function readSpecIntroduction(specDir: string): string {
  const reqPath = path.join(specDir, 'requirements.md');
  try {
    const content = fs.readFileSync(reqPath, 'utf-8');
    // Extract the introduction section (text between "## Introduction" and the next "##")
    const introMatch = content.match(
      /## Introduction\s*\n([\s\S]*?)(?=\n## |\n#[^#]|$)/,
    );
    if (introMatch) {
      return introMatch[1].trim().substring(0, 500);
    }
    return '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 1,
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    if (retries > 0) {
      console.log('Network error, retrying in 5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

async function createDraftEntry(
  apiUrl: string,
  token: string,
  draft: DraftEntry,
): Promise<boolean> {
  try {
    const response = await fetchWithRetry(
      `${apiUrl}/api/changelog/admin`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draft),
      },
    );

    if (!response.ok) {
      console.error(
        `Failed to create draft "${draft.title}": ${response.status} ${response.statusText}`,
      );
      return false;
    }

    console.log(`✓ Created draft: "${draft.title}" [${draft.category}]`);
    return true;
  } catch (error) {
    console.error(`Failed to create draft "${draft.title}":`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const apiUrl = process.env.CHANGELOG_API_URL;
  const token = process.env.CHANGELOG_DEPLOY_TOKEN;

  if (!apiUrl || !token) {
    console.error(
      'Missing required environment variables: CHANGELOG_API_URL, CHANGELOG_DEPLOY_TOKEN',
    );
    process.exit(1);
  }

  // 1. Find last deploy tag
  let tag: string;
  try {
    tag = getLastDeployTag();
  } catch (error) {
    console.error('Git operation failed:', error);
    process.exit(1);
  }

  if (!tag) {
    console.log('No deploy tag found. Skipping changelog generation.');
    return;
  }

  console.log(`Last deploy tag: ${tag}`);

  // 2. Get commits and spec dirs since tag
  let commitOutput: string;
  let specDirs: string[];
  try {
    commitOutput = getCommitsSinceTag(tag);
    specDirs = getSpecDirsSinceTag(tag);
  } catch (error) {
    console.error('Git operation failed:', error);
    process.exit(1);
  }

  const commits = parseCommits(commitOutput);

  // 3. Skip if nothing new
  if (specDirs.length === 0 && commits.length === 0) {
    console.log('No new specs or commits found. Skipping.');
    return;
  }

  console.log(`Found ${specDirs.length} spec(s) and ${commits.length} commit(s)`);

  // 4. Fetch existing sourceRefs for idempotency
  let existingSourceRefs = new Set<string>();
  try {
    const response = await fetchWithRetry(
      `${apiUrl}/api/changelog/admin?page=1&perPage=100`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (response.ok) {
      const data = (await response.json()) as {
        entries: Array<{ sourceRef?: string | null }>;
      };
      if (data.entries) {
        for (const entry of data.entries) {
          if (entry.sourceRef) {
            existingSourceRefs.add(entry.sourceRef);
          }
        }
      }
    }
  } catch {
    console.warn('Could not fetch existing entries for idempotency check.');
  }

  // 5. Generate drafts
  const drafts = generateDrafts(
    specDirs,
    commits,
    existingSourceRefs,
    readSpecIntroduction,
  );

  if (drafts.length === 0) {
    console.log('No new drafts to create (all already exist).');
    return;
  }

  // 6. Create drafts via API
  let successCount = 0;
  for (const draft of drafts) {
    const ok = await createDraftEntry(apiUrl, token, draft);
    if (ok) successCount++;
  }

  console.log(
    `\n✅ Created ${successCount}/${drafts.length} changelog draft(s).`,
  );
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
