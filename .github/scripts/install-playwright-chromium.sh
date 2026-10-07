#!/usr/bin/env bash
# Install Playwright's Chromium for the E2E jobs in ci.yml and deploy.yml.
# Run from app/frontend.
#
# `playwright install --with-deps` always runs `apt-get update` and
# `apt-get install`. When the runner's Ubuntu mirror stalls, apt waits with no
# timeout. On 2026-10-07 that hung the ACC deploy until the 15-minute job
# limit cancelled it before a single test ran.
#
# The GitHub ubuntu-24.04 image ships Google Chrome, so the system libraries
# Chromium needs are normally already installed. This script therefore:
#   1. downloads the browser only (the workflow caches ~/.cache/ms-playwright);
#   2. launches it once to prove the libraries are present;
#   3. falls back to installing system dependencies only if that launch fails,
#      with apt retries/timeouts and an overall time limit so a bad mirror
#      fails the step quickly instead of consuming the whole job.
set -euo pipefail

pnpm exec playwright install chromium

probe_launch() {
  node --input-type=module -e "
    import { chromium } from '@playwright/test';
    const browser = await chromium.launch();
    await browser.close();
  "
}

if probe_launch; then
  echo "Chromium launches with the runner's preinstalled libraries; skipping apt."
  exit 0
fi

echo "Chromium is missing system libraries; installing them via apt with bounded timeouts."
sudo tee /etc/apt/apt.conf.d/99-ci-timeouts > /dev/null <<'APT'
Acquire::Retries "3";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
APT
timeout 300 pnpm exec playwright install-deps chromium

probe_launch
echo "Chromium launches after installing system dependencies."
