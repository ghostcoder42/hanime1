import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classNames with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Parse a Chinese-numeral view count like "1.1萬次" / "3.2億次" / "99次" into a
 * number. Returns null when it cannot be parsed.
 */
export function parseChineseCount(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.萬億亿万]/g, '');
  const match = cleaned.match(/([\d.]+)\s*(萬|億|万|亿)?/);
  if (!match?.[1]) return null;
  const n = Number.parseFloat(match[1]);
  if (Number.isNaN(n)) return null;
  const unit = match[2];
  if (unit === '萬' || unit === '万') return Math.round(n * 10_000);
  if (unit === '億' || unit === '亿') return Math.round(n * 100_000_000);
  return Math.round(n);
}

/** Compact number formatting, e.g. 12345 -> "12.3K". */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${trim(n / 1000)}K`;
  if (n < 1_000_000_000) return `${trim(n / 1_000_000)}M`;
  return `${trim(n / 1_000_000_000)}B`;
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

/** Pick the best available stream URL (highest resolution). */
export function bestSource(
  sources: { resolution: number; url: string }[] | undefined
): string | undefined {
  if (!sources || sources.length === 0) return undefined;
  return [...sources].sort((a, b) => b.resolution - a.resolution)[0]?.url;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
