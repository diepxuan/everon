// queue.mjs — Quan ly file hang doi crawl cho sync Everon (che do chunk, 28/11/2026).
// Node.js 18+, khong dependency.
// File hang doi data/crawl-queue.json: mang cac muc
//   { url, sku, categories: [<id chinh>, ...], sub_type, last_crawl, status? }
// - categories: TAT CA danh muc san pham xuat hien tren nguon (phan tu dau la
//   danh muc chinh — quyet dinh scraper nao cao no; cac danh muc sau de giu
//   du category_ids nhu truoc day).
// - last_crawl: null = chua cao trong vong nay; ISO string = gio cao xong.
// - status 'gone': URL tra 404 (scraper danh dau) — last chunk se xoa khoi file.
//
//   node scripts/sync/queue.mjs select [--queue ...] [--batch-size 60]
//     -> chon batch tiep theo (N muc chua cao), ghi data/queue-batch.json
//        { last_chunk, batch_size, total_unmarked, total, categories: [{id, urls}] }
//        + data/queue-urls-<id>.txt cho tung danh muc (1 URL/dong).
//        In LAST_CHUNK=true neu khong con muc chua cao.
//   node scripts/sync/queue.mjs merge-discovery [--queue ...] [--discovery data/queue-discovery.json]
//     -> last chunk: them SP moi tu discovery, ghi SP da bien mat vao
//        data/queue-removed.json, xoa sach last_crawl (reset vong moi).
//   node scripts/sync/queue.mjs build [--queue ...] [--discovery data/queue-discovery.json]
//     -> khoi tao file hang doi lan dau: tu discovery + data/products.json.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const cmd = args[0] ?? 'select';
const argVal = (name, def) => {
  const eq = args.find((a) => a.startsWith(`${name}=`))?.split('=')[1];
  if (eq !== undefined) return eq;
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const QUEUE_PATH = argVal('--queue', 'data/crawl-queue.json');
const BATCH_SIZE = Number(argVal('--batch-size', '60')) || 60;
// Thu tu danh muc (giong thu tu export trong sync.yml).
const CAT_ORDER = ['dem', 'dem-k-bedding', 'k-bedding', 'tre-em', 'bo-chan-ga-artemis', 'bo-chan-ga', 'ga', 'vo-goi', 'chan-va-vo-chan', 'ruot', 'goi', 'phu-kien'];
const catRank = (id) => { const i = CAT_ORDER.indexOf(id); return i < 0 ? 99 : i; };

const loadQueue = () => {
  const p = resolve(ROOT, QUEUE_PATH);
  if (!existsSync(p)) { console.error(`[queue] Khong thay file hang doi: ${QUEUE_PATH}`); process.exit(2); }
  return JSON.parse(readFileSync(p, 'utf8'));
};
const saveQueue = (q) => {
  mkdirSync(resolve(ROOT, 'data'), { recursive: true });
  writeFileSync(resolve(ROOT, QUEUE_PATH), JSON.stringify(q, null, 2) + '\n', 'utf8');
};

if (cmd === 'select') {
  const q = loadQueue();
  const unmarked = q.filter((e) => !e.last_crawl && e.status !== 'gone');
  if (!unmarked.length) {
    console.log('LAST_CHUNK=true');
    console.log(`[queue] Het file: ${q.length} SP deu da cao trong vong nay — chay last chunk.`);
    writeFileSync(resolve(ROOT, 'data/queue-batch.json'), JSON.stringify({ last_chunk: true, batch_size: BATCH_SIZE, total_unmarked: 0, total: q.length, categories: [] }, null, 2) + '\n');
    process.exit(0);
  }
  // Bo qua muc khong co danh muc (du lieu loi) — ghi log de sua tay sau.
  const usable = [];
  let skippedNoCat = 0;
  for (const e of unmarked) {
    if (!(e.categories ?? []).length) { skippedNoCat += 1; continue; }
    usable.push(e);
    if (usable.length >= BATCH_SIZE) break;
  }
  if (skippedNoCat) console.log(`[queue] Canh bao: ${skippedNoCat} muc chua cao khong co danh muc — bo qua, can sua tay trong ${QUEUE_PATH}.`);
  if (!usable.length) { console.error('[queue] Khong chon duoc batch (toan muc loi danh muc) — dung lai.'); process.exit(2); }
  // Gom theo danh muc chinh, giu thu tu file trong moi danh muc.
  const byCat = new Map();
  for (const e of usable) {
    const id = e.categories[0];
    if (!byCat.has(id)) byCat.set(id, []);
    byCat.get(id).push(e.url);
  }
  const categories = [...byCat.entries()]
    .sort((a, b) => catRank(a[0]) - catRank(b[0]))
    .map(([id, urls]) => {
      writeFileSync(resolve(ROOT, `data/queue-urls-${id}.txt`), urls.join('\n') + '\n');
      return { id, urls };
    });
  writeFileSync(resolve(ROOT, 'data/queue-batch.json'), JSON.stringify({ last_chunk: false, batch_size: BATCH_SIZE, total_unmarked: unmarked.length, total: q.length, categories }, null, 2) + '\n');
  console.log('LAST_CHUNK=false');
  console.log(`[queue] Batch: ${usable.length} SP (${categories.map((c) => `${c.id}:${c.urls.length}`).join(', ')}); con ${unmarked.length - usable.length} SP chua cao trong vong nay; tong file ${q.length} SP.`);
} else if (cmd === 'merge-discovery') {
  const discPath = argVal('--discovery', 'data/queue-discovery.json');
  const disc = JSON.parse(readFileSync(resolve(ROOT, discPath), 'utf8'));
  const discByUrl = new Map((disc.urls ?? []).map((e) => [e.url, e]));
  const sitemapSet = new Set(disc.sitemap_product_urls ?? []);
  const q = loadQueue();
  const inQueue = new Set(q.map((e) => e.url));
  let added = 0;
  for (const [url, e] of discByUrl) {
    if (!inQueue.has(url)) {
      q.push({ url, sku: null, categories: e.categories ?? [], sub_type: e.sub_type ?? null, last_crawl: null });
      added += 1;
    }
  }
  // SP da bien mat: khong co trong luoi nao lan nay, khong co trong sitemap,
  // hoac bi scraper danh dau 'gone' (HTTP 404). Chi xoa khi sitemap day du
  // (>= 500 URL san-pham — neu sitemap tai loi / thieu thi khong xoa gi).
  const sitemapOk = sitemapSet.size >= 500;
  if (!sitemapOk) console.log(`[queue] Canh bao: sitemap chi co ${sitemapSet.size} URL san-pham (< 500) — co the tai loi, KHONG xoa SP nao trong lan nay.`);
  const removed = [];
  const keptQ = q.filter((e) => {
    if (e.status === 'gone') { removed.push({ url: e.url, sku: e.sku ?? null, category: (e.categories ?? [])[0] ?? null }); return false; }
    if (discByUrl.has(e.url)) return true;
    if (!sitemapOk) return true;
    if (sitemapSet.has(e.url)) return true; // co trong sitemap nhung khong nam trong luoi nao — giu lai
    removed.push({ url: e.url, sku: e.sku ?? null, category: (e.categories ?? [])[0] ?? null });
    return false;
  });
  // Reset vong moi: xoa sach last_crawl + status.
  for (const e of keptQ) { e.last_crawl = null; delete e.status; }
  saveQueue(keptQ);
  writeFileSync(resolve(ROOT, 'data/queue-removed.json'), JSON.stringify({ crawled_at: new Date().toISOString(), removed }, null, 2) + '\n');
  console.log(`[queue] Last chunk: +${added} SP moi vao file, -${removed.length} SP da bien mat (ghi data/queue-removed.json), reset last_crawl cho ${keptQ.length} SP. File hien co ${keptQ.length} SP.`);
} else if (cmd === 'build') {
  const discPath = argVal('--discovery', 'data/queue-discovery.json');
  const disc = JSON.parse(readFileSync(resolve(ROOT, discPath), 'utf8'));
  let prevProducts = [];
  try {
    const raw = JSON.parse(readFileSync(resolve(ROOT, 'data/products.json'), 'utf8'));
    prevProducts = Array.isArray(raw) ? raw : raw.products ?? [];
  } catch { /* chua co products.json: chi dung discovery */ }
  const prevByUrl = new Map(prevProducts.map((p) => [p.source?.url, p]).filter(([u]) => u));
  const byUrl = new Map();
  for (const e of (disc.urls ?? [])) {
    if (!byUrl.has(e.url)) {
      byUrl.set(e.url, {
        url: e.url,
        sku: prevByUrl.get(e.url)?.sku ?? null,
        categories: e.categories ?? [],
        sub_type: e.sub_type ?? null,
        last_crawl: null,
      });
    }
  }
  // SP trong products.json nhung khong co trong discovery (vd SP ghim tay /
  // nam ngoai luoi): giu lai voi danh muc tu products.json.
  for (const p of prevProducts) {
    const u = p.source?.url;
    if (u && !byUrl.has(u)) {
      byUrl.set(u, { url: u, sku: p.sku ?? null, categories: p.category_ids ?? [], sub_type: null, last_crawl: null });
    }
  }
  const q = [...byUrl.values()].sort((a, b) => (catRank((a.categories ?? [])[0]) - catRank((b.categories ?? [])[0])) || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  saveQueue(q);
  console.log(`[queue] Da khoi tao ${QUEUE_PATH}: ${q.length} SP (tu discovery ${disc.urls?.length ?? 0} URL + products.json ${prevProducts.length} SP).`);
} else {
  console.error(`[queue] Lenh khong biet: ${cmd} (dung: select | merge-discovery | build)`);
  process.exit(2);
}
