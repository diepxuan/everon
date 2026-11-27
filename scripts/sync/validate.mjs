// validate.mjs — Kiem tra file JSON catalog theo schema muc 4 phuong an.
// Node.js 18+, khong dependency.
//   node scripts/sync/validate.mjs [duong-dan-file-json]
//     [--manifest data/image-manifest.json] [--prev data/products.json.cu]
// Mac dinh: data/products-bo-chan-ga.full.json (ban co wrapper) hoac
// data/products.json (ban mang tran trong pr-ready).
// --manifest: doi chieu tung media.source_url voi manifest anh
//   (local_path phai trung voi media.src; anh trong manifest phai co file).
// --prev: safety gate — chặn nếu catalog mất >10% so với bản trước
//   hoặc có giá = 0 (gia <= 0 da la loi rieng tung san pham).
// Loi (fail) -> exit 1. Canh bao (warning: thieu chat lieu/mau) chi liet ke,
// khong fail — vi nguon that su khong co truong do.
//
// DA DANH MỤC (sửa 26/11/2026 — toàn bộ catalog): kiểm tra category.id phải là
// 1 trong 12 danh mục đã biết; mỗi sản phẩm phải có category_ids chứa ít
// nhất 1 danh mục đã biết (không bắt buộc bo-chan-ga nữa).
// LƯU Ý safety gate: --prev chỉ dùng khi validate products.json ĐÃ GỘP
// (tổng số), KHÔNG dùng khi validate 1 wrapper danh mục riêng (13 SP Đệm
// so với 189 SP cũ sẽ kích gate oan). Workflow chạy: validate từng
// wrapper (không --prev) -> export gộp -> validate products.json --prev.
import { readFileSync, existsSync } from 'node:fs';

const KNOWN_CATEGORIES = new Set(['bo-chan-ga', 'dem', 'dem-k-bedding', 'k-bedding', 'tre-em', 'bo-chan-ga-artemis', 'ga', 'vo-goi', 'chan-va-vo-chan', 'ruot', 'goi', 'phu-kien']); // mo 26/11/2026: toan bo catalog (12 danh muc)

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--')) ?? 'data/products-bo-chan-ga.full.json';
const opt = (name) => {
  const eq = argv.find((a) => a.startsWith(`${name}=`))?.split('=')[1];
  if (eq !== undefined) return eq;
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const manifestFile = opt('--manifest');
const prevFile = opt('--prev');
const raw = JSON.parse(readFileSync(file, 'utf8'));
const products = Array.isArray(raw) ? raw : raw.products ?? [];
const errors = [];
const warnings = [];
const seenSku = new Set();

// Anh tu luu: media.src la duong dan anh WebP trong repo
// (vd: assets/img/products/cpm27202/cover.webp). Thu muc THUONG trung
// voi id san pham (sku viet thuong), ten file cover.webp hoac
// img-<so>.webp; neu chuyen WebP that bai, images.mjs giu dinh dang
// goc (.jpg/.png) va cap nhat lai src — ca hai deu hop le.
// NGOAI LE (sua 27/11/2026): anh dung chung giua 2 san pham
// (1 source_url, 2 src) duoc chuan hoa ve 1 duong dan o
// export-site-data.mjs — thu muc khi do la thu muc cua san pham
// dau tien dung anh do, khong nhat thiet trung id san pham nay.
// Vi vay kiem tra thu muc duoi day chap nhan ca thu muc chuan
// (first-seen theo thu tu products.json) lan id cua chinh san pham.
const SRC_RE = /^assets\/img\/products\/[a-z0-9-]+\/(cover|img-\d+)\.(webp|jpg|jpeg|png)$/;

if (!Array.isArray(raw) && raw.schema_version !== 1) errors.push('schema_version phai la 1');
if (!Array.isArray(products) || products.length === 0) errors.push('khong co san pham nao');
if (!Array.isArray(raw) && raw.category?.id && !KNOWN_CATEGORIES.has(raw.category.id)) errors.push(`category.id khong biet: ${raw.category.id}`);
if (!Array.isArray(raw) && raw.count !== undefined && raw.count !== products.length) {
  errors.push(`count khai bao ${raw.count} khac so san pham thuc ${products.length}`);
}

// Thu muc anh chuan cho moi source_url (first-seen theo thu tu
// products.json) — phai khop voi chuan hoa media.src o
// export-site-data.mjs (sua 27/11/2026). Dung cho kiem tra thu muc
// ben duoi: anh dung chung co thu muc = thu muc chuan, khong phai
// id cua san pham dang xet.
const canonicalDirByUrl = new Map();
for (const p of products) {
  for (const m of (p.media ?? [])) {
    if (!m.source_url || !m.src) continue;
    if (!canonicalDirByUrl.has(m.source_url)) canonicalDirByUrl.set(m.source_url, m.src.split('/')[3]);
  }
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
  if (!Array.isArray(p.category_ids) || !p.category_ids.length) errors.push(`${tag}: category_ids rong`);
  else if (!p.category_ids.some((c) => KNOWN_CATEGORIES.has(c))) errors.push(`${tag}: category_ids khong co danh muc nao da biet (${p.category_ids.join(',')})`);
  if (!Array.isArray(raw) && raw.category?.id && !p.category_ids.includes(raw.category.id)) errors.push(`${tag}: category_ids thieu danh muc cua wrapper (${raw.category.id})`);
  if (p.category_ids?.includes('dem')) {
    if (!p.attributes?.mattress_type) warnings.push(`${tag}: thieu mattress_type (loai dem)`);
    if (!p.attributes?.warranty) warnings.push(`${tag}: thieu bao hanh (nguon khong ghi hoac chua lay duoc)`);
  }
  if (!Array.isArray(p.variants) || p.variants.length === 0) errors.push(`${tag}: khong co bien the nao`);
  else for (const v of p.variants) {
    if (!v.size || !v.set_type) errors.push(`${tag}: bien the thieu size/set_type`);
    if (!Number.isInteger(v.price?.amount) || v.price.amount <= 0) errors.push(`${tag}: bien the ${v.size}/${v.set_type} gia khong hop le`);
  }
  if (!Array.isArray(p.media) || p.media.length === 0) errors.push(`${tag}: khong co anh`);
  else for (const m of p.media) {
    if (!m.source_url?.startsWith('https://everon.com/')) errors.push(`${tag}: anh source_url khong phai everon.com`);
    if (!m.src || typeof m.src !== 'string') errors.push(`${tag}: anh thieu src (duong dan anh tu luu)`);
    else {
      if (!SRC_RE.test(m.src)) errors.push(`${tag}: anh src sai dinh dang: ${m.src}`);
      const dir = m.src.split('/')[3];
      const canonDir = canonicalDirByUrl.get(m.source_url);
      if (dir && p.id && dir !== p.id && dir !== canonDir) errors.push(`${tag}: anh src thu muc ${dir} khac id san pham ${p.id}`);
    }
  }
  if (!p.source?.url?.startsWith('https://everon.com/san-pham/')) errors.push(`${tag}: source.url khong phai trang san pham everon.com`);
  if (!p.attributes?.material) warnings.push(`${tag}: thieu chat lieu (nguon khong co)`);
  if (!(p.attributes?.colors ?? []).length) warnings.push(`${tag}: thieu mau (nguon khong co)`);
  if (p.status === 'out_of_stock') warnings.push(`${tag}: het hang (bien the mac dinh stock 0 hoac trang bao Het hang)`);
}

const byCategory = {};
for (const p of products) for (const c of p.category_ids ?? []) byCategory[c] = (byCategory[c] ?? 0) + 1;
const summary = {
  file, products: products.length,
  variants: products.reduce((a, p) => a + (p.variants?.length ?? 0), 0),
  by_category: byCategory,
  errors: errors.length, warnings: warnings.length,
  error_list: errors, warning_list: warnings,
};

// --- Safety gate (--prev): chan neu catalog mat >10% hoac gia = 0 ---
let gate = null;
if (prevFile) {
  try {
    const prevRaw = JSON.parse(readFileSync(prevFile, 'utf8'));
    const prevProducts = Array.isArray(prevRaw) ? prevRaw : prevRaw.products ?? [];
    const prevCount = prevProducts.length;
    const loss = prevCount ? ((prevCount - products.length) / prevCount) * 100 : 0;
    const zeroPrice = products.filter((p) => p.price?.amount === 0).length;
    gate = { prev_count: prevCount, new_count: products.length, loss_percent: Number(loss.toFixed(1)), zero_price_products: zeroPrice };
    if (prevCount > 0 && products.length < prevCount * 0.9) {
      errors.push(`safety-gate: catalog mat ${loss.toFixed(1)}% (${prevCount} -> ${products.length}), vuot nguong 10%`);
    }
    if (zeroPrice > 0) errors.push(`safety-gate: ${zeroPrice} san pham co gia = 0`);
    summary.gate = gate;
  } catch (e) {
    warnings.push(`safety-gate: khong doc duoc file truoc (${prevFile}): ${e.message}`);
  }
}

// --- Doi chieu manifest anh (--manifest) ---
let manifestCheck = null;
if (manifestFile) {
  try {
    if (!existsSync(manifestFile)) {
      warnings.push(`manifest: khong co file ${manifestFile} — anh chua duoc tai ve repo`);
    } else {
      const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
      const entries = manifest.images ?? {};
      let missing = 0, mismatch = 0, missingFile = 0;
      const allSources = new Set();
      for (const p of products) {
        for (const m of p.media ?? []) {
          allSources.add(m.source_url);
          const e = entries[m.source_url];
          if (!e) { missing++; continue; }
          if (e.local_path !== m.src) { mismatch++; errors.push(`${p.sku}: manifest local_path ${e.local_path} khac media.src ${m.src}`); }
          if (!existsSync(e.local_path)) { missingFile++; errors.push(`${p.sku}: file anh tu luu khong ton tai: ${e.local_path}`); }
        }
      }
      let orphans = 0;
      for (const url of Object.keys(entries)) if (!allSources.has(url)) orphans++;
      if (orphans > 0) warnings.push(`manifest: ${orphans} anh thua khong con trong catalog (can chay images.mjs de don dep)`);
      manifestCheck = { entries: Object.keys(entries).length, missing, mismatch, missing_file: missingFile, orphans };
      if (missing > 0) warnings.push(`manifest: ${missing} anh chua co trong manifest (chua chay images.mjs hoac tai loi)`);
    }
    summary.manifest = manifestCheck;
  } catch (e) {
    errors.push(`manifest: loi doc ${manifestFile}: ${e.message}`);
  }
}

summary.errors = errors.length;
console.log(JSON.stringify(summary, null, 2));
process.exit(errors.length ? 1 : 0);
