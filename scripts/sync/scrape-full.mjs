// scrape-full.mjs — Chạy TOÀN BỘ 1 danh mục cho everon.site (mặc định Bộ chăn ga).
// Node.js 18+, chỉ dùng fetch có sẵn, KHÔNG dependency, KHÔNG npm install.
//
// Chạy:
//   node scripts/sync/scrape-full.mjs [--category <id>]  (mặc định bo-chan-ga;
//     tăng dần: chỉ cào lại URL mới/đổi theo sitemap lastmod, giữ lại phần
//     còn lại từ data/products.json; lần đầu hoặc khi chưa có lastmod cũ
//     thì cào toàn bộ)
//   node scripts/sync/scrape-full.mjs --category dem --full   (quét toàn bộ Đệm)
//   node scripts/sync/scrape-full.mjs --limit 5        (chạy thử 5 sản phẩm đầu)
//   node scripts/sync/scrape-full.mjs --resume         (tiếp tục từ checkpoint
//     data/state-<id>.json — chỉ dùng khi chạy tay trên máy, workflow không dùng)
//   node scripts/sync/scrape-full.mjs --limit 5 --out data/test.json
//   node scripts/sync/scrape-full.mjs --category bo-chan-ga --urls-file data/queue-urls-bo-chan-ga.txt --queue data/crawl-queue.json
//     (che do hang doi 28/11/2026: cao dung cac URL trong file, ghi dau last_crawl;
//      wrapper co partial: true de export gop theo SKU)
//   node scripts/sync/scrape-full.mjs --discover-all   (discovery ca 12 danh muc
//     -> data/queue-discovery.json, phuc vu last chunk)
//
// DANH MỤC (sửa 24/11/2026 — thêm Đệm): mỗi danh mục cào riêng ra file
// data/products-<id>.full.json; export-site-data.mjs GỘP các file danh mục
// vào data/products.json (xem README sync). Scraper KHÔNG BAO GIỜ ghi đè
// products.json trực tiếp, nên danh mục khác không bị xóa khi sync 1 danh mục.
// Trang danh mục nguồn của Đệm (/danh-muc-san-pham/dem) là trang trưng bày
// bộ sưu tập, KHÔNG có lưới sản phẩm — sản phẩm Đệm nằm ở 4 danh mục con
// (lò xo / bông ép / cao su / foam), cộng 1 URL ghim tay (xem extra_urls).
//
// TĂNG DẦN THEO LASTMOD (sửa 23/11/2026): lastmod lấy từ sitemap.xml
// (đã sửa regex — trước đây regex sai nên lastmod luôn null) so với
// lastmod đã lưu trong data/sync-state.json (do export-site-data.mjs
// duy trì). URL không đổi được giữ lại từ data/products.json, không
// cào lại. Chủ nhật quét toàn bộ để bắt mọi thay đổi mà lastmod bỏ sót.
//
// LIET KE BIEN THE LE + TON KHO TUNG BIEN THE (sua 23/11/2026):
// - Ban cu chi liet ke (Bo/Ga) x (size giuong) nen bo sot bien the le nhu
//   'Vo goi om 80x100' (EPM22064, SKU EVG80100EPM22064). Ban moi liet ke them
//   loai Vo goi / Vo chan / Chan va size nho (45x65, 80x100...), ngan sach
//   goi variation 8 -> 20 -> 26 -> 32 (xem buildVariants; 32 tu 26/11/2026).
//   thu het loai Bo/Ga + vong vet combo buoc 6a can them luot goi).
// - Moi bien the ghi them truong stock (so luong ton rieng bien the do,
//   null neu khong ro). Trang chi tiet chua hien thi ton tung bien the —
//   cho anh quyet cach hien thi (xem README goi PR).
// - Ngan sach goi variation 8 -> 20 -> 26 -> 32 (32 tu 26/11/2026: buoc 1
//   chi thu size chuan truoc + buoc 6b vet size le sau vong vet vo goi;
//   xem buildVariants).
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
// SKU PIN (them 26/11/2026): data/sku-pins.json — { slug: SKU, ... }.
// Mot so san pham co .sku tren trang KHONG ON DINH giua cac lan cao: the
// .sku la SKU cua bien the mac dinh dang duoc phuc vu, ma hoa ca kich
// thuoc (vd khan-soi-tre: luc EKTAM70140PK, luc EKMAT4080PK; soc-nau:
// .sku EKTAM70140BS nhung bien the mac dinh EKMAT4080BS; khan-lau:
// .sku EKDNANGSTK4040_S2 chua "_" nen coreSku khong bat duoc). Neu de
// scraper tu suy SKU tu .sku, sync sau co the doi ma san pham -> san
// pham cu "bien mat" + san pham moi xuat hien, URL cu hong (cua hang
// an toan >10% moi chan, 1-2 SP doi ma se lot). Pin buoc scraper dung
// ma co dinh cho cac slug nay (truoc ca .sku). Key bat dau "_" la ghi
// chu, khong phai pin. File khong co -> {} (cao nhu cu).
const SKU_PINS = (() => {
  try {
    const p = resolve(ROOT, 'data', 'sku-pins.json');
    if (!existsSync(p)) return {};
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    const pins = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('_')) continue;
      if (typeof v === 'string' && v.trim()) pins[k] = v.trim();
    }
    return pins;
  } catch { return {}; }
})();
if (Object.keys(SKU_PINS).length) console.log(`[sku-pins] ${Object.keys(SKU_PINS).length} pin`);
// Loai bo biet truoc (dung de suy nhan loai bo tu TEN san pham khi khong co
// nhom loai; thu tu dai -> ngan de .find tra ve loai cu the nhat).
const KNOWN_SET_TYPES = ['Bộ ga chun chần bốn mùa', 'Bộ ga chun chần', 'Bộ chăn bốn mùa', 'Bộ ga phủ', 'Bộ ga chun', 'Ga chun chần', 'Ga chun', 'Ga phủ'];
// Danh mục nguồn (mỗi danh mục = 1 lần chạy scraper, 1 file products-<id>.full.json).
// - urls: các trang danh mục nguồn để discovery (phân trang ?page=1..N).
// - source_url: trang danh mục cha để ghi vào dữ liệu + categories.json.
// - sub_types: map URL danh mục con -> loại con (ghi vào attributes.mattress_type).
// - extra_urls: URL sản phẩm ghim tay (có thật, mua được, nhưng không nằm
//   trong lưới danh mục nào — vd Đệm bông ép thế hệ mới JAGD3). Discovery
//   nào cũng gộp extra_urls vào, nên sync sau không làm mất sản phẩm này.
// - alt_prefix: tiền tố alt ảnh; mode: 'bedding' (logic biến thể Bộ/Ga/Vỏ
//   gối) hay 'mattress' (biến thể theo Loại/Chiều cao/Kích thước).
// Danh muc nguon (moi danh muc = 1 lan chay scraper, 1 file products-<id>.full.json).
// TOAN BO CATALOG (mo 26/11/2026): 12 danh muc, 735 san pham.
// - urls: cac trang danh muc nguon de discovery (phan trang ?page=1..N).
// - source_url: trang danh muc cha de ghi vao du lieu + categories.json.
// - sub_types: map URL danh muc con -> loai con (ghi vao attributes.mattress_type
//   neu mode 'mattress', hoac attributes.sub_type neu mode 'bedding').
// - extra_urls: URL san pham ghim tay (co that, mua duoc, nhung khong nam
//   trong luoi danh muc nao). Discovery nao cung gop extra_urls vao.
// - allowlist data/assign-<id>.json (xem discover()): BAT BUOC doi voi cac
//   danh muc co luoi chong cheo (Ga, Vo goi, Chan va vo chan, Tre em,
//   K-Bedding) — luoi nguon chua ca san pham cua danh muc khac, neu cao
//   het luoi thi export se chuyen nham san pham sang danh muc sai.
// - alt_prefix: tien to alt anh; mode: 'bedding' (logic bien the Bo/Ga/Vo
//   goi) hay 'mattress' (bien the theo Loai/Chieu cao/Kich thuoc).
const CATEGORIES = {
  'bo-chan-ga': {
    id: 'bo-chan-ga', name: 'Bộ chăn ga',
    urls: [`${BASE}/danh-muc-san-pham/bo-chan-ga`],
    source_url: `${BASE}/danh-muc-san-pham/bo-chan-ga`,
    sub_types: {}, extra_urls: [], alt_prefix: 'Bộ chăn ga', mode: 'bedding',
  },
  'dem': {
    id: 'dem', name: 'Đệm',
    urls: [
      `${BASE}/danh-muc-san-pham/dem-lo-xo`,
      `${BASE}/danh-muc-san-pham/dem-bong-ep`,
      `${BASE}/danh-muc-san-pham/dem-cao-su`,
      `${BASE}/danh-muc-san-pham/dem-foam`,
    ],
    source_url: `${BASE}/danh-muc-san-pham/dem`,
    sub_types: {
      [`${BASE}/danh-muc-san-pham/dem-lo-xo`]: 'lo-xo',
      [`${BASE}/danh-muc-san-pham/dem-bong-ep`]: 'bong-ep',
      [`${BASE}/danh-muc-san-pham/dem-cao-su`]: 'cao-su',
      [`${BASE}/danh-muc-san-pham/dem-foam`]: 'foam',
    },
    extra_urls: [`${BASE}/san-pham/dem-bong-ep-the-he-moi-jagd3`],
    extra_url_types: { [`${BASE}/san-pham/dem-bong-ep-the-he-moi-jagd3`]: 'bong-ep' },
    alt_prefix: 'Đệm', mode: 'mattress',
  },
  'dem-k-bedding': {
    id: 'dem-k-bedding', name: 'Đệm K-Bedding',
    urls: [`${BASE}/danh-muc-san-pham/dem-k-bedding`],
    source_url: `${BASE}/danh-muc-san-pham/dem-k-bedding`,
    sub_types: { [`${BASE}/danh-muc-san-pham/dem-k-bedding`]: 'bong-ep' },
    extra_urls: [], alt_prefix: 'Đệm K-Bedding', mode: 'mattress',
  },
  'k-bedding': {
    id: 'k-bedding', name: 'K-Bedding',
    urls: [
      `${BASE}/danh-muc-san-pham/bo-chan-ga-k-bedding`,
      `${BASE}/danh-muc-san-pham/phu-kien-k-bedding`,
    ],
    source_url: `${BASE}/danh-muc-san-pham/bo-chan-ga-k-bedding`,
    sub_types: {
      [`${BASE}/danh-muc-san-pham/bo-chan-ga-k-bedding`]: 'bo-chan-ga',
      [`${BASE}/danh-muc-san-pham/phu-kien-k-bedding`]: 'phu-kien',
    },
    extra_urls: [], alt_prefix: 'K-Bedding', mode: 'bedding',
  },
  'tre-em': {
    id: 'tre-em', name: 'Trẻ em',
    urls: [
      `${BASE}/danh-muc-san-pham/chan-ga-goi-tre-em`,
      `${BASE}/danh-muc-san-pham/bo-chan-ga-tre-em`,
      `${BASE}/danh-muc-san-pham/chan-va-vo-chan-tre-em`,
      `${BASE}/danh-muc-san-pham/vo-goi-tre-em`,
      `${BASE}/danh-muc-san-pham/ruot-goi-chan-tre-em`,
      `${BASE}/danh-muc-san-pham/phu-kien-tre-em`,
      `${BASE}/danh-muc-san-pham/tam-trai-topper-tre-em`,
    ],
    source_url: `${BASE}/danh-muc-san-pham/chan-ga-goi-tre-em`,
    sub_types: {
      [`${BASE}/danh-muc-san-pham/chan-ga-goi-tre-em`]: 'chan-ga-goi',
      [`${BASE}/danh-muc-san-pham/bo-chan-ga-tre-em`]: 'bo-chan-ga',
      [`${BASE}/danh-muc-san-pham/chan-va-vo-chan-tre-em`]: 'chan-va-vo-chan',
      [`${BASE}/danh-muc-san-pham/vo-goi-tre-em`]: 'vo-goi',
      [`${BASE}/danh-muc-san-pham/ruot-goi-chan-tre-em`]: 'ruot',
      [`${BASE}/danh-muc-san-pham/phu-kien-tre-em`]: 'phu-kien',
      [`${BASE}/danh-muc-san-pham/tam-trai-topper-tre-em`]: 'tam-trai',
    },
    extra_urls: [], alt_prefix: 'Trẻ em', mode: 'bedding',
  },
  'bo-chan-ga-artemis': {
    id: 'bo-chan-ga-artemis', name: 'Bộ chăn ga Artemis',
    urls: [`${BASE}/danh-muc-san-pham/bo-chan-ga-artemis`],
    source_url: `${BASE}/danh-muc-san-pham/bo-chan-ga-artemis`,
    sub_types: {}, extra_urls: [], alt_prefix: 'Bộ chăn ga Artemis', mode: 'bedding',
  },
  'ga': {
    id: 'ga', name: 'Ga',
    urls: [`${BASE}/danh-muc-san-pham/ga`],
    source_url: `${BASE}/danh-muc-san-pham/ga`,
    sub_types: {}, extra_urls: [], alt_prefix: 'Ga', mode: 'bedding',
  },
  'vo-goi': {
    id: 'vo-goi', name: 'Vỏ gối',
    urls: [
      `${BASE}/danh-muc-san-pham/vo-goi`,
      `${BASE}/danh-muc-san-pham/vo-goi-tua`,
    ],
    source_url: `${BASE}/danh-muc-san-pham/vo-goi`,
    sub_types: { [`${BASE}/danh-muc-san-pham/vo-goi-tua`]: 'vo-goi-tua' },
    extra_urls: [], alt_prefix: 'Vỏ gối', mode: 'bedding',
  },
  'chan-va-vo-chan': {
    id: 'chan-va-vo-chan', name: 'Chăn và vỏ chăn',
    urls: [
      `${BASE}/danh-muc-san-pham/chan-va-vo-chan`,
      `${BASE}/danh-muc-san-pham/chan`,
    ],
    source_url: `${BASE}/danh-muc-san-pham/chan-va-vo-chan`,
    sub_types: { [`${BASE}/danh-muc-san-pham/chan`]: 'chan' },
    extra_urls: [`${BASE}/san-pham/chan-ni-popcorn`],
    extra_url_types: {},
    alt_prefix: 'Chăn và vỏ chăn', mode: 'bedding',
  },
  'ruot': {
    id: 'ruot', name: 'Ruột gối / Ruột chăn',
    urls: [
      `${BASE}/danh-muc-san-pham/ruot-goi`,
      `${BASE}/danh-muc-san-pham/ruot-chan-2`,
    ],
    source_url: `${BASE}/danh-muc-san-pham/ruot`,
    sub_types: {
      [`${BASE}/danh-muc-san-pham/ruot-goi`]: 'ruot-goi',
      [`${BASE}/danh-muc-san-pham/ruot-chan-2`]: 'ruot-chan',
    },
    extra_urls: [], alt_prefix: 'Ruột', mode: 'bedding',
  },
  'goi': {
    id: 'goi', name: 'Gối',
    urls: [`${BASE}/danh-muc-san-pham/goi`],
    source_url: `${BASE}/danh-muc-san-pham/goi`,
    sub_types: {},
    extra_urls: [
      `${BASE}/san-pham/goi-chu-u-5s`,
      `${BASE}/san-pham/goi-chong-trao-nguoc-everon`,
      `${BASE}/san-pham/goi-tua-everon`,
      `${BASE}/san-pham/goi-5s`,
      `${BASE}/san-pham/goi-dinh-hinh`,
    ],
    extra_url_types: {},
    alt_prefix: 'Gối', mode: 'bedding',
  },
  'phu-kien': {
    id: 'phu-kien', name: 'Phụ kiện',
    urls: [
      `${BASE}/danh-muc-san-pham/phu-kien-dem`,
      `${BASE}/danh-muc-san-pham/phu-kien-khac`,
      `${BASE}/danh-muc-san-pham/phu-kien-trang-tri`,
      `${BASE}/danh-muc-san-pham/tam-trai`,
      `${BASE}/danh-muc-san-pham/topper-tam-trai`,
      `${BASE}/danh-muc-san-pham/bao-ve-dem-chong-tham`,
    ],
    source_url: `${BASE}/danh-muc-san-pham/phu-kien`,
    sub_types: {
      [`${BASE}/danh-muc-san-pham/phu-kien-dem`]: 'phu-kien-dem',
      [`${BASE}/danh-muc-san-pham/phu-kien-khac`]: 'phu-kien-khac',
      [`${BASE}/danh-muc-san-pham/phu-kien-trang-tri`]: 'phu-kien-trang-tri',
      [`${BASE}/danh-muc-san-pham/tam-trai`]: 'tam-trai',
      [`${BASE}/danh-muc-san-pham/topper-tam-trai`]: 'topper',
      [`${BASE}/danh-muc-san-pham/bao-ve-dem-chong-tham`]: 'bao-ve-dem',
    },
    extra_urls: [
      `${BASE}/san-pham/khan-cotton-cao-cap-hoa-tiet-hoa-xanh`,
      `${BASE}/san-pham/khan-cotton-cao-cap-hoa-tiet-hoa-be`,
      `${BASE}/san-pham/khan-cotton-cao-cap-hoa-tiet-soc-nau`,
      `${BASE}/san-pham/khan-cotton-cao-cap-hoa-tiet-soc-den`,
      `${BASE}/san-pham/khan-cotton-cao-cap-hoa-tiet-xam`,
      `${BASE}/san-pham/khan-cotton-cao-cap-hoa-tiet-xanh-duong`,
      `${BASE}/san-pham/khan-soi-tre`,
      `${BASE}/san-pham/khan-lau-everon`,
      `${BASE}/san-pham/khan-modal-cao-cap`,
      `${BASE}/san-pham/rem-voan-trang-tri`,
      `${BASE}/san-pham/rem-vai-can-nang-80-100`,
      `${BASE}/san-pham/rem-vai-can-nang-100`,
      `${BASE}/san-pham/binhcoc-giu-nhiet-everon`,
    ],
    extra_url_types: {},
    alt_prefix: 'Phụ kiện', mode: 'bedding',
  },
};
const CATEGORY_ID = argVal('--category') ?? 'bo-chan-ga';
const CAT = CATEGORIES[CATEGORY_ID];
if (!CAT) { console.error(`[loi] --category khong biet: ${CATEGORY_ID} (co: ${Object.keys(CATEGORIES).join(', ')})`); process.exit(2); }
const CATEGORY_URL = CAT.urls[0]; // trang danh mục chính (dùng khi chỉ có 1 URL)
const LIMIT = Number(argVal('--limit') ?? NaN);
const RESUME = args.includes('--resume');
const SKIP_DISCOVERY = args.includes('--skip-discovery');
// Che do hang doi (them 28/11/2026 — sync chia chunk theo file hang doi):
//   --urls-file <path> : cao DUNG cac URL trong file (1 URL/dong), bo qua
//     discovery/lastmod. Dung kem --category (danh muc chinh cua batch) va
//     --queue (file hang doi de ghi dau last_crawl).
//   --queue <path>     : file hang doi data/crawl-queue.json — ghi dau
//     last_crawl (va status 'gone' neu URL tra 404) sau moi URL cao xong.
//   --discover-all     : chi chay discovery cho ca 12 danh muc roi thoat
//     (ghi data/queue-discovery.json, phuc vu last chunk).
//   --discover-only    : chi chay discovery cho 1 danh muc roi thoat
//     (duoc --discover-all goi qua tien trinh con).
const URLS_FILE = argVal('--urls-file') ?? null;
const QUEUE_FILE = argVal('--queue') ?? null;
const DISCOVER_ALL = args.includes('--discover-all');
const QUEUE_MODE = URLS_FILE !== null;
const FULL = args.includes('--full') || QUEUE_MODE; // quet toan bo: bo qua lastmod, cao lai tat ca URL
// File ra theo danh mục (để export-site-data.mjs gộp nhiều danh mục;
// file trung gian này KHÔNG commit — workflow dọn sau mỗi lần chạy).
const OUT = argVal('--out') ?? `data/products-${CATEGORY_ID}.full.json`;
const STATE_FILE = `data/state-${CATEGORY_ID}.json`;
const JSONL_FILE = `data/products-${CATEGORY_ID}.full.jsonl`;
const DISCOVERY_FILE = `data/discovery-${CATEGORY_ID}.json`;
const RUN_STATS_FILE = `data/run-stats-${CATEGORY_ID}.json`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let consecutiveErrors = 0;

// ---------- Ho tro che do hang doi (28/11/2026) ----------
function loadQueue() {
  try { return JSON.parse(readFileSync(resolve(ROOT, QUEUE_FILE), 'utf8')); } catch { return []; }
}
function saveQueue(q) {
  mkdirSync(resolve(ROOT, 'data'), { recursive: true });
  writeFileSync(resolve(ROOT, QUEUE_FILE), JSON.stringify(q, null, 2) + '\n', 'utf8');
}
// Ghi dau "da cao" cho 1 URL trong file hang doi (goi sau moi san pham cao xong).
function markQueueCrawled(url) {
  if (!QUEUE_FILE) return;
  const q = loadQueue();
  const e = q.find((x) => x.url === url);
  if (e) { e.last_crawl = new Date().toISOString(); delete e.status; saveQueue(q); }
}
// Danh dau URL da bien mat khoi nguon (HTTP 404): last chunk se xoa khoi file.
function markQueueGone(url) {
  if (!QUEUE_FILE) return;
  const q = loadQueue();
  const e = q.find((x) => x.url === url);
  if (e) { e.last_crawl = new Date().toISOString(); e.status = 'gone'; saveQueue(q); }
}
// Muc hang doi cua 1 URL (de lay danh sach danh muc + sub_type cua san pham).
function queueEntryFor(url) {
  if (!QUEUE_FILE) return null;
  return loadQueue().find((x) => x.url === url) ?? null;
}
// Discovery cho ca 12 danh muc (phuc vu last chunk): chay discover() nguyen ven
// cho tung danh muc qua tien trinh con (de khong phai sua discover()), roi gop
// thanh data/queue-discovery.json: { urls: [{url, categories, sub_type, lastmod}],
// sitemap_product_urls: [...] }. 1 URL co the xuat hien o nhieu luoi danh muc —
// giu TAT CA danh muc (de san pham giu du category_ids nhu truoc day).
async function discoverAll() {
  const { execFileSync } = await import('node:child_process');
  const self = fileURLToPath(import.meta.url);
  const byUrl = new Map();
  for (const id of Object.keys(CATEGORIES)) {
    console.log(`[discover-all] ${id} ...`);
    execFileSync(process.execPath, [self, '--category', id, '--discover-only'], { stdio: 'inherit' });
    const d = JSON.parse(readFileSync(`${ROOT}/data/discovery-${id}.json`, 'utf8'));
    const lm = d.lastmod_by_url ?? {};
    for (const u of d.urls) {
      const cur = byUrl.get(u);
      if (!cur) byUrl.set(u, { url: u, categories: [id], sub_type: d.sub_type_by_url?.[u] ?? null, lastmod: lm[u] ?? null });
      else if (!cur.categories.includes(id)) cur.categories.push(id);
    }
  }
  // Sitemap (1 lan): danh sach SP that tren nguon, de last chunk biet SP nao
  // da bien mat (khong con trong sitemap lan nao nua).
  const sm = await fetchText(SITEMAP_URL, { accept: 'application/xml, text/html' });
  const sitemapProductUrls = [...sm.matchAll(/<loc>(https:\/\/everon\.com\/san-pham\/[^<]+)<\/loc>/g)].map((m) => m[1]);
  console.log(`[discover-all] sitemap: ${sitemapProductUrls.length} URL san-pham`);
  mkdirSync(`${ROOT}/data`, { recursive: true });
  writeFileSync(`${ROOT}/data/queue-discovery.json`, JSON.stringify({ crawled_at: new Date().toISOString(), count: byUrl.size, urls: [...byUrl.values()], sitemap_product_urls: sitemapProductUrls }, null, 2) + '\n');
  console.log(`[discover-all] Xong: ${byUrl.size} URL duy nhat tu ${Object.keys(CATEGORIES).length} danh muc -> data/queue-discovery.json`);
}

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
// Ma san pham that tren trang phu kien (vd EGO6638CD, EGT4545KM1,
// EGTTG8558PN310511) ket thuc bang CHU nen regex cu ([A-Z]{2,5}\d{3,5}$)
// khong bat duoc -> coreSku tra null -> scraper skip mat san pham.
// Thu tu: (1) tach ma chuan o cuoi neu co (EBBM1620EPC27027 -> EPC27027);
// (2) neu khong tach duoc ma van la ma that (bat dau bang >=2 chu hoa,
// co chu so, dai >=6) thi dung nguyen ma .sku.
const coreSku = (code) => {
  if (!code) return null;
  const m1 = String(code).trim().match(/([A-Z]{2,5}\d{3,5})\s*$/);
  if (m1) return m1[1];
  const verbatim = String(code).trim();
  if (/^[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*$/.test(verbatim) && verbatim.length >= 6) return verbatim.toUpperCase();
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
  // Sitemap that su lastmod cho MOI URL, nhung thu tu the la
  // <loc> -> <priority> -> <lastmod> -> <changefreq>. Regex cu chi bat
  // <lastmod> khi no dung ngay sau </loc> nen luon tra null (da kiem
  // chung 23/11/2026: ca 189 URL danh muc deu null). Doc theo tung khoi
  // <url>...</url> va lay loc + lastmod rieng thi moi dung.
  const entries = [...sm.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map((m) => ({
      url: m[1].match(/<loc>([^<]+)<\/loc>/)?.[1] ?? null,
      lastmod: m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? null,
    }))
    .filter((e) => e.url);
  const sitemapProducts = entries.filter((e) => e.url.includes('/san-pham/'));
  console.log(`[discovery] sitemap: ${entries.length} URL, trong do ${sitemapProducts.length} URL san-pham`);
  const sitemapSet = new Set(sitemapProducts.map((e) => e.url));
  const lastmodByUrl = Object.fromEntries(sitemapProducts.map((e) => [e.url, e.lastmod]));

  // Cào từng trang danh mục nguồn (mỗi trang phân trang ?page=1..N).
  // Lưu ý: trang cha của Đệm (/dem) là trang trưng bày bộ sưu tập, KHÔNG
  // có lưới sản phẩm — chỉ 4 trang con mới có lưới; vì vậy CATEGORIES.dem
  // liệt kê 4 URL con, không dùng URL cha để discovery.
  let catUrls = [];  // let: allowlist o duoi co the loc lai danh sach nay
  const subTypeByUrl = {};
  let catCount = 0;
  let pagesFetched = 0;
  for (const catUrl of CAT.urls) {
    let page = 1;
    let pageCount = null;
    for (;;) {
      const html = await fetchText(`${catUrl}?page=${page}`);
      if (pageCount === null) pageCount = Number(text(html).match(/(\d+)\s*sản phẩm/)?.[1] ?? NaN);
      const gridStart = html.indexOf('list-product');
      const grid = gridStart >= 0 ? html.slice(gridStart) : html;
      const links = [...new Set([...grid.matchAll(/href="(https:\/\/everon\.com\/san-pham\/[^"?#]+)"/g)].map((m) => m[1]))];
      console.log(`[discovery] ${catUrl} trang ${page}: ${links.length} link`);
      if (links.length === 0) break;
      // Khi trang KHÔNG có lưới 'list-product' (vd trang cha /dem), toàn
      // bộ HTML vẫn có link san-pham (sản phẩm nổi bật) — KHÔNG lấy, vì
      // đó không phải sản phẩm của danh mục này. Chỉ lấy khi có lưới.
      if (gridStart < 0) { console.log(`[discovery] ${catUrl}: khong co luoi list-product — bo qua trang nay`); break; }
      links.forEach((u) => {
        if (!catUrls.includes(u)) catUrls.push(u);
        const sub = CAT.sub_types[catUrl];
        if (sub && !subTypeByUrl[u]) subTypeByUrl[u] = sub;
      });
      await sleep(DELAY_MS);
      page += 1;
      pagesFetched += 1;
      if (page > 30) break; // phong thu
      // het trang khi khong con nut next / het so trang trong pagination
      if (!html.includes(`?page=${page}`) && !html.includes(`page=${page}`)) break;
    }
    if (Number.isFinite(pageCount)) catCount += pageCount;
  }
  // URL ghim tay (extra_urls): sản phẩm có thật nhưng không nằm trong lưới
  // danh mục nào. Gộp vào discovery mọi lần chạy để sync sau không làm mất.
  for (const u of CAT.extra_urls) {
    if (!catUrls.includes(u)) { catUrls.push(u); console.log(`[discovery] URL ghim tay: ${u}`); }
    const t = CAT.extra_url_types?.[u];
    if (t && !subTypeByUrl[u]) subTypeByUrl[u] = t;
  }
  // Allowlist (data/assign-<id>.json): neu co, chi giu URL trong allowlist.
  // Ly do: luoi danh muc nguon chong cheo nhau — vd luoi Ga co 170 URL
  // nhung 157 trong do la Bo chan ga (set nao cung co Ga); neu cao het
  // luoi Ga thi export se chuyen nham 157 SP sang Ga. Allowlist do
  // discovery-toan-catalog dinh san (1 SP = 1 danh muc chinh), gom
  // [{url, sub_type}]; URL trong allowlist nhung khong co trong luoi
  // (san pham that nhung khong nam trong luoi nao) cung duoc them vao.
  // sub_type trong allowlist thang (ghi vao attributes.sub_type /
  // attributes.mattress_type tuy mode). Neu khong co file allowlist thi
  // dung luoi day du nhu cu.
  let assignList = null;
  try {
    assignList = JSON.parse(readFileSync(`${ROOT}/data/assign-${CAT.id}.json`, 'utf8'));
  } catch { /* khong co allowlist: dung luoi day du */ }
  if (Array.isArray(assignList) && assignList.length) {
    const allowed = new Map(assignList.map((e) => [e.url, e.sub_type ?? null]));
    const beforeFilter = catUrls.length;
    catUrls = catUrls.filter((u) => allowed.has(u));
    for (const u of allowed.keys()) if (!catUrls.includes(u)) catUrls.push(u);
    for (const k of Object.keys(subTypeByUrl)) delete subTypeByUrl[k];
    for (const u of catUrls) { const st = allowed.get(u); if (st) subTypeByUrl[u] = st; }
    console.log(`[discovery] allowlist data/assign-${CAT.id}.json: ${beforeFilter} -> ${catUrls.length} URL`);
  }
  const countOnSource = (Array.isArray(assignList) && assignList.length)
    ? catUrls.length
    : (Number.isFinite(catCount) ? catCount + CAT.extra_urls.length : null);
  const notInSitemap = catUrls.filter((u) => !sitemapSet.has(u));
  const sitemapNotInCat = [...sitemapSet].filter((u) => !catUrls.includes(u));
  const discovery = {
    crawled_at: new Date().toISOString(),
    category_id: CAT.id,
    category_url: CAT.source_url,
    category_urls: CAT.urls,
    category_count_on_source: countOnSource,
    category_pages_fetched: pagesFetched,
    category_urls_found: catUrls.length,
    category_urls_unique: new Set(catUrls).size,
    sub_type_by_url: subTypeByUrl,
    extra_urls: CAT.extra_urls,
    sitemap_total_urls: entries.length,
    sitemap_product_urls: sitemapProducts.length,
    sitemap_product_urls_not_in_category: sitemapNotInCat.length,
    category_urls_not_in_sitemap: notInSitemap,
    urls: catUrls,
    lastmod_by_url: lastmodByUrl,
  };
  mkdirSync(`${ROOT}/data`, { recursive: true });
  writeFileSync(`${ROOT}/${DISCOVERY_FILE}`, JSON.stringify(discovery, null, 2) + '\n');
  console.log(`[discovery] danh muc ${CAT.id}: ${catUrls.length} URL duy nhat (trang bao ${catCount} + ${CAT.extra_urls.length} ghim tay); khong co trong sitemap: ${notInSitemap.length}; sitemap co ${sitemapNotInCat.length} URL san-pham ngoai danh muc nay.`);
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
    // NGOAI TRU tu thuong hieu "everon" (duoi URL "...-everon" khong phai ma).
    : (/^[a-z0-9]{4,}$/i.test(tail) && tail.toUpperCase() !== 'EVERON' ? tail.toUpperCase() : null);
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

// ---------- Phan loai size / loai bo (sua 23/11/2026) ----------
// NGUYEN NHAN BO SOT (kiem chung live 23/11/2026, EPM22064 + EPT25029):
// ban cu chi liet ke (loai bo bat dau "Bo"/"Ga") x (size giuong
// 160x200/180x200/200x220). Bien the le nhu "Vo goi om 80x100" (EPM22064,
// SKU EVG80100EPM22064, 176.000d) nam ngoai ca hai bo loc nen khong bao
// gio duoc goi — du endpoint /product-variation tra dung bien the do khi
// goi [mau, id-loai, id-size]. To hop sai server tra ve bien the mac dinh
// va tryCombo da loai dung, nen mo rong liet ke la an toan.
const sizeDim = (txt) => {
  const m = String(txt || '').match(/(\d+)\s*x\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
// Size giuong: ca hai chieu >= 120 (160x200, 180x200, 200x220, 120x200,
// 140x200, 180x220...). Size nho (vo goi...): cac size con lai.
const isBedSize = (txt) => {
  const d = sizeDim(txt);
  return !!d && Math.min(d[0], d[1]) >= 120;
};
// Thu tu uu tien size giuong: 3 co chuan 160x200/180x200/200x220 truoc,
// roi cac co giuong khac (120x200, 140x200, 180x220...) theo thu tu trang.
// (Neu lay theo thu tu trang, buoc 1 se thu 120x200/140x200 truoc va het
// luot truoc khi toi 180x200/200x220 — da gay mat bien the o test 23/11.)
const BED_SIZE_ORDER = ['160x200', '180x200', '200x220'];
const bedSizeRank = (txt) => {
  const i = BED_SIZE_ORDER.indexOf(String(txt));
  return i >= 0 ? i : BED_SIZE_ORDER.length;
};
// Thu tu uu tien size nho cho loai vo goi: 45x65 (goi nam) va 50x70 la
// 2 co pho bien nhat, roi 80x100 (goi om), roi cac co con lai theo thu tu
// tren trang. Size khong co trong danh sach giu nguyen thu tu trang.
const SMALL_SIZE_ORDER = ['45x65', '50x70', '80x100', '35x50', '45x45', '60x80'];
const smallSizeRank = (txt) => {
  const i = SMALL_SIZE_ORDER.indexOf(String(txt));
  return i >= 0 ? i : SMALL_SIZE_ORDER.length;
};
const isBedSet = (txt) => /^(Bộ|Ga|Vỏ chăn|Chăn)/.test(String(txt || ''));
const isPillowSet = (txt) => /^Vỏ gối/.test(String(txt || ''));
// Ton kho tung bien the: endpoint tra ve stock = so luong ton cua rieng
// bien the do (vd 103, 84, 6, 2, 0). Goi khong tham so tra ve stock TONG
// cua ca san pham (vd EPT25029: 103) — KHONG dung lam ton bien the mac
// dinh; ton that cua bien the mac dinh lay tu 1 lan goi ro to hop (buoc 0
// trong buildVariants). Het / khong ro -> null.
const vStock = (vd) => {
  if (!vd || vd.stock === null || vd.stock === undefined) return null;
  const n = Number(vd.stock);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
};

async function buildVariants(base, defVar, productSku) {
  // defVar: ket qua variation khong tham so (bien the mac dinh that su cua trang).
  const d = defVar?.data ?? null;
  const defPrice = vPrice(d);
  const defCompare = vCompare(d);
  const defSku = d?.sku || productSku;
  const defSel = (d?.selected_attributes ?? []).map((a) => String(a.id));
  const groups = base.groups;
  // Nhom Mau nhan dien theo TIEU DE (khong lay groups[0]): san pham
  // K-Bedding thuong KHONG co nhom Mau (groups[0] la nhom San pham) —
  // ban cu lay nham id loai bo lam colorId, khien moi lan goi sweep
  // [colorId, setId, sizeId] chua 2 gia tri xung dot cua cung nhom
  // San pham (vd [661, 664, 64]) nen server tra ve bien the mac dinh
  // va bo sot hang loat bien the (kiem chung 26/11/2026, KMS402:
  // [661,664,64] -> mac dinh 600k, [664,64] -> that 209k).
  // Khong co nhom Mau -> colorId = null, goi chi [setId, sizeId].
  const colorGroup = groups.find((g) => /Màu/.test(g.title)) ?? null;
  const sizeGroup = groups.find((g) => /Kích thước/.test(g.title)) ?? null;
  // Truc "loai" = nhom DAU TIEN khong phai nhom Mau, khong phai nhom
  // Kich thuoc (theo thu tu tren trang) — KHONG nhat thiet mang ten
  // "San pham". Ban cu tim /San pham/ nen bo sot 2 dang san pham
  // (kiem chung 26/11/2026):
  //  - BCOR (rem): [Kich thuoc Rem, Mau Rem] — loai that la "Mau Rem"
  //    (8 hoa tiet); tim /San pham/ -> null -> singleSizeMode nen chi
  //    con 1 bien the mac dinh, mat 7 hoa tiet.
  //  - DOWNFEEL: [Mau sac, Chieu cao san pham, Kich thuoc] — loai that
  //    la "Chieu cao san pham" ("7 cm"); bo qua id chieu cao nen chi
  //    con 1 bien the thay vi 3.
  // KMS402/CPM27202 ([Mau, San pham, Kich thuoc]) van dung nhu cu.
  const setGroup = groups.find((g) => g !== colorGroup && g !== sizeGroup) ?? null;
  // San pham chi co nhom Kich thuoc (vd KMP403: khong co nhom San pham
  // lan Mau) — truoc day roi vao return som, chi giu bien the mac dinh
  // (thuc te KMP403 co them 200x220 = 1.039.000d). O che do nay quet
  // het cac size bang [sizeId]; nhan loai bo lay tu base.setTypes.
  const singleSizeMode = !setGroup;
  // Nhan loai bo cho SP chi co nhom size: cat ten SP o tu chat lieu
  // (vd "Chan he Microfiber KMP403" -> "Chan he"; "Bo ga chun
  // Microfiber KMS402" -> "Bo ga chun"). Dung ten that thay vi
  // base.setTypes[0] ("Bo ga chun chan" — sai voi SP khong phai bo ga,
  // vd khan/rem o Phu kien). Khong cat duoc thi dung setTypes[0].
  const nameCutAtMaterial = (() => {
    if (!base.material || !base.nameFromTitle) return null;
    const i = base.nameFromTitle.toLowerCase().indexOf(String(base.material).toLowerCase());
    if (i <= 0) return null;
    const label = base.nameFromTitle.slice(0, i).trim();
    return label || null;
  })();
  const singleSetLabel = singleSizeMode ? (nameCutAtMaterial
    // Nhan loai bo lay tu TEN san pham (khong lay base.setTypes — no tinh
    // tu TOAN BO trang nen co the dinh loai cua san pham lien quan, vd
    // "Dem suoi Carbon" bi gan "Bo ga chun chan"). Ten khong chua loai
    // nao thi dung "San pham" (trung thuc hon doan mo).
    ?? KNOWN_SET_TYPES.find((st) => base.nameFromTitle?.includes(st))
    ?? 'Sản phẩm') : null;
  const colorId = defSel.find((id) => colorGroup?.options.some((o) => o.id === id))
    ?? colorGroup?.options.find((o) => o.checked)?.id
    ?? colorGroup?.options[0]?.id ?? null;
  const defSetId = defSel.find((id) => setGroup?.options.some((o) => o.id === id))
    ?? setGroup?.options.find((o) => o.checked)?.id ?? null;
  const defSizeId = defSel.find((id) => sizeGroup?.options.some((o) => o.id === id))
    ?? sizeGroup?.options.find((o) => o.checked)?.id ?? null;
  // Gia tri mac dinh cua MOI nhom (theo thu tu tren trang): endpoint can
  // du 1 id cho moi nhom; nhom phu (khong phai Mau/loai/size — vd neu co
  // them nhom "Chat lieu") giu gia tri mac dinh, khong bao gio quet.
  // Lay tu defSel, roi checked, roi options[0] (giong cach lay colorId/
  // defSetId/defSizeId o tren).
  const groupDefaultId = (g) => {
    if (!g) return null;
    return defSel.find((id) => g.options.some((o) => o.id === id))
      ?? g.options.find((o) => o.checked)?.id
      ?? g.options[0]?.id ?? null;
  };
  // attrs cho 1 lan goi variation: moi nhom dong gop dung 1 id, theo thu
  // tu tren trang; nhom loai/size lay gia tri quet (neu co), nhom Mau lay
  // colorId (mac dinh, khong quet), cac nhom khac lay mac dinh.
  const attrsFor = (setId, sizeId) => groups.map((g) => {
    if (g === setGroup) return setId ?? groupDefaultId(g);
    if (g === sizeGroup) return sizeId ?? groupDefaultId(g);
    if (g === colorGroup) return colorId;
    return groupDefaultId(g);
  }).filter((x) => x != null);
  const labelOf = (group, id) => group?.options.find((o) => o.id === String(id))?.txt ?? null;
  const variants = [];
  const seen = new Set();
  const pushVariant = (setId, sizeId, vd) => {
    const setTxt = labelOf(setGroup, setId) ?? (singleSizeMode ? singleSetLabel : null);
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
      sku: vd?.sku && String(vd.sku).trim() ? String(vd.sku).trim() : String(productSku),
      size: sizeTxt, set_type: setTxt,
      price: { amount: price, currency: 'VND' },
      compare_at_price: { amount: compareAt ?? price, currency: 'VND' },
      discount_percent: vDiscount(vd, price, compareAt),
      status: 'active',
      stock: vStock(vd),
    });
    return true;
  };
  // Bien the mac dinh (tu variation khong tham so). Ton tam de null: goi
  // khong tham so tra ve stock TONG san pham, khong phai ton rieng bien the
  // — ton that lay o buoc 0 duoi day; neu buoc 0 that bai thi giu null
  // (khong ro) thay vi ghi nham tong.
  if (d && defPrice) {
    pushVariant(defSetId, defSizeId, d);
    if (variants[0]) variants[0].stock = null;
  }
  // Ngan sach goi variation: 8 -> 20 -> 26 -> 32 (32 tu 26/11/2026:
  // buoc 1 chi thu size chuan truoc + buoc 6b vet size le sau vong vet
  // vo goi, can them luot cho san pham nhieu to hop nhu CPM27202
  // (can ~31 luot de du het); 26 tu PR #18: buoc 2 thu het loai Bo/Ga
  // + vong vet combo buoc 6a. Full scan 735 SP toi da them ~1-2 gio so
  // voi muc 26 — vuot timeout 240 phut cua workflow neu chay 1 job
  // (xem README goi PR: can chia full scan theo danh muc). Sync tang
  // dan chi cao lai san pham doi theo lastmod nen gan nhu khong them
  // chi phi hang ngay.
  // Can them bien the le (vo goi, chan...) vi to hop (loai x size) nhieu
  // gap doi ban cu, va can 1 lan goi rieng lay ton that bien the mac dinh.
  const coverage = { calls: 0, valid_extra: 0, budget: 40, status: 'default_only', notes: [] };
  if (!base.variationId) {
    coverage.notes.push('thieu variation id — chi co gia mac dinh');
    return { variants, coverage, defSel, colorId, defSetId, defSizeId };
  }
  // SP khong co nhom Kich thuoc xu ly o nhanh rieng ben duoi (sau tryCombo),
  // khong return som o day nua — xem "SP KHONG CO NHOM KICH THUOC".
  if (singleSizeMode) coverage.notes.push('chi co nhom kich thuoc — quet size, nhan loai bo tu trang');
  if (sizeGroup && sizeGroup.options.length === 0) {
    coverage.notes.push('nhom kich thuoc khong co lua chon nao — chi co gia mac dinh');
    coverage.status = variants.length > 1 ? 'partial' : 'default_only';
    return { variants, coverage, defSel, colorId, defSetId, defSizeId };
  }
  const tried = new Set();
  const tryCombo = async (setId, sizeId) => {
    const tkey = `${setId}|${sizeId}`;
    if (tried.has(tkey)) return null; // da thu roi — khong goi lai, khong ton ngan sach
    tried.add(tkey);
    if (coverage.calls >= coverage.budget) return null;
    await sleep(DELAY_MS);
    coverage.calls += 1;
    try {
      // Goi du 1 id cho MOI nhom (attrsFor): nhom loai/size lay gia tri
      // quet, nhom Mau lay colorId mac dinh, nhom phu lay mac dinh.
      // Goi thua/thieu id gay xung dot, server tra ve mac dinh (xem
      // ghi chu o tren: [661,664,64] -> mac dinh).
      const res = await callVariation(base.variationId, base.csrf, attrsFor(setId, sizeId));
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
  // SP KHONG CO NHOM KICH THUOC (vd chan-ni-tre-em: chi co "Hoa tiet";
  // bo-chan-tre-em: [Loai san pham, Mau sac]; dem-suoi-cacbon / KMTP115:
  // khong co nhom nao): bien the = to hop cac truc con lai, size hien
  // "Mot co". set_type = nhan cac truc ghep bang " · " (theo quy uoc
  // mode dem: "<Loai> · <Chieu cao>"). Ban cu return som o day nen chi
  // giu 1 bien the gia mac dinh voi set_type/size doan mo ("Bo ga chun
  // chan", 160x200) — sai voi rem/khan/topper (kiem chung 26/11/2026).
  // Nhanh nay chay truoc buoc 0-6 (la nhanh size); het nhanh thi return.
  if (!sizeGroup) {
    const NO_SIZE = 'Một cỡ';
    const labelsOf = (combo) => groups.map((g, i) => labelOf(g, combo[i])).filter(Boolean).join(' · ');
    const defaultCombo = groups.map((g) => groupDefaultId(g));
    const pushNoSize = (combo, vd) => {
      const setTxt = labelsOf(combo) || singleSetLabel || 'Sản phẩm';
      const key = `${setTxt}|${NO_SIZE}`;
      if (seen.has(key)) return false;
      const price = vPrice(vd);
      const compareAt = vCompare(vd);
      if (!price) return false;
      seen.add(key);
      variants.push({
        sku: vd?.sku && String(vd.sku).trim() ? String(vd.sku).trim() : String(productSku),
        size: NO_SIZE, set_type: setTxt,
        price: { amount: price, currency: 'VND' },
        compare_at_price: { amount: compareAt ?? price, currency: 'VND' },
        discount_percent: vDiscount(vd, price, compareAt),
        status: 'active',
        stock: vStock(vd),
      });
      return true;
    };
    // Bien the mac dinh (tu variation khong tham so). Ton de null: goi
    // khong tham so tra ve stock TONG san pham, khong phai ton rieng —
    // giong quy uoc o nhanh size ben duoi.
    if (d && defPrice) {
      if (pushNoSize(defaultCombo, d)) variants[variants.length - 1].stock = null;
    }
    // Quet to hop: tich Descartes cac truc (cap 12 to hop, trong ngan sach).
    const axes = groups.map((g) => g.options.map((o) => o.id));
    const combos = [];
    const gen = (i, cur) => {
      if (combos.length >= 12) return;
      if (i === axes.length) { combos.push([...cur]); return; }
      for (const id of axes[i]) {
        cur.push(id); gen(i + 1, cur); cur.pop();
        if (combos.length >= 12) return;
      }
    };
    if (axes.length) gen(0, []);
    for (const combo of combos) {
      if (coverage.calls >= coverage.budget) break;
      if (combo.every((id, i) => id === defaultCombo[i])) continue; // da co
      await sleep(DELAY_MS);
      coverage.calls += 1;
      try {
        const res = await callVariation(base.variationId, base.csrf, combo);
        if (res?.error) continue;
        const dd = res.data ?? null;
        if (!dd || !vPrice(dd)) continue;
        const sel = (dd.selected_attributes ?? []).map((a) => String(a.id));
        const matches = combo.every((id) => sel.includes(String(id)));
        const differs = (dd.sku && dd.sku !== defSku) || vPrice(dd) !== defPrice;
        if (matches || differs) {
          if (pushNoSize(combo, dd)) coverage.valid_extra += 1;
        }
      } catch (e) {
        coverage.notes.push(`variation no-size ${combo.join('/')} loi: ${e.message}`);
      }
    }
    coverage.status = variants.length >= 4 ? 'full' : variants.length > 1 ? 'partial' : 'default_only';
    return { variants, coverage, defSel, colorId, defSetId, defSizeId };
  }
  // 0) Ton THAT + SKU THAT cua bien the mac dinh: goi ro to hop mac dinh.
  // Server tra ve ban ghi bien the con (SKU rieng, stock rieng). Neu server
  // tra ve dung ban ghi goc (cung SKU) thi khong lay stock (tranh ghi nham
  // stock tong). Rieng SKU: goi khong tham so cua SP chan tra ve ma gia
  // "EC-<ma SP>" (vd EC-EPM23063) thay vi SKU that cua bien the (vd
  // ECH1822EPM23063 — kiem chung 26/11/2026, probe endpoint + test v2.2);
  // neu SKU mac dinh la ma gia nay thi thay bang SKU that tu ban ghi ro
  // to hop (khong ton them luot goi — dung chung lan goi lay stock).
  if (d && defPrice && defSetId && defSizeId && variants[0]) {
    const dd = await tryCombo(defSetId, defSizeId);
    if (dd && dd.sku && String(dd.sku).trim() !== String(defSku)) {
      if (Number.isFinite(Number(dd.stock))) {
        variants[0].stock = Math.trunc(Number(dd.stock));
      }
      const realSku = String(dd.sku).trim();
      if (/^EC-/.test(String(defSku)) && !/^EC-/.test(realSku)) {
        variants[0].sku = realSku;
        coverage.notes.push(`sku mac dinh ${defSku} -> ${realSku} (ma gia EC-)`);
      }
    }
  }
  const bedSizeIds = sizeGroup.options.filter((o) => isBedSize(o.txt))
    .sort((a, b) => bedSizeRank(a.txt) - bedSizeRank(b.txt)).map((o) => o.id);
  const smallSizeIds = sizeGroup.options.filter((o) => !isBedSize(o.txt))
    .sort((a, b) => smallSizeRank(a.txt) - smallSizeRank(b.txt)).map((o) => o.id);
  const defSetTxt = labelOf(setGroup, defSetId);
  // Size cung ho voi bo mac dinh: bo giuong -> size giuong, vo goi -> size nho.
  // SP chi co size nho (khan lau 30x30-60x50, khan mat 40x80/70x140...):
  // bedSizeIds rong -> dung smallSizeIds, khong thi buoc 1 khong quet gi
  // ca (hoi quy khan-lau-everon 26/11/2026: chi 1 bien the vi step 1 rong
  // + mau khong bao gio quet).
  const defFamilySizes = isPillowSet(defSetTxt) ? smallSizeIds : (bedSizeIds.length ? bedSizeIds : smallSizeIds);
  const boGaSets = (setGroup?.options ?? []).filter((o) => o.id !== defSetId && /^(Bộ|Ga)/.test(o.txt));
  const blanketSets = (setGroup?.options ?? []).filter((o) => o.id !== defSetId && /^(Vỏ chăn|Chăn)/.test(o.txt));
  const pillowSets = (setGroup?.options ?? []).filter((o) => o.id !== defSetId && isPillowSet(o.txt));
  const otherSets = (setGroup?.options ?? []).filter((o) => o.id !== defSetId
    && !/^(Bộ|Ga)/.test(o.txt) && !/^(Vỏ chăn|Chăn)/.test(o.txt) && !isPillowSet(o.txt));
  // 1) Bo mac dinh: thu cac size CHUAN truoc (160/180/200 — BED_SIZE_ORDER);
  // cac size le cua bo mac dinh (120/140/180x220/120x190/150x190) de
  // lai buoc 6b SAU vong vet vo goi. Ly do (hoi quy 26/11/2026): ban
  // truoc thu HET 7 size o buoc 1 (sua A: bo slice(0, 2) vi bo sot
  // 140x200 cua KMS402/KMP407) nen CPM27202 can ngan sach o buoc 5
  // (26 luot) va mat 3 bien the vo goi le (50x70/80x100/35x50).
  // Tach doi giu duoc ca 2: size le van duoc thu (buoc 6b, ngan sach 32)
  // ma khong chiem luot cua bien the le.
  const isBedFamily = !isPillowSet(defSetTxt);
  // Chi tach size le ra buoc 6b khi ho thuc su co size giuong; SP chi co
  // size nho (khan...) thi thu het o buoc 1 (khong co gi de hoan lai).
  const hasBedSizes = bedSizeIds.length > 0;
  const step1Sizes = defFamilySizes.filter((id) => id !== defSizeId
    && (!isBedFamily || !hasBedSizes || BED_SIZE_ORDER.includes(labelOf(sizeGroup, id))));
  const deferredSizes = isBedFamily && hasBedSizes
    ? defFamilySizes.filter((id) => id !== defSizeId && !BED_SIZE_ORDER.includes(labelOf(sizeGroup, id)))
    : [];
  if (defSizeId) {
    for (const sz of step1Sizes) {
      await tryCombo(defSetId, sz);
      if (coverage.calls >= coverage.budget) break;
    }
  }
  // 2) Cac loai Bo/Ga khac: 1 lan goi o size mac dinh (THU HET, khong
  // slice(0, 7) — sua PR #18: 2 loai combo "+ Vo goi om" (id 110, 111)
  // nam cuoi danh sach Bo/Ga nen slice(0, 7) bo sot chung, dan toi mat
  // 72 bien the tren PR #17).
  const validSets = [];
  for (const st of boGaSets) {
    const dd = defSizeId ? await tryCombo(st.id, defSizeId) : null;
    if (dd) validSets.push(st.id);
    if (coverage.calls >= coverage.budget) break;
  }
  // 3) Them size giuong cho cac bo vua thay hop le (toi da 3 lan goi — ngan
  // sach uu tien cho buoc 5 tim bien the le; ban cu cung chi mo rong duoc
  // 1-2 bo trong ngan sach 8).
  let p3calls = 0;
  for (const setId of validSets) {
    if (p3calls >= 3) break;
    for (const sz of bedSizeIds.filter((id) => id !== defSizeId)) {
      if (p3calls >= 3 || coverage.calls >= coverage.budget) break;
      await tryCombo(setId, sz);
      p3calls += 1;
    }
  }
  // 4) Cac loai Vo chan / Chan khac: thu toi da 3 size cho moi loai
  // [size mac dinh, 160x200, 200x220], dung o size dau tien hop le
  // (v2.2, 26/11/2026). Ly do: co loai chan chi ban o size khac size
  // mac dinh — VD EPM23063 mac dinh 180x220 nhung Vo chan chi ban
  // 160/180/200, Chan bon mua chi ban 200x220; chi thu o size mac dinh
  // thi ca 2 loai deu khong bao gio vao validSets nen khong duoc mo
  // rong size (gap giong EPT24084). Thu them chi ton luot khi size mac
  // dinh khong hop le (dung ngay khi tim thay), nen SP binh thuong
  // khong mat them luot nao. Budget 32 -> 40 de bu cho buoc 4b.
  const blanketTrySizes = [defSizeId, ...bedSizeIds.filter((id) =>
    ['160x200', '200x220'].includes(labelOf(sizeGroup, id)) && id !== defSizeId)];
  const tryBlanketSet = async (setId) => {
    for (const sz of blanketTrySizes) {
      if (coverage.calls >= coverage.budget) break;
      const dd = sz ? await tryCombo(setId, sz) : null;
      if (dd) { validSets.push(setId); return true; }
    }
    return false;
  };
  for (const st of blanketSets.slice(0, 2)) {
    const found = await tryBlanketSet(st.id);
    if (found) coverage.notes.push(`chan ${labelOf(setGroup, st.id)}: tim thay o size thu`);
    if (coverage.calls >= coverage.budget) break;
  }
  // 5) Cac loai Vo goi: thu tung loai voi size nho theo thu tu uu tien
  // (45x65, 50x70, 80x100...), dung sau bien the dau tien hop le cua loai
  // do (cac size con lai de buoc 6). Day la buoc bat bien the le nhu
  // "Vo goi om 80x100" — to hop (loai vo goi x size mac dinh giuong) luon
  // tra ve bien the mac dinh nen phai thu voi size nho.
  for (const st of pillowSets) {
    let found = false;
    for (const sz of smallSizeIds.slice(0, 4)) {
      if (coverage.calls >= coverage.budget) break;
      const dd = await tryCombo(st.id, sz);
      if (dd) { found = true; validSets.push(st.id); break; }
    }
    if (found) coverage.notes.push(`vo goi ${labelOf(setGroup, st.id)}: tim thay o size nho`);
    if (coverage.calls >= coverage.budget) break;
  }
  // 4b) Mo rong size cho cac loai Vo chan / Chan da hop le (v2.2):
  // buoc 4 chi thu toi da 3 size, cac size giuong con lai (chuan + le)
  // thu o day, toi da 6 luot, duyet theo SIZE truoc (giong buoc 6a) de
  // ca 2 loai deu duoc thu o co pho bien nhat. VD EPT24084: Chan he
  // hop le o size mac dinh 200x220 nhung bien the 180x220
  // (ECH1822EPT24084, 2.499.000d) chi tim thay o day; EPM23063: Vo
  // chan tim thay o 160x200 (buoc 4) thi 180/200x220 tim thay o day.
  // Dat SAU buoc 5 de khong chiem luot cua vong tim bien the vo goi le.
  const validBlanketSets = validSets.filter((id) => {
    const t = labelOf(setGroup, id);
    return t && /^(Vỏ chăn|Chăn)/.test(t);
  });
  let p4bcalls = 0;
  const restBedSizes = bedSizeIds.filter((id) => id !== defSizeId);
  restBedSizes.sort((a, b) => {
    const ao = BED_SIZE_ORDER.includes(labelOf(sizeGroup, a)) ? 0 : 1;
    const bo = BED_SIZE_ORDER.includes(labelOf(sizeGroup, b)) ? 0 : 1;
    return ao - bo;
  });
  for (const sz of restBedSizes) {
    for (const setId of validBlanketSets) {
      if (p4bcalls >= 6 || coverage.calls >= coverage.budget) break;
      await tryCombo(setId, sz);
      p4bcalls += 1;
    }
    if (p4bcalls >= 6 || coverage.calls >= coverage.budget) break;
  }
  // 6) Vet: cac loai con lai chua thu (loai la), cac size nho con lai cua
  // cac loai vo goi da hop le, va cac loai giuong chua thu — cho den khi
  // het ngan sach.
  // 6a) Vet them size giuong cho cac loai combo "+ Vo goi om" da hop le
  // (them PR #18): combo chi duoc thu o size mac dinh o buoc 2; neu san
  // pham mac dinh 180x200 (VD EPT24084) thi combo 160x200 van ban nhung
  // khong bao gio duoc goi — endpoint tra dung SKU/gia rieng cho to hop
  // nay (kiem chung 25/11/2026). Thu size giuong con lai cho combo truoc
  // khi vet vo goi, vi combo la bien the gia tri cao hon. Chi thu 3 co
  // chuan 160x200/180x200/200x220 (khong thu co le nhu 180x220, 120x190).
  // Duyet theo SIZE truoc (160x200 truoc, roi 200x220): voi ngan sach chi
  // con 2-3 luot, ca 2 loai combo deu duoc thu o co pho bien nhat thay vi
  // 1 loai chiem het luot o moi co. Chi them bien the, khong bao gio lam
  // mat bien the da co (tryCombo co tried-set).
  const comboSets = validSets.filter((id) => {
    const t = labelOf(setGroup, id);
    return t && t.includes('+');
  });
  const stdSizes = bedSizeIds.filter((id) => id !== defSizeId && BED_SIZE_ORDER.includes(labelOf(sizeGroup, id)));
  for (const sz of stdSizes) {
    for (const setId of comboSets) {
      if (coverage.calls >= coverage.budget) break;
      await tryCombo(setId, sz);
    }
    if (coverage.calls >= coverage.budget) break;
  }
  for (const st of otherSets) {
    if (coverage.calls >= coverage.budget) break;
    const dd = defSizeId ? await tryCombo(st.id, defSizeId) : null;
    if (!dd && smallSizeIds.length) await tryCombo(st.id, smallSizeIds[0]);
  }
  for (const setId of validSets) {
    if (!isPillowSet(labelOf(setGroup, setId))) continue;
    for (const sz of smallSizeIds) {
      if (coverage.calls >= coverage.budget) break;
      await tryCombo(setId, sz);
    }
    if (coverage.calls >= coverage.budget) break;
  }
  // 6b) Cac size le con lai cua bo mac dinh (120/140/180x220/120x190/
  // 150x190 — xem buoc 1): thu SAU vong vet vo goi de khong chiem ngan
  // sach cua bien the le.
  for (const sz of deferredSizes) {
    if (coverage.calls >= coverage.budget) break;
    await tryCombo(defSetId, sz);
  }
  for (const st of boGaSets.slice(7)) {
    if (coverage.calls >= coverage.budget) break;
    if (defSizeId) await tryCombo(st.id, defSizeId);
  }
  // Loai chan thu 3 tro di: cung thu 3 size nhu buoc 4 (v2.2), khong
  // chi thu o size mac dinh — VD EPM23063 co 3 loai chan, loai thu 3
  // (Chan he) chi ban o 180x220 nhung neu mac dinh khac thi van can
  // thu 160/200 de tim.
  for (const st of blanketSets.slice(2)) {
    if (coverage.calls >= coverage.budget) break;
    await tryBlanketSet(st.id);
  }
  coverage.status = variants.length >= 4 ? 'full' : variants.length > 1 ? 'partial' : 'default_only';
  return { variants, coverage, defSel, colorId, defSetId, defSizeId };
}
// ---------- Bien the cho DEM (mode 'mattress', them 24/11/2026) ----------
// Dem co 3 truc thuoc tinh khac han bo chan ga: Loai/Mau dem (vd "Vo det
// kim", "Ghi", "Gap 2 tam") x Chieu cao (vd "15 cm") x Kich thuoc
// (vd "160x200"). Mo hinh bien the cua site chi co 2 truc (set_type x
// size) nen gop Loai + Chieu cao vao set_type:
//   - co nhom Loai/Mau: set_type = "<Loai> · <Chieu cao>" (vd "Vo det kim · 15 cm")
//   - khong co nhom Loai/Mau: set_type = "Cao <Chieu cao>" (vd "Cao 15 cm")
//   - size = Kich thuoc. Thu tu uu tien giong ban bo chan ga (P0-P6),
//     ngan sach 20 lan goi. Diem khac: goi variation tra ve
//     selected_attributes RONG voi goi ro to hop, nen chi kiem tra hop le
//     bang "khac biet" (SKU khac hoac gia khac bien the mac dinh) — to hop
//     nao gia bang gia mac dinh VA khong co SKU rieng se khong ghi duoc
//     (gioi han da biet, giong ban cu).
const slugToCode = (slug) => String(slug || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Anh thu vien tu variation response: slideImage (HTML) chua cac anh
// -600x0.jpg cua chinh san pham. Dung khi anh tren trang khong loc duoc
// theo slug (nhieu dem de anh o thu muc khac ten slug, vd
// /upload/dem/lo-xo/pocket-pops/moi/ thay vi .../dem-lo-xo-pocket-pops-new/).
const extractSlideImages = (slideHtml) => {
  if (!slideHtml) return [];
  const urls = [...new Set([...String(slideHtml).matchAll(/\/upload\/[^"'\\ ]+?-600x0\.jpg/g)].map((m) => m[0]))];
  return urls.map((u) => `${BASE}${u}`);
};
// Bao hanh tu short_information cua variation mac dinh (vd "Bảo hành: 5 năm").
const extractWarranty = (shortInfo) => {
  if (!shortInfo) return null;
  const t = String(shortInfo).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const m = t.match(/Bảo hành:\s*([^.;]+)/);
  return m ? m[1].trim() : null;
};

async function buildVariantsMattress(base, defVar, productSku) {
  const d = defVar?.data ?? null;
  const defPrice = vPrice(d);
  const defSku = d?.sku || productSku;
  const groups = base.groups;
  const sizeGroup = groups.find((g) => /Kích thước/.test(g.title)) ?? null;
  const heightGroup = groups.find((g) => /Chiều cao/.test(g.title)) ?? null;
  const typeGroup = groups.find((g) => g !== sizeGroup && g !== heightGroup) ?? null;
  const labelOf = (group, id) => group?.options.find((o) => o.id === String(id))?.txt ?? null;
  const optById = (id) => {
    for (const g of groups) {
      const o = g.options.find((x) => x.id === String(id));
      if (o) return { group: g, txt: o.txt };
    }
    return null;
  };
  const defSel = (d?.selected_attributes ?? []).map((a) => String(a.id));
  const defSizeId = defSel.find((id) => sizeGroup?.options.some((o) => o.id === id))
    ?? sizeGroup?.options.find((o) => o.checked)?.id ?? null;
  const defHeightId = defSel.find((id) => heightGroup?.options.some((o) => o.id === id))
    ?? heightGroup?.options.find((o) => o.checked)?.id ?? null;
  const defTypeId = defSel.find((id) => typeGroup?.options.some((o) => o.id === id))
    ?? typeGroup?.options.find((o) => o.checked)?.id ?? null;
  const setTxtOf = (typeId, heightId) => {
    const t = labelOf(typeGroup, typeId);
    const h = labelOf(heightGroup, heightId);
    if (t && h) return `${t} · ${h}`;
    if (h) return `Cao ${h}`;
    if (t) return t;
    return null;
  };
  const variants = [];
  const seen = new Set();
  const pushVariant = (setTxt, sizeTxt, vd) => {
    if (!setTxt || !sizeTxt) return false;
    const key = `${setTxt}|${sizeTxt}`;
    if (seen.has(key)) return false;
    const price = vPrice(vd);
    const compareAt = vCompare(vd);
    if (!price) return false;
    seen.add(key);
    variants.push({
      // Neu server khong tra SKU bien the rieng (vd.sku rong) thi dung SKU
      // san pham (productSku — ma suy tu slug doi voi Dem), KHONG dung
      // base.sku (co the null -> String(null) = "null").
      sku: vd?.sku && String(vd.sku).trim() ? String(vd.sku).trim() : String(productSku),
      size: sizeTxt, set_type: setTxt,
      price: { amount: price, currency: 'VND' },
      compare_at_price: { amount: compareAt ?? price, currency: 'VND' },
      discount_percent: vDiscount(vd, price, compareAt),
      status: 'active',
      stock: vStock(vd),
    });
    return true;
  };
  const defSetTxt = setTxtOf(defTypeId, defHeightId);
  const defSizeTxt = labelOf(sizeGroup, defSizeId);
  if (d && defPrice) {
    pushVariant(defSetTxt, defSizeTxt, d);
    if (variants[0]) variants[0].stock = null; // stock goi mac dinh la TONG, khong dung
  }
  // Ngan sach goi variation: 28 (cao hon ban bo chan ga 20 vi Dem co 3
  // truc thuoc tinh -> nhieu to hop hon: 2 loai x 3 chieu cao x 7 size =
  // 42 to hop toi da. Chi 13 san pham Dem nen them ~3 phut cho full scan,
  // khong anh huong timeout 240 phut cua workflow).
  const coverage = { calls: 0, valid_extra: 0, budget: 28, status: 'default_only', notes: [] };
  if (!base.variationId || !sizeGroup || !heightGroup) {
    coverage.notes.push('thieu variation id / nhom kich thuoc / nhom chieu cao — chi co gia mac dinh');
    return { variants, coverage, defSel, defTypeId, defHeightId, defSizeId, defSetTxt, defSizeTxt };
  }
  if (sizeGroup.options.length === 0 || heightGroup.options.length === 0) {
    coverage.notes.push('nhom kich thuoc/chieu cao khong co lua chon — chi co gia mac dinh');
    coverage.status = variants.length > 1 ? 'partial' : 'default_only';
    return { variants, coverage, defSel, defTypeId, defHeightId, defSizeId, defSetTxt, defSizeTxt };
  }
  const tried = new Set();
  const tryCombo = async (attrIds, setTxt, sizeTxt) => {
    const tkey = attrIds.join('|');
    if (tried.has(tkey)) return null;
    tried.add(tkey);
    if (coverage.calls >= coverage.budget) return null;
    await sleep(DELAY_MS);
    coverage.calls += 1;
    try {
      const res = await callVariation(base.variationId, base.csrf, attrIds);
      if (res?.error) return null;
      const dd = res.data ?? null;
      if (!dd || !vPrice(dd)) return null;
      // Goi ro to hop tra ve selected_attributes rong — chi biet hop le
      // khi SKU khac SKU mac dinh hoac gia khac gia mac dinh.
      const differs = (dd.sku && dd.sku !== defSku) || vPrice(dd) !== defPrice;
      if (differs) {
        if (pushVariant(setTxt, sizeTxt, dd)) coverage.valid_extra += 1;
        return dd;
      }
      return null; // server tra ve bien the mac dinh -> to hop khong hop le
    } catch (e) {
      coverage.notes.push(`variation ${attrIds.join('/')} loi: ${e.message}`);
      return null;
    }
  };
  const comboIds = (typeId, heightId, sizeId) => [typeId, heightId, sizeId].filter((x) => x != null);
  // 0) Ton THAT cua bien the mac dinh: goi ro to hop mac dinh, chi lay
  // stock khi SKU tra ve la SKU con khac SKU goc (tranh ghi nham tong).
  if (d && defPrice && defSizeId && defHeightId && variants[0]) {
    const dd = await tryCombo(comboIds(defTypeId, defHeightId, defSizeId), defSetTxt, defSizeTxt);
    if (dd && dd.sku && String(dd.sku).trim() !== String(defSku)
      && Number.isFinite(Number(dd.stock))) {
      variants[0].stock = Math.trunc(Number(dd.stock));
    }
  }
  const sizeIds = sizeGroup.options
    .sort((a, b) => bedSizeRank(a.txt) - bedSizeRank(b.txt)).map((o) => o.id);
  const heightIds = heightGroup.options.map((o) => o.id);
  const typeIds = typeGroup ? typeGroup.options.map((o) => o.id) : [];
  // Tat ca to hop (loai, chieu cao): khi khong co nhom Loai thi loai = null
  // (chi co chieu cao). Dung cho P6a/P6c — khong duoc duyet theo typeIds
  // vi typeIds RONG khi khong co nhom Loai, lam P6a/P6c khong chay (loi
  // da gap o lux-everon: Cao 18cm khong bao gio duoc quet o size khac).
  const allSetKeys = [];
  if (typeIds.length) { for (const t of typeIds) for (const h of heightIds) allSetKeys.push([t, h]); }
  else { for (const h of heightIds) allSetKeys.push([null, h]); }
  const validSets = [];
  // 1) Bo mac dinh: cac size con lai (toi da 2).
  if (defSizeId) {
    for (const sz of sizeIds.filter((id) => id !== defSizeId).slice(0, 2)) {
      await tryCombo(comboIds(defTypeId, defHeightId, sz), defSetTxt, labelOf(sizeGroup, sz));
      if (coverage.calls >= coverage.budget) break;
    }
  }
  // 2) Cac loai/chieu cao khac: 1 lan goi o size mac dinh (toi da 6).
  const otherSets = [];
  for (const t of typeIds.filter((id) => id !== defTypeId).slice(0, 3)) {
    otherSets.push([t, defHeightId]);
  }
  for (const h of heightIds.filter((id) => id !== defHeightId).slice(0, 3)) {
    otherSets.push([defTypeId, h]);
  }
  for (const [t, h] of otherSets.slice(0, 6)) {
    const st = setTxtOf(t, h);
    const dd = defSizeId ? await tryCombo(comboIds(t, h, defSizeId), st, defSizeTxt) : null;
    if (dd) validSets.push(st);
    if (coverage.calls >= coverage.budget) break;
  }
  // 3) Them size cho cac bo vua thay hop le (toi da 3 lan goi).
  let p3calls = 0;
  for (const st of validSets) {
    if (p3calls >= 3) break;
    // Tim lai type/height cua set hop le qua nhan (setTxt -> ids).
    const entry = [...otherSets].find(([t, h]) => setTxtOf(t, h) === st);
    if (!entry) continue;
    for (const sz of sizeIds.filter((id) => id !== defSizeId)) {
      if (p3calls >= 3 || coverage.calls >= coverage.budget) break;
      await tryCombo(comboIds(entry[0], entry[1], sz), st, labelOf(sizeGroup, sz));
      p3calls += 1;
    }
  }
  // 6) Vet: (a) cac to hop loai x chieu cao con lai o size mac dinh;
  // (b) cac size con lai cua cac bo hop le VA bo mac dinh — bo mac dinh
  // cung phai duoc vet het size (neu khong, P1 chi lay 2 size dau thi cac
  // size nho 120x190/150x190 cua bo mac dinh se mat); (c) cac size con
  // lai cua cac bo CHUA hop le o size mac dinh — vi co bo chi hop le o
  // size khac mac dinh (kiem chung live 24/11/2026: Vỏ gấm · 15 cm cua
  // dem-bong-ep-artemis chi co o 180x200 (8.660.000d, SKU ADM218215S07),
  // khong co o 160x200; Trắng · 15 cm cua dem-cao-su-everon chi co o
  // 180x200/120x200/140x200, khong co o 160x200 — neu khong quet buoc
  // nay thi mat 2 + 3 bien the that). Cho den khi het ngan sach.
  for (const [t, h] of allSetKeys) {
    if (coverage.calls >= coverage.budget) break;
    if (t === defTypeId && h === defHeightId) continue;
    const st = setTxtOf(t, h);
    if (validSets.includes(st)) continue;
    if (defSizeId) await tryCombo(comboIds(t, h, defSizeId), st, defSizeTxt);
  }
  const sweepSets = [];
  const seenSets = new Set();
  for (const st of [defSetTxt, ...validSets]) {
    if (st && !seenSets.has(st)) { seenSets.add(st); sweepSets.push(st); }
  }
  for (const st of sweepSets) {
    const entry = [...otherSets, [defTypeId, defHeightId]].find(([t, h]) => setTxtOf(t, h) === st);
    if (!entry) continue;
    for (const sz of sizeIds) {
      if (coverage.calls >= coverage.budget) break;
      await tryCombo(comboIds(entry[0], entry[1], sz), st, labelOf(sizeGroup, sz));
    }
    if (coverage.calls >= coverage.budget) break;
  }
  // (c) Bo chua hop le: quet het size (tru size mac dinh da thu o (a)).
  for (const [t, h] of allSetKeys) {
    if (coverage.calls >= coverage.budget) break;
    const st = setTxtOf(t, h);
    if (seenSets.has(st)) continue;
    for (const sz of sizeIds) {
      if (coverage.calls >= coverage.budget) break;
      if (sz === defSizeId) continue; // da thu o (a)
      await tryCombo(comboIds(t, h, sz), st, labelOf(sizeGroup, sz));
    }
  }
  // Trang thai bao phu: 'full' khi moi to hop co the da duoc thu (vd foam
  // chi co 1 bo x 3 size = 3 to hop, thu ca 3 thi la full du chi co 3 bien
  // the); 'partial' khi ngan sach het truoc khi thu het (vd bong-ep-everon
  // 42 to hop, ngan sach 28 — co the con bien the chua biet).
  const possibleCombos = (typeIds.length || 1) * heightIds.length * sizeIds.length;
  coverage.possible_combos = possibleCombos;
  coverage.tried_combos = tried.size;
  coverage.status = tried.size >= possibleCombos ? 'full' : variants.length > 1 ? 'partial' : 'default_only';
  return { variants, coverage, defSel, defTypeId, defHeightId, defSizeId, defSetTxt, defSizeTxt };
}
// ---------- Main ----------
async function main() {
  mkdirSync(`${ROOT}/data`, { recursive: true });
  if (DISCOVER_ALL) { await discoverAll(); return; }
  if (args.includes('--discover-only')) { await discover(); console.log('[discovery-only] Da ghi file discovery, thoat.'); return; }
  let discovery;
  let queueEntriesByUrl = null; // che do hang doi: map URL -> muc hang doi (danh muc, sub_type)
  if (QUEUE_MODE) {
    // Che do hang doi: cao dung cac URL trong file, bo qua discovery/lastmod.
    // sub_type cua tung URL lay tu file hang doi (de matressType/sub_type
    // dung nhu khi cao theo danh muc).
    const rawUrls = readFileSync(resolve(ROOT, URLS_FILE), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
    queueEntriesByUrl = new Map(loadQueue().map((e) => [e.url, e]));
    const subTypeByUrl = {};
    for (const u of rawUrls) { const st = queueEntriesByUrl.get(u)?.sub_type; if (st) subTypeByUrl[u] = st; }
    const catCount = [...queueEntriesByUrl.values()].filter((e) => (e.categories ?? []).includes(CAT.id)).length || rawUrls.length;
    discovery = { urls: rawUrls, lastmod_by_url: {}, sub_type_by_url: subTypeByUrl, category_count_on_source: catCount };
    console.log(`[hang-doi] ${rawUrls.length} URL tu ${URLS_FILE} (danh muc ${CAT.id})`);
  } else if (SKIP_DISCOVERY && existsSync(`${ROOT}/${DISCOVERY_FILE}`)) {
    discovery = JSON.parse(readFileSync(`${ROOT}/${DISCOVERY_FILE}`, 'utf8'));
    console.log(`[discovery] Dung lai ${DISCOVERY_FILE}: ${discovery.urls.length} URL danh muc`);
  } else {
    discovery = await discover();
  }
  let urls = discovery.urls;
  if (Number.isFinite(LIMIT)) urls = urls.slice(0, LIMIT);
  console.log(`[full] Se chay ${urls.length} san pham`);

  // --- Tang dan THAT SU theo sitemap lastmod (sua 23/11/2026) ---
  // Truoc day workflow ghi "quet tang dan theo lastmod" nhung code khong
  // he so sanh lastmod: che do --resume chi nap lai state.json roi bo qua
  // MOI URL da co trong do, nen lan chay ngay thu chi viet lai du lieu cu
  // (gia moi khong bao gio duoc cap nhat). Bay gio:
  //  - lastmod moi lay tu discovery vua chay (da sua regex, co gia tri that);
  //  - lastmod cu lay tu data/sync-state.json (export-site-data.mjs duy tri);
  //  - URL duoc cao lai khi: moi (chua co trong products.json), hoac
  //    khong co tin hieu lastmod o mot trong hai ben (cao lai cho chac),
  //    hoac lastmod doi. URL khong doi duoc GIU LAI tu products.json.
  //  - San pham khong con trong discovery (bi go khoi danh muc) se roi
  //    khoi ket qua (hien o diff dang removed) vi khong duoc seed lai.
  //  - Chu nhat / --full: bo qua lastmod, cao lai tat ca.
  // Luu y chuyen tiep: lastmod dang luu tren main hien deu null (do regex
  // cu), nen lan chay dau tien sau PR nay se cao lai toan bo 189 san pham
  // (nhu mot lan full scan); tu lan sau tro di moi tang dan that su.
  let prevProducts = [];
  try {
    const rawPrev = JSON.parse(readFileSync(`${ROOT}/data/products.json`, 'utf8'));
    prevProducts = Array.isArray(rawPrev) ? rawPrev : rawPrev.products ?? [];
  } catch { /* chua co ban truoc: cao toan bo */ }
  let prevLastmod = {};
  try {
    prevLastmod = JSON.parse(readFileSync(`${ROOT}/data/sync-state.json`, 'utf8')).url_lastmod ?? {};
  } catch { /* chua co sync-state: coi nhu chua co lastmod */ }
  const freshLastmod = discovery.lastmod_by_url ?? {};
  const prevByUrl = new Map(prevProducts.map((p) => [p.source?.url, p]).filter(([u]) => u));
  const isChanged = (url) => {
    if (!prevByUrl.has(url)) return true; // URL moi
    const oldLm = prevLastmod[url];
    const newLm = freshLastmod[url];
    if (oldLm == null || newLm == null) return true; // khong co tin hieu -> cao lai
    return oldLm !== newLm;
  };
  const changedUrls = FULL ? urls : urls.filter(isChanged);
  console.log(`[tang-dan] ${changedUrls.length}/${urls.length} URL moi/doi theo lastmod${FULL ? ' (full scan: cao tat ca)' : ''}`);
  let reusedUnchanged = 0;

  // Doc ban thu 7 san pham de doi chieu gia.
  let trialBySku = {};
  try {
    const trial = JSON.parse(readFileSync(`${ROOT}/../everon-scraper-trial/data/products-bo-chan-ga.json`, 'utf8'));
    trialBySku = Object.fromEntries((trial.products ?? []).map((p) => [p.sku, p]));
  } catch { /* bo qua neu khong co file thu */ }

  let done = new Map();
  // Giu lai san pham KHONG DOI tu ban truoc (khong cao lai). Chi seed
  // nhung URL van con trong discovery lan nay va khong nam trong danh
  // sach doi: URL doi slug (khong con trong urls) se khong duoc seed,
  // tranh truong hop trung SKU giu lai ban cu; san pham bi go khoi danh
  // muc cung khong duoc seed nen roi khoi ket qua.
  if (!FULL) {
    for (const p of prevProducts) {
      const u = p.source?.url;
      if (u && urls.includes(u) && !changedUrls.includes(u)) done.set(p.sku, p);
    }
    reusedUnchanged = done.size;
    console.log(`[tang-dan] Giu lai ${reusedUnchanged} san pham khong doi tu data/products.json`);
  }
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
      // SKU san pham:
      // - Bo chan ga: lay tu trang (coreSku), KHONG lay data.sku cua variation
      //   (do la SKU cua bien the). Chi dung variation lam du phong khi trang
      //   khong co.
      // - Dem: nguon KHONG co ma san pham chuan (ma .sku tren trang la ma
      //   bien the, ma hoa ca kich thuoc/chieu cao — vd EDM316209LUX; co
      //   san pham khong co .sku). Dung ma suy tu slug (on dinh theo URL,
      //   duy nhat toan catalog): vd dem-bong-ep-everon -> DEMBONGEPEVERON.
      //   Bien the van giu SKU that tu endpoint (vd.sku).
      // SKU PIN (data/sku-pins.json) thang truoc ca .sku: mot so .sku
      // khong on dinh giua cac lan cao (khan...), pin giu ma co dinh.
      const pinnedSku = CAT.mode === 'mattress' ? null : (SKU_PINS[base.slug || slugGuess] ?? null);
      const sku = CAT.mode === 'mattress'
        ? slugToCode(base.slug || slugGuess)
        : pinnedSku ?? base.sku ?? coreSku(d?.sku) ?? coreSku(base.skuOnPage)
          ?? (d?.sku && /^[A-Z0-9]{3,}$/.test(String(d.sku).trim()) ? String(d.sku).trim().toUpperCase() : null);
      const name = (d?.name && d.name !== sku ? d.name : null) ?? (base.nameFromTitle || sku);
      if (!sku) { skipped.push({ url, reason: 'khong xac dinh duoc SKU' }); console.log(`[skip] ${url}: khong xac dinh duoc SKU`); continue; }
      if (done.has(sku)) { console.log(`[trung-sku] ${sku}`); markQueueCrawled(url); continue; }
      const buildRes = CAT.mode === 'mattress'
        ? await buildVariantsMattress(base, defVar, sku)
        : await buildVariants(base, defVar, sku);
      const { variants, coverage } = buildRes;
      // Loai dem (tu danh muc con nguon: lo-xo / bong-ep / cao-su / foam).
      const mattressType = CAT.mode === 'mattress'
        ? (discovery.sub_type_by_url?.[url] ?? null) : null;
      const warranty = CAT.mode === 'mattress' ? extractWarranty(d?.short_information) : null;
      // Bien the mac dinh neu variation khong tra ve: dung gia trang.
      if (variants.length === 0 && price) {
        // Nhan loai bo mac dinh: suy tu TEN san pham, khong doan "Bo ga
        // chun chan" (sai voi rem/khan/topper — xem singleSetLabel).
        const fbSet = CAT.mode === 'mattress'
          ? (buildRes.defSetTxt ?? 'Đệm')
          : (KNOWN_SET_TYPES.find((st) => base.nameFromTitle?.includes(st)) ?? 'Sản phẩm');
        const fbSize = CAT.mode === 'mattress'
          ? (buildRes.defSizeTxt ?? '160x200')
          : '160x200';
        variants.push({
          sku: `${sku}-160`, size: fbSize, set_type: fbSet,
          price: { amount: price, currency: 'VND' },
          compare_at_price: { amount: compareAt ?? price, currency: 'VND' },
          discount_percent: discount ?? 0, status: 'active', stock: null,
        });
        coverage.status = 'default_only';
        coverage.notes.push('variation khong tra ve bien the — dung gia mac dinh tu trang');
      }
      // set_types cho dem: nhan Loai/Mau dem (vd "Vo det kim", "Gap 2 tam");
      // neu khong co nhom Loai/Mau thi dung ten loai dem (vd "Dem bong ep").
      let setTypes = base.setTypes;
      if (CAT.mode === 'mattress') {
        const typeLabels = [...new Set(variants.map((v) => String(v.set_type).split(' · ')[0]))];
        setTypes = typeLabels.length ? typeLabels : (mattressType ? [`Đệm ${{ 'lo-xo': 'lò xo', 'bong-ep': 'bông ép', 'cao-su': 'cao su', 'foam': 'foam' }[mattressType] ?? mattressType}`] : []);
      }
      /* Lấy TOÀN BỘ ảnh trong thư viện của trang nguồn (trước đây giới hạn
         3 ảnh nên nhiều sản phẩm chỉ có 1–3 ảnh trong khi nguồn có tới
         14 ảnh). Ảnh mô tả trong nội dung (mo-ta-*) không khớp mẫu
         -600x0.jpg nên không lọt vào đây. Riêng Đệm: nhiều sản phẩm để
         ảnh ở thư mục khác tên slug nên lọc theo slug không bắt được —
         lấy thêm từ slideImage của variation mặc định (chứa đủ ảnh
         -600x0.jpg của sản phẩm). */
      let pageImages = base.images;
      if (CAT.mode === 'mattress' && pageImages.length === 0) {
        pageImages = extractSlideImages(d?.slideImage);
        if (pageImages.length) coverage.notes.push(`anh lay tu slideImage: ${pageImages.length} anh`);
      }
      // id/thu muc anh = sku viet thuong, sanitize ve [a-z0-9-] cho khop
      // SRC_RE cua validate (SKU pin co "_" nhu EKDNANGSTK4040_S2 se
      // lam hong src neu giu nguyen — SKU goc giu nguyen, chi doi id).
      const pid = String(sku).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const media = pageImages.map((src, i) => ({
        type: 'image', role: i === 0 ? 'cover' : 'gallery',
        src: `assets/img/products/${pid}/${i === 0 ? 'cover' : `img-${i + 1}`}.webp`,
        source_url: src, alt: `${CAT.alt_prefix} ${name} - ${sku}`, width: 600, height: null,
      }));
      if (media.length === 0 && d?.image) {
        media.push({ type: 'image', role: 'cover', src: `assets/img/products/${pid}/cover.webp`, source_url: `${BASE}${d.image}`, alt: `${CAT.alt_prefix} ${name} - ${sku}`, width: 540, height: 600 });
      }
      // Trang thai het hang: uu tien ton kho that cua bien the (neu biet)
      // thay vi chi dung co "Het hang" tren trang + stock TONG cua goi
      // mac dinh (tong co the sai — xem muc 2.2 README goi PR muc 8).
      const anyInStock = variants.some((v) => (v.stock ?? 0) > 0);
      const allKnownZero = variants.length > 0 && variants.every((v) => v.stock === 0);
      const outOfStock = anyInStock ? false : (allKnownZero || base.outOfStock);
      const product = {
        id: pid, sku, slug: base.slug || slugify(name, sku), name,
        // Che do hang doi: san pham giu DU danh muc no xuat hien tren nguon
        // (lay tu file hang doi) nhu truoc day khi cao o nhieu danh muc;
        // che do danh muc thi chi co 1 danh muc nhu cu.
        category_ids: QUEUE_MODE ? (queueEntriesByUrl?.get(url)?.categories ?? [CAT.id]) : [CAT.id],
        collection_ids: base.collections,
        description: (d?.short_description || null) ?? base.desc,
        attributes: {
          material: base.material, colors: base.colors,
          pattern: base.pattern, pattern_type: base.patternType, origin: base.origin,
          set_types: setTypes,
          ...(mattressType ? { mattress_type: mattressType } : {}),
          ...((!mattressType && discovery.sub_type_by_url?.[url]) ? { sub_type: discovery.sub_type_by_url[url] } : {}),
          ...(warranty ? { warranty } : {}),
        },
        variants, media,
        price: price ? { amount: price, currency: 'VND' } : null,
        compare_at_price: (compareAt ?? price) ? { amount: compareAt ?? price, currency: 'VND' } : null,
        discount_percent: discount ?? 0,
        local_override: null,
        source: { site: 'everon.com', url, updated_at: new Date().toISOString().slice(0, 10) },
        synced_at: new Date().toISOString(),
        status: outOfStock ? 'out_of_stock' : 'active',
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
      coverageStats.push({ sku, name, variants: variants.length, price_table_status: coverage.status, variation_calls: coverage.calls, tried_combos: coverage.tried_combos ?? null, possible_combos: coverage.possible_combos ?? null, notes: coverage.notes });
      done.set(sku, product);
      jsonlLines.push(JSON.stringify(product));
      saveCheckpoint([...done.values()]);
      markQueueCrawled(url);
      consecutiveErrors = 0;
      console.log(`[ok] ${sku} — ${name} — ${(price ?? 0).toLocaleString('vi-VN')}đ — ${variants.length} bien the (${coverage.status}) — ${done.size}/${urls.length}`);
    } catch (e) {
      consecutiveErrors += 1;
      skipped.push({ url, reason: String(e.message) });
      console.log(`[loi] ${url}: ${e.message} (loi lien tiep: ${consecutiveErrors})`);
      // URL tra 404 = san pham da bien mat khoi nguon: danh dau 'gone' de
      // last chunk xoa khoi file hang doi (khong de ket vong lap mai).
      if (QUEUE_MODE && /HTTP 404/.test(String(e.message))) { markQueueGone(url); console.log(`[gone] ${url}: danh dau da bien mat khoi nguon`); }
      if (consecutiveErrors >= 10) { console.log('[dung] Qua nhieu loi lien tiep — dung chay, giu lai phan da xong.'); break; }
    }
  }

  const products = [...done.values()];
  // Giu thu tu san pham theo thu tu URL discovery (giong lan chay full),
  // tranh viec tang dan xao tron thu tu trong products.json: san pham
  // giu lai dung truoc, san pham moi cao ve chen them vao cuoi lam lech
  // diff va thu tu hien thi mac dinh tren trang danh muc.
  const orderIdx = new Map(urls.map((u, i) => [u, i]));
  products.sort((a, b) => (orderIdx.get(a.source?.url) ?? 1e9) - (orderIdx.get(b.source?.url) ?? 1e9));
  const out = {
    schema_version: 1,
    // partial: true khi cao theo hang doi — wrapper chi chua batch vua cao,
    // export-site-data.mjs se GOP theo SKU thay vi thay the ca danh muc.
    partial: QUEUE_MODE,
    category: { id: CAT.id, name: CAT.name, product_count_on_source: discovery.category_count_on_source, source_url: CAT.source_url },
    source: { site: 'everon.com', category_url: CAT.source_url, category_urls: CAT.urls, sitemap_url: SITEMAP_URL, crawled_at: new Date().toISOString() },
    synced_at: new Date().toISOString(),
    count: products.length,
    products,
  };
  writeFileSync(`${ROOT}/${OUT}`, JSON.stringify(out, null, 2) + '\n', 'utf8');
  const stats = {
    crawled_at: new Date().toISOString(),
    discovery: { ...discovery, urls: undefined, lastmod_by_url: undefined },
    total_urls: urls.length,
    changed_urls: changedUrls.length,
    reused_unchanged: reusedUnchanged,
    full_scan: FULL,
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
  writeFileSync(`${ROOT}/${RUN_STATS_FILE}`, JSON.stringify(stats, null, 2) + '\n', 'utf8');
  console.log(`[xong] Thanh cong ${products.length}/${urls.length}, bo qua ${skipped.length}. Ghi -> ${OUT}`);
}

main().catch((e) => { console.error('[full] THAT BAI:', e.message); process.exit(1); });
