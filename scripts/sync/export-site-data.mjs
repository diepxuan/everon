// export-site-data.mjs — Xuat du lieu site tu ket qua scrape day du.
// Node.js 18+, khong dependency.
//   node scripts/sync/export-site-data.mjs [--full data/products-bo-chan-ga.full.json]
//     [--out data/products.json] [--state data/sync-state.json]
//
// scrape-full.mjs ghi ban wrapper {schema_version, count, products:[...]}.
// Giao dien everon.site doc data/products.json la MANG TRAN [...].
// Script nay: doc ban wrapper -> ghi mang tran ra data/products.json,
// dong thoi cap nhat data/sync-state.json (tong so, thoi gian chay,
// url_lastmod tu data/discovery.json neu co; giu lai url_lastmod cu
// cho URL nao discovery lan nay khong co).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const argVal = (name, def) => {
  const eq = args.find((a) => a.startsWith(`${name}=`))?.split('=')[1];
  if (eq !== undefined) return eq;
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const FULL_FILE = argVal('--full', 'data/products-bo-chan-ga.full.json');
const OUT_FILE = argVal('--out', 'data/products.json');
const STATE_FILE = argVal('--state', 'data/sync-state.json');

const full = JSON.parse(readFileSync(resolve(ROOT, FULL_FILE), 'utf8'));
const products = Array.isArray(full) ? full : full.products ?? [];
if (!products.length) { console.error('[export] Khong co san pham nao trong', FULL_FILE); process.exit(1); }

writeFileSync(resolve(ROOT, OUT_FILE), JSON.stringify(products, null, 2) + '\n', 'utf8');
console.log(`[export] Da ghi ${products.length} san pham -> ${OUT_FILE}`);

// Cap nhat sync-state.json
let state = {};
const statePath = resolve(ROOT, STATE_FILE);
if (existsSync(statePath)) {
  try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { state = {}; }
}
const outOfStock = products.filter((p) => p.status === 'out_of_stock').length;
const variants = products.reduce((a, p) => a + (p.variants?.length ?? 0), 0);
// url_lastmod: giu cu, ghi de bang discovery moi neu co.
const urlLastmod = { ...(state.url_lastmod ?? {}) };
try {
  const disc = JSON.parse(readFileSync(resolve(ROOT, 'data/discovery.json'), 'utf8'));
  for (const [url, lm] of Object.entries(disc.lastmod_by_url ?? {})) urlLastmod[url] = lm;
} catch { /* discovery khong co: giu nguyen */ }
const next = {
  schema_version: 1,
  last_run_at: new Date().toISOString(),
  category: {
    id: 'bo-chan-ga',
    name: 'Bộ chăn ga',
    product_count_on_source: full.category?.product_count_on_source ?? products.length,
  },
  source: {
    site: 'everon.com',
    category_url: 'https://everon.com/danh-muc-san-pham/bo-chan-ga',
    sitemap_url: 'https://everon.com/sitemap.xml',
  },
  totals: { products: products.length, variants, out_of_stock: outOfStock },
  url_lastmod: urlLastmod,
  note: 'lastmod lay tu sitemap.xml ngay chay. Sitemap tra HTTP 404 nhung body van la XML hop le — xem sync-report.',
};
writeFileSync(statePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
console.log(`[export] Da cap nhat ${STATE_FILE}: ${products.length} SP / ${variants} bien the / ${outOfStock} het hang`);
