// diff.mjs — So sanh 2 ban catalog JSON (cu -> moi) va in bao cao diff.
// Node.js 18+, khong dependency.
//   node scripts/sync/diff.mjs <file-cu> <file-moi>
// Moi file co the la ban wrapper {products:[...]} hoac mang tran [...].
// Luu y: duong dan anh tu luu (media.src) KHONG duoc coi la thay doi
// noi dung — chi so sanh gia, trang thai, so bien the va tap hop
// source_url (anh goc doi moi la thay doi anh that su). Them/xoa anh
// duoc liet ke rieng o media_changes de mo ta PR.
import { readFileSync } from 'node:fs';

const [oldFile, newFile] = process.argv.slice(2);
if (!oldFile || !newFile) {
  console.error('Dung: node diff.mjs <file-cu> <file-moi>');
  process.exit(2);
}
const load = (f) => { const j = JSON.parse(readFileSync(f, 'utf8')); return Array.isArray(j) ? j : j.products ?? []; };
const oldP = load(oldFile);
const newP = load(newFile);
const oldBy = Object.fromEntries(oldP.map((p) => [p.sku, p]));
const newBy = Object.fromEntries(newP.map((p) => [p.sku, p]));
const added = newP.filter((p) => !oldBy[p.sku]).map((p) => p.sku);
const removed = oldP.filter((p) => !newBy[p.sku]).map((p) => p.sku);
const priceChanges = [];
const statusChanges = [];
const variantChanges = [];
const mediaChanges = [];
for (const p of newP) {
  const o = oldBy[p.sku];
  if (!o) continue;
  if (o.price?.amount !== p.price?.amount) {
    priceChanges.push({ sku: p.sku, name: p.name, old_price: o.price?.amount, new_price: p.price?.amount, old_discount: o.discount_percent, new_discount: p.discount_percent });
  }
  if (o.status !== p.status) statusChanges.push({ sku: p.sku, old_status: o.status, new_status: p.status });
  if ((o.variants?.length ?? 0) !== (p.variants?.length ?? 0)) {
    variantChanges.push({ sku: p.sku, old_variants: o.variants?.length ?? 0, new_variants: p.variants?.length ?? 0 });
  }
  // Chi so sanh tap source_url (anh goc); bo qua media.src vi do chi la
  // duong dan anh tu luu trong repo, khong phai noi dung san pham.
  const oldUrls = new Set((o.media ?? []).map((m) => m.source_url));
  const newUrls = (p.media ?? []).map((m) => m.source_url);
  const addedUrls = newUrls.filter((u) => !oldUrls.has(u));
  const removedUrls = [...oldUrls].filter((u) => !newUrls.includes(u));
  if (addedUrls.length || removedUrls.length) {
    mediaChanges.push({ sku: p.sku, added_images: addedUrls, removed_images: removedUrls });
  }
}
console.log(JSON.stringify({
  old_file: oldFile, new_file: newFile,
  old_count: oldP.length, new_count: newP.length,
  added_count: added.length, added,
  removed_count: removed.length, removed,
  price_changes: priceChanges,
  status_changes: statusChanges,
  variant_changes: variantChanges,
  media_changes: mediaChanges,
}, null, 2));
