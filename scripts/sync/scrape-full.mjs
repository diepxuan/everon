// scrape-full.mjs — Chạy TOÀN BỘ danh mục Bộ chăn ga cho everon.site.
// Node.js 18+, chỉ dùng fetch có sẵn, KHÔNG dependency, KHÔNG npm install.
// Mở rộng từ scripts/scrape-bo-chan-ga.mjs (bản thử 7 sản phẩm).
//
// Chạy:
//   node scripts/scrape-full.mjs                  (toàn bộ 189 sản phẩm)
//   node scripts/scrape-full.mjs --limit 5        (chạy thử 5 sản phẩm đầu)
//   node scripts/scrape-full.mjs --resume         (tiếp tục từ checkpoint, bỏ qua SKU đã xong)
//   node scripts/scrape-full.mjs --limit 5 --out data/test.json
//
// NGUYÊN TẮC (theo phương án + quyết định đã chốt 22/11/2026):
//  - Nguồn: everon.com, đã được Everpia đồng ý dùng toàn bộ catalog.
//  - Discovery: sitemap.xml (lưu ý: server trả HTTP 404 nhưng body vẫn là XML
//    hợp lệ ~330KB — phải chấp nhận body XML dù status != 200) + phân trang
//    danh mục ?page=1..N làm đối chiếu. Không dựa vào lưới trang 1.
//  - Chạy tuần tự, nghỉ 1500ms giữa MỌI request, tối đa 2 retry; gặp 429 thì
//    chờ 60s rồi thử lại 1 lần; 10 lỗi liên tiếp thì dừng, giữ lại phần đã xong.
//  - Giá biến thể: gọi GET /product-variation/<id>?attributes[]=<id>&... với
//    đúng 1 id cho mỗi nhóm thuộc tính (màu, kiểu bộ, kích thước), kèm
//    X-CSRF-TOKEN lấy từ meta của trang sản phẩm. Tổ hợp không hợp lệ server
//    trả về biến thể mặc định — chỉ ghi variant khi sku/giá/selected_attributes
//    khác biến thể mặc định, nếu không sẽ ghi nhầm giá.
//  - Trường nào nguồn không có thì để null, KHÔNG đoán, KHÔNG bịa.
//  - Không tải ảnh về (chỉ lưu source_url). Không commit/push. Chỉ ghi vào
//    thư mục làm việc này.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'https://everon.com';
const CATEGORY_URL = `${BASE}/danh-muc-san-pham/bo-chan-ga`;
const SITEMAP_URL = `${BASE}/sitemap.xml`;
const DELAY_MS = 1500;
const USER_AGENT =
  'everon-site-sync-full/1.0 (+https://everon.site; distributor: Cong ty TNHH Diep Xuan; contact via everon.site)';
const args = process.argv.slice(2);
const argVal = (name) => {
  const eq = args.find((a) => a.startsWith(`${name}=`))?.split('=')[1];
  if (eq !== undefined) return eq;
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = Number(argVal('--limit') ?? NaN);
const RESUME = args.includes('--resume');
const SKIP_DISCOVERY = args.includes('--skip-discovery');
const OUT = argVal('--out') ?? 'data/products-bo-chan-ga.full.json';
const STATE_FILE = 'data/state.json';
const JSONL_FILE = 'data/products-bo-chan-ga.full.jsonl';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let consecutiveErrors = 0;

async function fetchText(url, { accept = 'text/html', csrf = null } = {}, tries = 2) {
  for (let i = 1; i <= tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000); // 30s: tranh treo vinh vien
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept, ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}) },
        signal: ctrl.signal,
      });
      if (res.status === 429) {
        clearTimeout(timer);
        console.log(`[429] ${url} — cho 60s roi thu lai`);
        await sleep(60000);
        continue;
      }
      const body = await res.text();
      clearTimeout(timer);
      // Sitemap tra ve 404 nhung body van la XML hop le — chap nhan rieng cho sitemap.
      if (res.ok || (url === SITEMAP_URL && body.includes('<urlset'))) return body;
      if (i === tries) throw new Error(`HTTP ${res.status} khi tai ${url}`);
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') {
        console.log(`[timeout 30s] ${url} (lan ${i}/${tries})`);
        if (i === tries) throw new Error(`timeout 30s khi tai ${url}`);
      } else if (i === tries) throw e;
      else if (String(e.message).startsWith('HTTP')) throw e;
      else console.log(`[mang-loi] ${url}: ${e.message} (lan ${i}/${tries})`);
    }
    await sleep(DELAY_MS);
  }
  throw new Error(`khong tai duoc ${url}`);
}

const text = (html) =>
  html.replace(/<span class="dong">đ<\/span>/g, 'đ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();

const parseVnd = (s) => {
  if (s === null || s === undefined) return null;
  const n = Number(String(s).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// SKU goc cua san pham: trang chi tiet ghi ma bien the (VD EBBM1620EPC27027,
// EBTT2022FRYARN) — lay phan SKU chuan o cuoi neu co, neu khong thi bo tien
// to bien the ^EB[A-Z]{2}\d{4} (VD FRYARN). Tuyet doi KHONG dung data.sku cua
// variation lam SKU san pham: do la SKU cua bien the (VD EBGC2022EPC27027).
const coreSku = (code) => {
  if (!code) return null;
  const m1 = String(code).trim().match(/([A-Z]{2,5}\d{3,5})\s*$/);
  if (m1) return m1[1];
  const stripped = String(code).trim().replace(/^EB[A-Z]{2}\d{4}/, '');
  if (stripped.length >= 3 && stripped !== String(code).trim()) return stripped;
  return null;
};

const slugify = (name, sku) => {
  const base = (name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base ? `${base}-${String(sku).toLowerCase()}` : String(sku).toLowerCase();
};

// ---------- Discovery: sitemap + phan trang danh muc ----------
async function discover() {
  const sm = await fetchText(SITEMAP_URL, { accept: 'application/xml, text/html' });
  const entries = [...sm.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)]
    .map((m) => ({ url: m[1], lastmod: m[2] ?? null }));
  const sitemapProducts = entries.filter((e) => e.url.includes('/san-pham/'));
  console.log(`[discovery] sitemap: ${entries.length} URL, trong do ${sitemapProducts.length} URL san-pham`);
  const sitemapSet = new Set(sitemapProducts.map((e) => e.url));
  const lastmodByUrl = Object.fromEntries(sitemapProducts.map((e) => [e.url, e.lastmod]));

  const catUrls = [];
  let page = 1;
  let catCount = null;
  for (;;) {
    const html = await fetchText(`${CATEGORY_URL}?page=${page}`);
    if (catCount === null) catCount = Number(text(html).match(/(\d+)\s*sản phẩm/)?.[1] ?? NaN);
    const gridStart = html.indexOf('list-product');
    const grid = gridStart >= 0 ? html.slice(gridStart) : html;
    const links = [...new Set([...grid.matchAll(/href="(https:\/\/everon\.com\/san-pham\/[^"?#]+)"/g)].map((m) => m[1]))];
    console.log(`[discovery] danh muc trang ${page}: ${links.length} link`);
    if (links.length === 0) break;
    links.forEach((u) => { if (!catUrls.includes(u)) catUrls.push(u); });
    await sleep(DELAY_MS);
    page += 1;
    if (page > 30) break; // phong thu
    // het trang khi khong con nut next / het so trang trong pagination
    if (!html.includes(`?page=${page}`) && !html.includes(`page=${page}`)) break;
  }
  const notInSitemap = catUrls.filter((u) => !sitemapSet.has(u));
  const sitemapNotInCat = [...sitemapSet].filter((u) => !catUrls.includes(u));
  const discovery = {
    crawled_at: new Date().toISOString(),
    category_url: CATEGORY_URL,
    category_count_on_source: Number.isFinite(catCount) ? catCount : null,
    category_pages_fetched: page - 1,
    category_urls_found: catUrls.length,
    category_urls_unique: new Set(catUrls).size,
    sitemap_total_urls: entries.length,
    sitemap_product_urls: sitemapProducts.length,
    sitemap_product_urls_not_in_category: sitemapNotInCat.length,
    category_urls_not_in_sitemap: notInSitemap,
    urls: catUrls,
    lastmod_by_url: lastmodByUrl,
  };
  mkdirSync(`${ROOT}/data`, { recursive: true });
  writeFileSync(`${ROOT}/data/discovery.json`, JSON.stringify(discovery, null, 2) + '\n');
  console.log(`[discovery] danh muc: ${catUrls.length} URL duy nhat (trang bao ${catCount}); khong co trong sitemap: ${notInSitemap.length}; sitemap co ${sitemapNotInCat.length} URL san-pham ngoai danh muc nay.`);
  return discovery;
}

// ---------- Trich xuat trang san pham (ke thua ban thu, cai tien SKU) ----------
function parseAttributeGroups(html) {
  const attrStart = html.indexOf('product-attributes');
  const section = attrStart >= 0 ? html.slice(attrStart, attrStart + 20000) : '';
  const groups = [];
  const groupRe = /<div class="parameter[^"]*"[^>]*data-type="([^"]+)"[^>]*>\s*<div class="parameter__title attribute-name">([^<]+)<\/div>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let gm;
  while ((gm = groupRe.exec(section)) !== null) {
    const options = [...gm[3].matchAll(/<label[^>]*data-code="([^"]+)" data-id="(\d+)"[^>]*>([\s\S]*?)<\/label>/g)]
      .map((m) => ({
        code: m[1], id: m[2],
        disabled: /disabled/.test(m[0]),
        checked: /checked/.test(m[3]),
        txt: (m[3].match(/<span class="txt">([^<]+)<\/span>/)?.[1] || '').trim(),
      }));
    if (options.length) groups.push({ type: gm[1], title: gm[2].trim(), options });
  }
  return groups;
}

function extractBase(html, url) {
  const t = text(html);
  const slug = url.split('/san-pham/')[1]?.split('?')[0].split('/')[0] ?? '';
  const title = (html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '').replace(/&amp;/g, '&').trim();
  const nameFromTitle = title.includes(' - ') ? title.split(' - ')[0].trim() : title;
  // SKU: uu tien ma trong the .sku (VD EBBM1620EPC27027 -> lay duoi SKU EPC27027),
  // roi moi den duoi URL. Khong dung nguyen ma bien the.
  const skuOnPage = html.match(/<div class="sku">([^<]+)<\/div>/)?.[1]?.trim() ?? null;
  const skuFromPage = coreSku(skuOnPage);
  const tail = slug.split('-').pop() ?? '';
  const skuFromUrl = /^[a-z]{2,5}\d{3,5}$/i.test(tail) ? tail.toUpperCase()
    // Du phong: mot so san pham khong co SKU chuan trong URL (VD bo-chan-ga-maison
    // -> MAISON, mint-mb2301mt -> MB2301MT) — dung luon duoi URL viet hoa lam ma.
    : (/^[a-z0-9]{4,}$/i.test(tail) ? tail.toUpperCase() : null);
  const sku = skuFromPage ?? skuFromUrl;
  const variationId = html.match(/product-variation\/(\d+)/)?.[1] ?? null;
  const csrf = html.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1] ?? null;
  const boxStart = html.indexOf('price-box _detail-product');
  const box = boxStart >= 0 ? html.slice(boxStart, boxStart + 1500) : '';
  const boxText = text(box);
  const compareAt = parseVnd(box.match(/<del>([\d.]+)/)?.[1]);
  const price = parseVnd(box.match(/class="money">\s*([\d.]+)/)?.[1]);
  const discount = Number(boxText.match(/percent[^0-9-]*(-?\d+)/)?.[1] ?? 0);
  const material = t.match(/Chất liệu vải:\s*(.+?)\s*-\s*Xuất xứ:/)?.[1]?.trim()
    ?? t.match(/Chất liệu vải:\s*([A-Za-zÀ-ỹ() ]+)/)?.[1]?.trim() ?? null;
  const origin = t.match(/Xuất xứ:\s*([^\s-]+)/)?.[1]?.trim() ?? null;
  const patternType = t.match(/Hoạ tiết:\s*([^\s-]+)/)?.[1]?.trim() ?? null;
  const pattern = t.match(/Hoạ tiết:\s*[^\s-]+\s*-\s*([A-Za-zÀ-ỹ ]+?)(?=\s*(?:Màu sắc|Chất liệu|Kích thước|Tìm cửa hàng|BST|Thông tin))/ )?.[1]?.trim() ?? null;
  const colors = [...t.matchAll(/Màu sắc:\s*([A-Za-zÀ-ỹ ]+?)(?=\s*Sản phẩm:)/g)]
    .flatMap((m) => m[1].split(/\s{2,}/).map((c) => c.trim()).filter(Boolean));
  const desc = t.match(/Thông tin sản phẩm\s+(.+?)\s*(?:###|BST|Lenzing)/)?.[1]?.trim() ?? null;
  const images = [...new Set([...html.matchAll(/(?:https:\/\/everon\.com)?(\/upload\/[^"'\s)]+?-600x0\.jpg)/g)]
    .map((m) => `${BASE}${m[1]}`))].filter((u) => u.includes(`/${slug}/`) || (sku && u.toLowerCase().includes(`/${sku.toLowerCase()}/`)))
    .sort((a, b) => (a.includes('thumbnail') ? 0 : 1) - (b.includes('thumbnail') ? 0 : 1));
  const KNOWN_SET_TYPES = ['Bộ ga chun chần bốn mùa', 'Bộ ga chun chần', 'Bộ chăn bốn mùa', 'Bộ ga phủ', 'Bộ ga chun', 'Ga chun chần', 'Ga chun', 'Ga phủ'];
  const setTypes = KNOWN_SET_TYPES.filter((st) => t.includes(st));
  const collections = [];
  if (/BST Những Mảnh Êm/.test(t)) collections.push('bst-nhung-manh-em');
  if (/BST Cutie 2027/.test(t)) collections.push('bst-cutie-2027');
  if (/BST Cutie Everon/.test(t)) collections.push('bst-cutie-everon');
  if (/BST Chăn ga 2022/.test(t)) collections.push('bst-chan-ga-2022');
  if (/Everon 2027/.test(t)) collections.push('everon-2027');
  return {
    slug, sku, skuOnPage, nameFromTitle, price, compareAt, discount, material, origin,
    pattern, patternType, colors, desc, images, setTypes, collections,
    variationId, csrf, groups: parseAttributeGroups(html),
    outOfStock: /Hết hàng|đã hết hàng/.test(t),
    pageText: t,
  };
}

// ---------- Variation endpoint ----------
async function callVariation(vid, csrf, attrs) {
  const q = attrs.map((a) => `attributes%5B%5D=${encodeURIComponent(a)}`).join('&');
  const url = `${BASE}/product-variation/${vid}?${q ? q + '&' : ''}_=${Date.now()}`;
  const body = await fetchText(url, { accept: 'application/json', csrf });
  try {
    return JSON.parse(body);
  } catch {
    return { error: true, message: 'variation tra ve khong phai JSON', raw: body.slice(0, 200) };
  }
}

const vPrice = (d) => (d && Number.isFinite(Number(d.sale_price)) && Number(d.sale_price) > 0
  ? Number(d.sale_price) : (d ? parseVnd(d.display_sale_price) : null));
const vCompare = (d) => (d && Number.isFinite(Number(d.price)) && Number(d.price) > 0
  ? Number(d.price) : (d ? parseVnd(d.display_price) : null));
const vDiscount = (d, price, compareAt) => {
  if (d?.sale_percentage) { const n = Math.abs(Number(String(d.sale_percentage).replace(/[^\d]/g, ''))); if (Number.isFinite(n)) return n; }
  if (price && compareAt && compareAt > price) return Math.round((1 - price / compareAt) * 100);
  return 0;
};

async function buildVariants(base, defVar) {
  // defVar: ket qua variation khong tham so (bien the mac dinh that su cua trang).
  const d = defVar?.data ?? null;
  const defPrice = vPrice(d);
  const defCompare = vCompare(d);
  const defSku = d?.sku || base.sku;
  const defSel = (d?.selected_attributes ?? []).map((a) => String(a.id));
  const groups = base.groups;
  const colorGroup = groups[0] ?? null;
  const setGroup = groups.find((g) => /Sản phẩm/.test(g.title)) ?? groups[1] ?? null;
  const sizeGroup = groups.find((g) => /Kích thước/.test(g.title)) ?? groups[2] ?? null;
  const colorId = defSel.find((id) => colorGroup?.options.some((o) => o.id === id))
    ?? colorGroup?.options.find((o) => o.checked)?.id
    ?? colorGroup?.options[0]?.id ?? null;
  const defSetId = defSel.find((id) => setGroup?.options.some((o) => o.id === id))
    ?? setGroup?.options.find((o) => o.checked)?.id ?? null;
  const defSizeId = defSel.find((id) => sizeGroup?.options.some((o) => o.id === id))
    ?? sizeGroup?.options.find((o) => o.checked)?.id ?? null;
  const labelOf = (group, id) => group?.options.find((o) => o.id === String(id))?.txt ?? null;
  const variants = [];
  const seen = new Set();
  const pushVariant = (setId, sizeId, vd) => {
    const setTxt = labelOf(setGroup, setId);
    const sizeTxt = labelOf(sizeGroup, sizeId);
    if (!setTxt || !sizeTxt) return false;
    const key = `${setTxt}|${sizeTxt}`;
    if (seen.has(key)) return false;
    const price = vPrice(vd);
    const compareAt = vCompare(vd);
    if (!price) return false;
    seen.add(key);
    variants.push({
      // Neu server khong tra SKU bien the rieng (vd.sku rong) thi dung SKU
      // san pham goc, KHONG tu che them hau to size — tranh tao ma ao.
      sku: vd?.sku && String(vd.sku).trim() ? String(vd.sku).trim() : String(base.sku),
      size: sizeTxt, set_type: setTxt,
      price: { amount: price, currency: 'VND' },
      compare_at_price: { amount: compareAt ?? price, currency: 'VND' },
      discount_percent: vDiscount(vd, price, compareAt),
      status: 'active',
    });
    return true;
  };
  // Bien the mac dinh (tu variation khong tham so).
  if (d && defPrice) pushVariant(defSetId, defSizeId, d);
  const coverage = { calls: 0, valid_extra: 0, budget: 8, status: 'default_only', notes: [] };
  if (!base.variationId || !colorId || !setGroup || !sizeGroup) {
    coverage.notes.push('thieu variation id / nhom thuoc tinh — chi co gia mac dinh');
    return { variants, coverage, defSel, colorId, defSetId, defSizeId };
  }
  const tryCombo = async (setId, sizeId) => {
    if (coverage.calls >= coverage.budget) return null;
    await sleep(DELAY_MS);
    coverage.calls += 1;
    try {
      const res = await callVariation(base.variationId, base.csrf, [colorId, setId, sizeId]);
      if (res?.error) return null;
      const dd = res.data ?? null;
      if (!dd || !vPrice(dd)) return null;
      const sel = (dd.selected_attributes ?? []).map((a) => String(a.id));
      const matchesRequested = sel.includes(String(setId)) && sel.includes(String(sizeId));
      const differs = (dd.sku && dd.sku !== defSku) || vPrice(dd) !== defPrice;
      if (matchesRequested || differs) {
        if (pushVariant(setId, sizeId, dd)) coverage.valid_extra += 1;
        return dd;
      }
      return null; // server tra ve bien the mac dinh -> to hop khong hop le
    } catch (e) {
      coverage.notes.push(`variation ${setId}/${sizeId} loi: ${e.message}`);
      return null;
    }
  };
  const bedSizes = sizeGroup.options.filter((o) => ['160x200', '180x200', '200x220'].includes(o.txt));
  const bedSizeIds = bedSizes.map((o) => o.id);
  // Toi uu: san pham khong co size giuong (vo goi, phu kien le...) thi bang gia
  // theo size khong ton tai — bo qua cac lan goi variation, chi giu gia mac dinh.
  if (bedSizes.length === 0) {
    coverage.notes.push('khong co size giuong 160x200/180x200/200x220 — chi co gia mac dinh');
    coverage.status = variants.length > 1 ? 'partial' : 'default_only';
    return { variants, coverage, defSel, colorId, defSetId, defSizeId };
  }
  // 1) Bo mac dinh: them 2 size con lai.
  if (defSetId && defSizeId) {
    for (const sz of bedSizeIds.filter((id) => id !== defSizeId)) await tryCombo(defSetId, sz);
  }
  // 2) Cac kieu bo "Bo ..." khac: 1 lan goi o size mac dinh.
  const otherBoSets = setGroup.options.filter((o) => o.id !== defSetId && /^Bộ/.test(o.txt));
  const validBoSets = [];
  for (const st of otherBoSets.slice(0, 5)) {
    const dd = defSizeId ? await tryCombo(st.id, defSizeId) : null;
    if (dd) validBoSets.push(st.id);
    if (coverage.calls >= coverage.budget) break;
  }
  // 3) Neu con ngan sach: them size cho cac bo vua thay hop le.
  for (const setId of validBoSets) {
    for (const sz of bedSizeIds.filter((id) => id !== defSizeId)) {
      if (coverage.calls >= coverage.budget) break;
      await tryCombo(setId, sz);
    }
    if (coverage.calls >= coverage.budget) break;
  }
  // 4) Neu con ngan sach: cac loai Ga don o size mac dinh.
  if (coverage.calls < coverage.budget && defSizeId) {
    for (const st of setGroup.options.filter((o) => o.id !== defSetId && /^Ga/.test(o.txt)).slice(0, 3)) {
      await tryCombo(st.id, defSizeId);
      if (coverage.calls >= coverage.budget) break;
    }
  }
  coverage.status = variants.length >= 4 ? 'full' : variants.length > 1 ? 'partial' : 'default_only';
  return { variants, coverage, defSel, colorId, defSetId, defSizeId };
}

// ---------- Main ----------
async function main() {
  mkdirSync(`${ROOT}/data`, { recursive: true });
  let discovery;
  if (SKIP_DISCOVERY && existsSync(`${ROOT}/data/discovery.json`)) {
    discovery = JSON.parse(readFileSync(`${ROOT}/data/discovery.json`, 'utf8'));
    console.log(`[discovery] Dung lai discovery.json: ${discovery.urls.length} URL danh muc`);
  } else {
    discovery = await discover();
  }
  let urls = discovery.urls;
  if (Number.isFinite(LIMIT)) urls = urls.slice(0, LIMIT);
  console.log(`[full] Se chay ${urls.length} san pham`);

  // Doc ban thu 7 san pham de doi chieu gia.
  let trialBySku = {};
  try {
    const trial = JSON.parse(readFileSync(`${ROOT}/../everon-scraper-trial/data/products-bo-chan-ga.json`, 'utf8'));
    trialBySku = Object.fromEntries((trial.products ?? []).map((p) => [p.sku, p]));
  } catch { /* bo qua neu khong co file thu */ }

  let done = new Map();
  if (RESUME && existsSync(`${ROOT}/${STATE_FILE}`)) {
    const st = JSON.parse(readFileSync(`${ROOT}/${STATE_FILE}`, 'utf8'));
    for (const p of st.products ?? []) done.set(p.sku, p);
    console.log(`[resume] Da co ${done.size} san pham trong checkpoint`);
  }
  const skipped = [];
  const coverageStats = [];
  const priceChanges = [];
  const jsonlLines = [];
  if (RESUME) {
    // Nap lai jsonl cu neu co
    try { jsonlLines.push(...readFileSync(`${ROOT}/${JSONL_FILE}`, 'utf8').trim().split('\n').filter(Boolean)); } catch {}
  }
  const saveCheckpoint = (products) => {
    writeFileSync(`${ROOT}/${STATE_FILE}`, JSON.stringify({ updated_at: new Date().toISOString(), count: products.length, products }, null, 2));
    writeFileSync(`${ROOT}/${JSONL_FILE}`, jsonlLines.join('\n') + (jsonlLines.length ? '\n' : ''));
  };

  for (const url of urls) {
    const slugGuess = url.split('/san-pham/')[1];
    if ([...done.values()].some((p) => p.source?.url === url)) { console.log(`[skip-da-co] ${url}`); continue; }
    await sleep(DELAY_MS);
    try {
      const html = await fetchText(url);
      const base = extractBase(html, url);
      let defVar = null;
      if (base.variationId) {
        await sleep(DELAY_MS);
        try { defVar = await callVariation(base.variationId, base.csrf, []); } catch (e) { console.log(`[variation-loi] ${base.sku}: ${e.message}`); }
      }
      const d = defVar?.data ?? null;
      // Gia mac dinh: uu tien variation JSON, doi chieu voi price-box tren trang.
      const varPrice = vPrice(d);
      const varCompare = vCompare(d);
      const pagePrice = base.price;
      if (varPrice && pagePrice && varPrice !== pagePrice) {
        console.log(`[gia-lech] ${base.sku}: variation ${varPrice} != trang ${pagePrice} — dung variation`);
      }
      const price = varPrice ?? pagePrice;
      const compareAt = varCompare ?? base.compareAt ?? price;
      const discount = d ? vDiscount(d, price, compareAt) : base.discount;
      // SKU san pham lay tu trang (coreSku), KHONG lay data.sku cua variation
      // (do la SKU bien the). Chi dung variation lam du phong khi trang khong co.
      const sku = base.sku ?? coreSku(d?.sku) ?? coreSku(base.skuOnPage)
        ?? (d?.sku && /^[A-Z0-9]{3,}$/.test(String(d.sku).trim()) ? String(d.sku).trim().toUpperCase() : null);
      const name = (d?.name && d.name !== sku ? d.name : null) ?? (base.nameFromTitle || sku);
      if (!sku) { skipped.push({ url, reason: 'khong xac dinh duoc SKU' }); console.log(`[skip] ${url}: khong xac dinh duoc SKU`); continue; }
      if (done.has(sku)) { console.log(`[trung-sku] ${sku}`); continue; }
      const { variants, coverage } = await buildVariants(base, defVar);
      // Bien the mac dinh neu variation khong tra ve: dung gia trang.
      if (variants.length === 0 && price) {
        variants.push({
          sku: `${sku}-160`, size: '160x200', set_type: 'Bộ ga chun chần',
          price: { amount: price, currency: 'VND' },
          compare_at_price: { amount: compareAt ?? price, currency: 'VND' },
          discount_percent: discount ?? 0, status: 'active',
        });
        coverage.status = 'default_only';
        coverage.notes.push('variation khong tra ve bien the — dung gia mac dinh tu trang');
      }
      const media = base.images.slice(0, 3).map((src, i) => ({
        type: 'image', role: i === 0 ? 'cover' : 'gallery',
        src: `assets/img/products/${String(sku).toLowerCase()}/${i === 0 ? 'cover' : `img-${i + 1}`}.webp`,
        source_url: src, alt: `Bộ chăn ga ${name} - ${sku}`, width: 600, height: null,
      }));
      if (media.length === 0 && d?.image) {
        media.push({ type: 'image', role: 'cover', src: `assets/img/products/${String(sku).toLowerCase()}/cover.webp`, source_url: `${BASE}${d.image}`, alt: `Bộ chăn ga ${name} - ${sku}`, width: 540, height: 600 });
      }
      const product = {
        id: String(sku).toLowerCase(), sku, slug: base.slug || slugify(name, sku), name,
        category_ids: ['bo-chan-ga'], collection_ids: base.collections,
        description: (d?.short_description || null) ?? base.desc,
        attributes: {
          material: base.material, colors: base.colors,
          pattern: base.pattern, pattern_type: base.patternType, origin: base.origin,
          set_types: base.setTypes,
        },
        variants, media,
        price: price ? { amount: price, currency: 'VND' } : null,
        compare_at_price: (compareAt ?? price) ? { amount: compareAt ?? price, currency: 'VND' } : null,
        discount_percent: discount ?? 0,
        local_override: null,
        source: { site: 'everon.com', url, updated_at: new Date().toISOString().slice(0, 10) },
        synced_at: new Date().toISOString(),
        status: (base.outOfStock || (d && Number(d.stock) === 0)) ? 'out_of_stock' : 'active',
      };
      const errors = [];
      if (!sku) errors.push('thieu SKU');
      if (!name) errors.push('thieu ten');
      if (!price) errors.push('thieu gia');
      if (media.length === 0) errors.push('thieu anh');
      if (errors.length) { skipped.push({ url, sku, reason: errors.join(', ') }); console.log(`[skip] ${url}: ${errors.join(', ')}`); continue; }
      // Doi chieu voi ban thu 7 san pham.
      const old = trialBySku[sku];
      if (old) {
        const oldPrice = old.price?.amount;
        if (oldPrice && oldPrice !== price) {
          priceChanges.push({ sku, name, old_price: oldPrice, new_price: price, old_discount: old.discount_percent, new_discount: discount, status: product.status });
          console.log(`[gia-doi] ${sku}: ${oldPrice} -> ${price}`);
        }
      }
      coverageStats.push({ sku, name, variants: variants.length, price_table_status: coverage.status, variation_calls: coverage.calls, notes: coverage.notes });
      done.set(sku, product);
      jsonlLines.push(JSON.stringify(product));
      saveCheckpoint([...done.values()]);
      consecutiveErrors = 0;
      console.log(`[ok] ${sku} — ${name} — ${(price ?? 0).toLocaleString('vi-VN')}đ — ${variants.length} bien the (${coverage.status}) — ${done.size}/${urls.length}`);
    } catch (e) {
      consecutiveErrors += 1;
      skipped.push({ url, reason: String(e.message) });
      console.log(`[loi] ${url}: ${e.message} (loi lien tiep: ${consecutiveErrors})`);
      if (consecutiveErrors >= 10) { console.log('[dung] Qua nhieu loi lien tiep — dung chay, giu lai phan da xong.'); break; }
    }
  }

  const products = [...done.values()];
  const out = {
    schema_version: 1,
    category: { id: 'bo-chan-ga', name: 'Bộ chăn ga', product_count_on_source: discovery.category_count_on_source, source_url: CATEGORY_URL },
    source: { site: 'everon.com', category_url: CATEGORY_URL, sitemap_url: SITEMAP_URL, crawled_at: new Date().toISOString() },
    synced_at: new Date().toISOString(),
    count: products.length,
    products,
  };
  writeFileSync(`${ROOT}/${OUT}`, JSON.stringify(out, null, 2) + '\n', 'utf8');
  const stats = {
    crawled_at: new Date().toISOString(),
    discovery: { ...discovery, urls: undefined, lastmod_by_url: undefined },
    total_urls: urls.length,
    success: products.length,
    skipped: skipped.length,
    out_of_stock: products.filter((p) => p.status === 'out_of_stock').length,
    missing_material: products.filter((p) => !p.attributes.material).map((p) => p.sku),
    missing_colors: products.filter((p) => !(p.attributes.colors ?? []).length).map((p) => p.sku),
    missing_collections: products.filter((p) => !(p.collection_ids ?? []).length).map((p) => p.sku),
    price_table: {
      full: coverageStats.filter((c) => c.price_table_status === 'full').length,
      partial: coverageStats.filter((c) => c.price_table_status === 'partial').length,
      default_only: coverageStats.filter((c) => c.price_table_status === 'default_only').length,
    },
    price_changes_vs_trial: priceChanges,
    skipped_list: skipped,
    coverage: coverageStats,
  };
  writeFileSync(`${ROOT}/data/run-stats.json`, JSON.stringify(stats, null, 2) + '\n', 'utf8');
  console.log(`[xong] Thanh cong ${products.length}/${urls.length}, bo qua ${skipped.length}. Ghi -> ${OUT}`);
}

main().catch((e) => { console.error('[full] THAT BAI:', e.message); process.exit(1); });
