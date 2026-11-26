// export-site-data.mjs — Xuat du lieu site tu ket qua scrape day du.
// Node.js 18+, khong dependency.
//   node scripts/sync/export-site-data.mjs
//     [--full data/products-bo-chan-ga.full.json,data/products-dem.full.json]
//     [--out data/products.json] [--state data/sync-state.json]
//
// scrape-full.mjs ghi ban wrapper {schema_version, count, products:[...]}
// RIENG TUNG DANH MUC (data/products-<id>.full.json).
// Giao dien everon.site doc data/products.json la MANG TRAN [...].
//
// GỘP NHIỀU DANH MỤC (sửa 24/11/2026 — thêm Đệm): script nay GỘP các file
// wrapper của TẤT CẢ danh mục vào products.json, thay vì thay thế toàn bộ
// bằng 1 danh mục. Nếu một danh mục không có file wrapper mới trong lần
// chạy này (vd lần sync chỉ cào lại Bộ chăn ga), sản phẩm của danh mục đó
// được GIỮ LẠI từ products.json cũ — nên Đệm không bị xóa khi sync chỉ
// chạy Bộ chăn ga, và ngược lại. Trùng SKU (không nên xảy ra) thì bản
// mới thắng. Thứ tự trong products.json: theo thứ tự danh mục trong
// --full, trong mỗi danh mục theo thứ tự discovery (scraper đã sắp).
// Đồng thời cập nhật data/sync-state.json (tổng số, thời gian chạy,
// url_lastmod từ data/discovery-<id>.json của từng danh mục; giữ lại
// url_lastmod cũ cho URL nào discovery lần này không có).
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
// Danh sách file wrapper các danh mục, cách nhau bằng dấu phẩy.
// Mặc định: cả 2 danh mục hiện có trên site.
const FULL_FILES = argVal('--full', 'data/products-dem.full.json,data/products-dem-k-bedding.full.json,data/products-k-bedding.full.json,data/products-tre-em.full.json,data/products-bo-chan-ga-artemis.full.json,data/products-bo-chan-ga.full.json,data/products-ga.full.json,data/products-vo-goi.full.json,data/products-chan-va-vo-chan.full.json,data/products-ruot.full.json,data/products-goi.full.json,data/products-phu-kien.full.json')
  .split(',').map((s) => s.trim()).filter(Boolean);
const OUT_FILE = argVal('--out', 'data/products.json');
const STATE_FILE = argVal('--state', 'data/sync-state.json');

// Đọc products.json CŨ trước để giữ lại danh mục không được cào lần này.
let prevProducts = [];
const outPath = resolve(ROOT, OUT_FILE);
if (existsSync(outPath)) {
  try { prevProducts = JSON.parse(readFileSync(outPath, 'utf8')) ?? []; } catch { prevProducts = []; }
}

const freshByCategory = new Map(); // category id -> { products, wrapper }
for (const f of FULL_FILES) {
  const p = resolve(ROOT, f);
  if (!existsSync(p)) { console.log(`[export] Bo qua ${f} (khong ton tai — danh muc do giu nguyen tu products.json cu)`); continue; }
  const full = JSON.parse(readFileSync(p, 'utf8'));
  const products = Array.isArray(full) ? full : full.products ?? [];
  const catId = full.category?.id ?? null;
  if (!products.length) { console.error('[export] Khong co san pham nao trong', f); process.exit(1); }
  if (!catId) { console.error('[export] Wrapper', f, 'thieu category.id'); process.exit(1); }
  freshByCategory.set(catId, { products, wrapper: full });
  console.log(`[export] ${f}: ${products.length} SP danh muc ${catId}`);
}
if (!freshByCategory.size) { console.error('[export] Khong co file wrapper nao — khong ghi de products.json'); process.exit(1); }

const freshCatIds = new Set(freshByCategory.keys());
// Giữ lại sản phẩm cũ thuộc danh mục KHÔNG được cào lần này.
const kept = prevProducts.filter((p) => !(p.category_ids ?? []).some((c) => freshCatIds.has(c)));
const merged = [];
for (const { products } of freshByCategory.values()) merged.push(...products);
merged.push(...kept);
// Trùng SKU (cùng thiết kế bán ở nhiều trang danh mục: bộ / vỏ gối / chăn...):
// KHÔNG loại bỏ bản thua — GỘP UNION (sửa 26/11/2026). Lý do (kiểm chứng):
// trang bộ (Bộ chăn ga, cào bằng scraper cũ) không quét hết biến thể vỏ
// gối/chăn lẻ như trang chuyên biệt; dedupe "bản đầu thắng" thuần túy làm
// mất 372 biến thể thật (kể cả còn hàng) ở lần gộp full catalog đầu tiên.
// Quy tắc gộp:
//  - Sản phẩm giữ nguyên bản thắng (đầu danh sách): tên, mô tả, ảnh,
//    giá gốc, category chính (phần tử đầu category_ids).
//  - Biến thể: UNION theo (set_type, size) — biến thể của bản thắng giữ
//    nguyên (kể cả giá); chỉ THÊM biến thể (set_type, size) nào bản thắng
//    chưa có, lấy từ bản thua (giá/stock/SKU của bản thua cho biến thể đó).
//    38 chỗ cùng (set_type, size) mà giá sale khác nhau đã kiểm tra: giá
//    gốc compare_at trùng nhau (site chỉ hiện giá gốc) hoặc biến thể bên
//    thua bị gán nhầm SKU — giữ bản thắng là đúng.
//  - category_ids: UNION (bản thắng trước) — sản phẩm hiện ở mọi danh mục
//    nguồn có bán nó (trang danh mục lọc theo category_ids), giống lưới
//    nguồn (các lưới nguồn trùng nhau nhiều).
//  - Sau khi gộp: tính lại attributes.set_types từ biến thể đã gộp, và
//    status: nếu có biến thể nào stock > 0 thì 'active' (bản thắng có thể
//    hết hàng nhưng biến thể gộp thêm còn hàng); ngược lại giữ status cũ.
const seen = new Map(); // sku -> product (ban thang)
const unionStats = { collisions: 0, variantsAdded: 0, catsAdded: 0 };
for (const p of merged) {
  const prev = seen.get(p.sku);
  if (!prev) { seen.set(p.sku, p); continue; }
  unionStats.collisions += 1;
  const haveKeys = new Set((prev.variants ?? []).map((v) => `${v.set_type}|${v.size}`));
  for (const v of (p.variants ?? [])) {
    const k = `${v.set_type}|${v.size}`;
    if (!haveKeys.has(k)) { haveKeys.add(k); prev.variants.push(v); unionStats.variantsAdded += 1; }
  }
  for (const c of (p.category_ids ?? [])) {
    if (!(prev.category_ids ?? []).includes(c)) { prev.category_ids.push(c); unionStats.catsAdded += 1; }
  }
  const sts = [...new Set((prev.variants ?? []).map((v) => v.set_type))];
  if (prev.attributes) prev.attributes.set_types = sts;
  if ((prev.variants ?? []).some((v) => (v.stock ?? 0) > 0)) prev.status = 'active';
}
const products = [...seen.values()];
console.log(`[export] Trung SKU gop UNION: ${unionStats.collisions} SKU trung, +${unionStats.variantsAdded} bien the tu ban thua, +${unionStats.catsAdded} category_ids`);

writeFileSync(outPath, JSON.stringify(products, null, 2) + '\n', 'utf8');
console.log(`[export] Da ghi ${products.length} san pham -> ${OUT_FILE} (moi: ${merged.length - kept.length}, giu lai tu lan truoc: ${kept.length}, trung SKU gop: ${merged.length - products.length} ban trung)`);

// Cap nhat sync-state.json
let state = {};
const statePath = resolve(ROOT, STATE_FILE);
if (existsSync(statePath)) {
  try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { state = {}; }
}
const outOfStock = products.filter((p) => p.status === 'out_of_stock').length;
const variants = products.reduce((a, p) => a + (p.variants?.length ?? 0), 0);
// url_lastmod: giu cu, ghi de bang discovery moi cua tung danh muc neu co.
const urlLastmod = { ...(state.url_lastmod ?? {}) };
for (const catId of freshByCategory.keys()) {
  try {
    const disc = JSON.parse(readFileSync(resolve(ROOT, `data/discovery-${catId}.json`), 'utf8'));
    for (const [url, lm] of Object.entries(disc.lastmod_by_url ?? {})) urlLastmod[url] = lm;
  } catch { /* discovery danh muc khong co: giu nguyen */ }
}
// Giữ lại discovery cũ (bo-chan-ga) nếu file đã đổi tên: đọc cả discovery.json cũ.
try {
  const disc = JSON.parse(readFileSync(resolve(ROOT, 'data/discovery.json'), 'utf8'));
  for (const [url, lm] of Object.entries(disc.lastmod_by_url ?? {})) urlLastmod[url] ??= lm;
} catch { /* khong co: bo qua */ }
const cats = [...freshByCategory.values()].map(({ wrapper, products: ps }) => ({
  id: wrapper.category.id,
  name: wrapper.category.name,
  product_count_on_source: wrapper.category?.product_count_on_source ?? ps.length,
}));
// Giữ lại danh mục đã biết từ lần chạy trước mà lần này không cào
// (vd chạy tay 1 danh mục): danh sách categories trong sync-state
// không bị mất entry chỉ vì lần này không cào danh mục đó.
const freshIds = new Set(cats.map((c) => c.id));
const prevCats = Array.isArray(state.categories) ? state.categories : (state.category?.id ? [state.category] : []);
const allCats = [...cats, ...prevCats.filter((c) => c && c.id && !freshIds.has(c.id))];
const next = {
  schema_version: 1,
  last_run_at: new Date().toISOString(),
  categories: allCats,
  // Giữ trường category cũ để tương thích ngược (các script cũ đọc state.category).
  category: allCats[0] ?? state.category,
  source: {
    site: 'everon.com',
    category_urls: allCats.map((c) => c.id),
    sitemap_url: 'https://everon.com/sitemap.xml',
  },
  totals: { products: products.length, variants, out_of_stock: outOfStock },
  url_lastmod: urlLastmod,
  note: 'lastmod lay tu sitemap.xml ngay chay. Sitemap tra HTTP 404 nhung body van la XML hop le — xem sync-report.',
};
writeFileSync(statePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
console.log(`[export] Da cap nhat ${STATE_FILE}: ${products.length} SP / ${variants} bien the / ${outOfStock} het hang / ${cats.length} danh muc`);
