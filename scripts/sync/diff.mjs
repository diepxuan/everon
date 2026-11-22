// diff.mjs — So sanh 2 ban catalog JSON (cu -> moi) va in bao cao diff.
// Node.js 18+, khong dependency.
//   node scripts/sync/diff.mjs <file-cu> <file-moi>
// Moi file co the la ban wrapper {products:[...]} hoac mang tran [...].
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
}
console.log(JSON.stringify({
  old_file: oldFile, new_file: newFile,
  old_count: oldP.length, new_count: newP.length,
  added_count: added.length, added,
  removed_count: removed.length, removed,
  price_changes: priceChanges,
  status_changes: statusChanges,
  variant_changes: variantChanges,
}, null, 2));
