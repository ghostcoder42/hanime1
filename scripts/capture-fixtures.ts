/**
 * One-off: capture real site HTML as test fixtures + sanity-check the parsers.
 * Run: `bun run scripts/capture-fixtures.ts`
 * Not shipped — used to seed src/lib/hanime1/fixtures and validate parsing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://hanimeone.me';
const FIX_DIR = resolve(process.cwd(), 'src/lib/hanime1/fixtures');

async function get(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.text();
}

function save(name: string, html: string): void {
  const file = resolve(FIX_DIR, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  console.log(`saved ${name} (${html.length} bytes)`);
}

const listHtml = await get('/search?sort=%E6%9C%80%E6%96%B0%E4%B8%8A%E5%82%B3');
save('video-list.html', listHtml);

const idMatch = listHtml.match(/watch\?v=(\d+)/);
const id = idMatch?.[1];
if (!id) throw new Error('no video id found on list page');
console.log('first id:', id);

const detailHtml = await get(`/watch?v=${id}`);
save('video-detail.html', detailHtml);

// sanity checks
const cardCount = (listHtml.match(/video-item-container/g) || []).length;
const sourceCount = (detailHtml.match(/<source\s+src=/g) || []).length;
console.log('cards:', cardCount, '| <source> tags:', sourceCount);
console.log('has pagination.next:', /aria-label="pagination\.next"/.test(listHtml));
