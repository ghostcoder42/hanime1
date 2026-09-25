jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import { appendErrorLog, formatErrorLine, formatTimestamp } from './error-log';

describe('formatErrorLine', () => {
  it('renders one line with timestamp, kind, status, url and detail', () => {
    const line = formatErrorLine(
      { kind: 'blocked', status: 403, url: 'https://x/y', detail: 'Cloudflare  block\npage' },
      new Date('2026-09-26T04:05:06').getTime()
    );
    expect(line).toBe('[2026-09-26 04:05:06] blocked HTTP 403 https://x/y — Cloudflare block page');
  });

  it('omits absent status/url/detail', () => {
    expect(formatErrorLine({ kind: 'offline' }, 0)).toMatch(/offline/);
    expect(formatErrorLine({ kind: 'offline' }, 0)).not.toContain('HTTP');
  });
});

describe('formatTimestamp', () => {
  it('zero-pads components', () => {
    expect(formatTimestamp(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe('2026-01-02 03:04:05');
  });
});

describe('appendErrorLog', () => {
  it('appends the formatted line to the existing content', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce('first\n');
    await appendErrorLog({ kind: 'timeout' });
    const [path, content] = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0];
    expect(path).toBe('file:///doc/logs/error-log.txt');
    expect(content.startsWith('first\n')).toBe(true);
    expect(content).toContain('timeout');
    expect(content.endsWith('\n')).toBe(true);
  });

  it('never throws when the filesystem fails', async () => {
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(appendErrorLog({ kind: 'unknown' })).resolves.toBeUndefined();
  });
});
