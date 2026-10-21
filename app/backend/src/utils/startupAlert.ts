/**
 * Startup failure alerts, sent once per failure rather than once per restart.
 *
 * A failed startup check exits the process, and PM2 restarts it (up to
 * `max_restarts: 10`, 5 s apart). Each restart failed the same check and
 * posted the same "STARTUP FAILED" alert, so one broken build produced ten
 * identical Discord messages. The process cannot remember across restarts, so
 * the last alert sent is kept in a small state file in the OS temp directory.
 *
 * The same message within STARTUP_ALERT_REPEAT_MS is suppressed (logged only);
 * a different message, or the same one after the window, is sent. Any state
 * read or write problem degrades toward sending: a startup failure must never
 * go unreported because a temp file was unreadable.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import logger from '../config/logger';
import { sendMonitoringAlert } from './monitoringWebhook';

/** Same-message suppression window: PM2's restart burst is about a minute. */
export const STARTUP_ALERT_REPEAT_MS = 60 * 60 * 1000;

interface StartupAlertState {
  message: string;
  sentAt: number;
}

/** Where the last sent startup alert is remembered. */
export interface StartupAlertStore {
  read(): string | null;
  write(content: string): void;
}

function fileStore(file: string): StartupAlertStore {
  return {
    read: () => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null),
    write: (content) => fs.writeFileSync(file, content, 'utf8'),
  };
}

export interface StartupAlertDependencies {
  store?: StartupAlertStore;
  now?: () => number;
  send?: (message: string) => Promise<boolean>;
}

function parseState(raw: string | null): StartupAlertState | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StartupAlertState>;
    return typeof parsed.message === 'string' && typeof parsed.sentAt === 'number'
      ? { message: parsed.message, sentAt: parsed.sentAt }
      : null;
  } catch {
    return null;
  }
}

/**
 * Send a startup failure alert unless the same message was sent within
 * STARTUP_ALERT_REPEAT_MS. Never throws.
 *
 * @returns true when the alert was sent now
 */
export async function sendStartupFailureAlert(message: string, deps: StartupAlertDependencies = {}): Promise<boolean> {
  const store = deps.store ?? fileStore(path.join(os.tmpdir(), 'armouredsouls-startup-alert.json'));
  const now = (deps.now ?? Date.now)();
  const send = deps.send ?? sendMonitoringAlert;

  let last: StartupAlertState | null = null;
  try {
    last = parseState(store.read());
  } catch (error) {
    logger.warn(`[startup-alert] Could not read the last startup alert; sending: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (last && last.message === message && now - last.sentAt < STARTUP_ALERT_REPEAT_MS) {
    const minutes = Math.round((now - last.sentAt) / 60_000);
    logger.warn(`[startup-alert] Same startup failure already alerted ${minutes} min ago; not sending again: ${message}`);
    return false;
  }

  const sent = await send(message);
  if (sent) {
    try {
      store.write(JSON.stringify({ message, sentAt: now } satisfies StartupAlertState));
    } catch (error) {
      logger.warn(`[startup-alert] Could not record the startup alert; a restart will alert again: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return sent;
}
