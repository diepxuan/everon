// validate.mjs — Kiem tra file JSON catalog theo schema muc 4 phuong an.
// Node.js 18+, khong dependency.
//   node scripts/sync/validate.mjs [duong-dan-file-json]
// Mac dinh: data/products-bo-chan-ga.full.json (ban co wrapper) hoac
// data/products.json (ban mang tran trong pr-ready).
// Loi (fail) -> exit 1. Canh bao (warning: thieu chat lieu/mau) chi liet ke,
// khong fail — vi nguon that su khong co truong do.
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'data/products-bo-chan-ga.full.json';
const raw = JSON.parse(readFileSync(file, 'utf8'));
const products = Array.isArray(raw) ? raw : raw.products ?? [];
const errors = [];
const warnings = [];
const seenSku = new Set();

if (!Array.isArray(raw) && raw.schema_version !== 1) errors.push('schema_version phai la 1');
if (!Array.isArray(products) || products.length === 0) errors.push('khong co san pham nao');
if (!Array.isArray(raw) && raw.category?.id && raw.category.id !== 'bo-chan-ga') errors.push('category.id khong phai bo-chan-ga');
if (!Array.isArray(raw) && raw.count !== undefined && raw.count !== products.length) {
  errors.push(`count khai bao ${raw.count} khac so san pham thuc ${products.length}`);
}

for (const p of products) {
  const tag = p.sku ?? p.slug ?? '?';
  for (const f of ['id', 'sku', 'slug', 'name']) if (!p[f] || typeof p[f] !== 'string') errors.push(`${tag}: thieu ${f}`);
  if (p.sku) {
    if (seenSku.has(p.sku)) errors.push(`${tag}: SKU trung lap`);
    seenSku.add(p.sku);
  }
  if (!p.price || !Number.isInteger(p.price?.amount) || p.price.amount <= 0) errors.push(`${tag}: gia khong hop le`);
  if (p.compare_at_price && p.compare_at_price.amount < p.price?.amount) errors.push(`${tag}: gia goc nho hon gia ban`);
  if (!(p.discount_percent >= 0 && p.discount_percent <= 100)) errors.push(`${tag}: discount_percent ngoai 0-100`);
  if (p.local_override !== null && p.local_override !== undefined) errors.push(`${tag}: local_override phai null (da chot dung gia everon.com)`);
  if (!Array.isArray(p.category_ids) || !p.category_ids.includes('bo-chan-ga')) errors.push(`${tag}: category_ids thieu bo-chan-ga`);
  if (!Array.isArray(p.variants) || p.variants.length === 0) errors.push(`${tag}: khong co bien the nao`);
  else for (const v of p.variants) {
    if (!v.size || !v.set_type) errors.push(`${tag}: bien the thieu size/set_type`);
    if (!Number.isInteger(v.price?.amount) || v.price.amount <= 0) errors.push(`${tag}: bien the ${v.size}/${v.set_type} gia khong hop le`);
  }
  if (!Array.isArray(p.media) || p.media.length === 0) errors.push(`${tag}: khong co anh`);
  else for (const m of p.media) {
    if (!m.source_url?.startsWith('https://everon.com/')) errors.push(`${tag}: anh source_url khong phai everon.com`);
  }
  if (!p.source?.url?.startsWith('https://everon.com/san-pham/')) errors.push(`${tag}: source.url khong phai trang san pham everon.com`);
  if (!p.attributes?.material) warnings.push(`${tag}: thieu chat lieu (nguon khong co)`);
  if (!(p.attributes?.colors ?? []).length) warnings.push(`${tag}: thieu mau (nguon khong co)`);
  if (p.status === 'out_of_stock') warnings.push(`${tag}: het hang (bien the mac dinh stock 0 hoac trang bao Het hang)`);
}

const summary = {
  file, products: products.length,
  variants: products.reduce((a, p) => a + (p.variants?.length ?? 0), 0),
  errors: errors.length, warnings: warnings.length,
  error_list: errors, warning_list: warnings,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(errors.length ? 1 : 0);
