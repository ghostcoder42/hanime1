import * as FileSystem from 'expo-file-system/legacy';

/**
 * Plain-text error log, appended by the network layer on every classified
 * failure and viewable in Settings → Error log. One line per entry keeps the
 * file trimmable, shareable and manually copyable — no database, no store.
 */

const LOG_DIR = `${FileSystem.documentDirectory}logs/`;
export const ERROR_LOG_FILE = `${LOG_DIR}error-log.txt`;

/** Soft cap for the file (chars ≈ bytes here — lines are ASCII-dominated). */
const MAX_CHARS = 128 * 1024;

export type ErrorLogRecord = {
  kind: string;
  status?: number;
  url?: string;
  detail?: string;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatTimestamp(epoch: number): string {
  const d = new Date(epoch);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

/** Single line: `[2026-09-26 12:03:44] blocked HTTP 403 https://… — detail` */
export function formatErrorLine(record: ErrorLogRecord, time = Date.now()): string {
  const parts = [`[${formatTimestamp(time)}] ${record.kind}`];
  if (record.status) parts.push(`HTTP ${record.status}`);
  if (record.url) parts.push(record.url);
  if (record.detail) parts.push(`— ${record.detail.replace(/\s+/g, ' ').trim()}`);
  return parts.join(' ');
}

async function ensureDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
}

/** Append one entry, trimming the oldest content once the cap is exceeded. */
export async function appendErrorLog(record: ErrorLogRecord): Promise<void> {
  try {
    await ensureDir();
    let content = '';
    try {
      content = await FileSystem.readAsStringAsync(ERROR_LOG_FILE, { encoding: 'utf8' });
    } catch {
      // First entry — the file doesn't exist yet.
    }
    const line = formatErrorLine(record);
    content = content && !content.endsWith('\n') ? `${content}\n${line}\n` : `${content}${line}\n`;
    if (content.length > MAX_CHARS) {
      const trimmed = content.slice(-MAX_CHARS);
      content = trimmed.slice(trimmed.indexOf('\n') + 1); // resume at a line start
    }
    await FileSystem.writeAsStringAsync(ERROR_LOG_FILE, content, { encoding: 'utf8' });
  } catch {
    // Logging must never break the request path.
  }
}

export async function readErrorLog(): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(ERROR_LOG_FILE, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

export async function clearErrorLog(): Promise<void> {
  try {
    await FileSystem.deleteAsync(ERROR_LOG_FILE, { idempotent: true });
  } catch {
    // ignore
  }
}
