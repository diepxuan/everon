// Kiểm tra giao diện everon.site (chạy bằng node, không cần trình duyệt).
// Usage: node scripts/check.mjs
// 1. Kiểm tra tĩnh: không có chuỗi "everon.com" trong file HTML/CSS/JS,
//    không có link href nào trỏ ra ngoài (trừ Zalo + tel:).
// 2. Chạy thử app.js với DOM shim: render trang chủ / danh mục / chi tiết,
//    đếm sản phẩm, nhãn Hết hàng, thử bộ lọc và chọn biến thể.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? "PASS" : "FAIL") + " — " + name + (extra ? " — " + extra : ""));
  if (!ok) failures++;
}
function walk(dir, out) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* ---------- 1. Kiểm tra tĩnh ---------- */
const files = walk(root, []).filter(
  (f) => /\.(html|css|js)$/.test(f) && !f.includes("/scripts/")
);
for (const f of files) {
  const src = readFileSync(f, "utf8");
  check(
    "không chứa everon.com/dreamland.vn: " + f.replace(root + "/", ""),
    !/everon\.com|dreamland\.vn/i.test(src)
  );
}
/* Link href trong HTML: chỉ cho phép nội bộ, #..., zalo.me, tel:, mailto:,
   và link bản đồ Google tới showroom (nút "Xem bản đồ" trong thẻ địa điểm). */
for (const f of files.filter((x) => x.endsWith(".html"))) {
  const src = readFileSync(f, "utf8");
  const hrefs = [...src.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const bad = hrefs.filter(
    (h) => /^https?:\/\//i.test(h) && !h.startsWith("https://zalo.me/") && !h.startsWith("https://www.google.com/maps/")
  );
  check("link ngoài chỉ có Zalo + bản đồ Google: " + f.replace(root + "/", ""), bad.length === 0, bad.join(", "));
}
/* Menu header (gọn 2026-11-26): chỉ còn Sản phẩm ▾ | Bộ sưu tập ▾,
   logo link về trang chủ; ô tìm kiếm ở header (?q=). Link dùng đường
   dẫn tương đối theo từng trang (../ ở trang danh mục). */
for (const f of files.filter((x) => x.endsWith(".html"))) {
  const src = readFileSync(f, "utf8");
  const rel = f.replace(root + "/", "");
  const prefix = rel === "bo-chan-ga/index.html" ? "../" : "";
  check("menu: có nút hamburger + nav#main-nav: " + rel, src.includes('id="nav-toggle"') && src.includes('id="main-nav"'));
  check("menu: có mục Sản phẩm và Bộ sưu tập: " + rel, src.includes('id="nav-san-pham"') && src.includes('id="nav-bo-suu-tap"'));
  check("menu: link Sản phẩm tới bo-chan-ga/: " + rel, src.includes('href="' + prefix + 'bo-chan-ga/" class="nav-link" id="nav-san-pham"'));
  check("menu: 3 link Bộ sưu tập ?collection=: " + rel, ["everon-2027", "bst-chan-ga-2022", "bst-cutie-2027"].every((c) => src.includes('href="' + prefix + 'bo-chan-ga/?collection=' + c + '"')));
  check("drawer: có backdrop + đầu drawer (logo + nút ✕) + nút Gọi showroom cuối drawer: " + rel, src.includes('id="nav-backdrop"') && src.includes('id="nav-close"') && src.includes('class="drawer-call"'));
  /* Header gọn: nav không còn mục Trang chủ / Liên hệ / Showroom
     (nút "Gọi showroom" ở cuối drawer + ở header vẫn giữ, nên chỉ
     kiểm tra đúng các link mục menu, không kiểm tra chuỗi "Showroom"
     chung chung). Logo vẫn là link về trang chủ. */
  const navBlock = (src.match(/<nav class="main-nav"[\s\S]*?<\/nav>/) || [""])[0];
  check("header gọn: nav không còn Trang chủ/Liên hệ/Showroom: " + rel, !navBlock.includes(">Trang chủ<") && !navBlock.includes(">Liên hệ<") && !navBlock.includes('href="#showroom"') && !navBlock.includes(">Showroom<"));
  check("header gọn: logo vẫn link về trang chủ: " + rel, src.includes('class="brand" href="' + prefix + 'index.html"'));
  check("header gọn: header có ô tìm kiếm (?q=): " + rel, src.includes('class="header-search"') && src.includes('name="q"') && src.includes('action="' + (rel === "bo-chan-ga/index.html" ? "./" : "bo-chan-ga/") + '"'));
}
const cssSrc = readFileSync(join(root, "assets/css/style.css"), "utf8");
check("drawer: CSS có panel trượt từ phải (translateX + 100dvh + min(320px, 85vw))", cssSrc.includes("translateX(102%)") && cssSrc.includes("100dvh") && cssSrc.includes("min(320px, 85vw)"));
check("drawer: CSS có backdrop mờ rgba(0, 0, 0, .5)", cssSrc.includes("rgba(0, 0, 0, .5)"));
check("header gọn: mobile 2 hàng (logo + ☰ hàng 1, tìm kiếm full-width hàng 2, tagline ẩn)", cssSrc.includes(".header-search { order: 3; flex: 1 1 100%; max-width: none; min-width: 0; }") && cssSrc.includes(".brand > span:last-child { display: none; }"));
check("header gọn: ô tìm kiếm header (flex, tối đa 340px, input 16px trên mobile)", cssSrc.includes(".header-search { display: flex; gap: 6px; flex: 1 1 220px; max-width: 340px; }") && cssSrc.includes(".header-search input, .header-search button { font-size: 16px; }"));
check("header gọn: nút liên hệ nổi 1 nút tròn trắng 60px góc dưới-phải, z-index dưới panel drawer", cssSrc.includes(".contact-fab { position: fixed; right: 16px; bottom: 16px; z-index: 10;") && cssSrc.includes("width: 60px; height: 60px; border-radius: 50%;"));
check("menu mobile: active nhẹ vạch đỏ nâu Điệp Xuân, không pill xám", cssSrc.includes("box-shadow: inset 3px 0 0 var(--rust-light)"));
check("menu mobile: tag Sắp có không nền pill (background: transparent)", cssSrc.includes(".tag-soon { background: transparent;"));
check("menu mobile: dấu ▾ xoay khi mở (rotate 180deg)", cssSrc.includes("rotate(180deg)"));
/* Căn hàng dọc menu desktop (fix 2026-11-26): 2 mục dropdown từng cao
   hơn 3 mục thường 7.24px (đo Chromium: tâm dọc 24.95 so với 32.19)
   vì link trong .nav-item là inline nên padding dọc không nở line box. */
check("menu desktop: .nav-item thành flex căn giữa trong @media (min-width: 721px)", /@media \(min-width: 721px\) \{\s*\.nav-item \{ display: flex; align-items: center; \}/.test(cssSrc));
check("menu desktop: .nav-link inline-flex căn giữa mũi tên ▾ với chữ", cssSrc.includes(".nav-link { display: inline-flex; align-items: center; }"));
check("menu mobile: chỉ duy nhất 1 chỗ .nav-item display:flex (không lọt vào block ≤720px, dropdown vẫn static)", (cssSrc.match(/\.nav-item \{ display: flex/g) || []).length === 1);
const indexSrc = readFileSync(join(root, "index.html"), "utf8");
check("menu: trang chủ không còn mục Danh mục sản phẩm", !indexSrc.includes("cat-title") && !indexSrc.includes("category-grid"));
check("header gọn: hero trang chủ không còn nút Zalo rời [data-zalo-buttons]", !(/<section class="hero">[\s\S]*?<\/section>/.exec(indexSrc) || [""])[0].includes("data-zalo-buttons"));
check("xóa nút xem SP: hero trang chủ không còn nút \"Xem Bộ chăn ga\"", !(/<section class="hero">[\s\S]*?<\/section>/.exec(indexSrc) || [""])[0].includes("Xem Bộ chăn ga"));
const catSrc = readFileSync(join(root, "bo-chan-ga/index.html"), "utf8");
check("menu: trang danh mục không còn class active tĩnh Bộ chăn ga", !catSrc.includes('class="active">Bộ chăn ga'));
const css = readFileSync(join(root, "assets/css/style.css"), "utf8");
check("CSS có breakpoint mobile 480px", css.includes("@media (max-width: 480px)"));
check("CSS có breakpoint desktop 720px", css.includes("@media (min-width: 720px)"));
check("CSS có kiểu nút Trước/Sau cho thư viện ảnh", css.includes(".gal-nav") && css.includes(".gal-count"));
check("CSS có kiểu xem ảnh lớn (lightbox)", css.includes(".lightbox") && css.includes(".lb-img"));
check("CSS dải ảnh nhỏ trượt ngang", css.includes(".thumbs") && css.includes("overflow-x: auto"));
/* 2 địa điểm theo Google Business Profile (kiểm tra 23/11/2026). */
const siteJson = JSON.parse(readFileSync(join(root, "data/site.json"), "utf8"));
check("site.json: có 2 địa điểm", Array.isArray(siteJson.locations) && siteJson.locations.length === 2);
const loc241 = (siteJson.locations || []).find((l) => l.id === "tran-hung-dao");
const locMG = (siteJson.locations || []).find((l) => l.id === "mg15-vincom");
check(
  "site.json: 241 Trần Hưng Đạo, giờ 07:30–21:00 (đã sửa trên Google 23/11)",
  !!loc241 && loc241.address.includes("241 Trần Hưng Đạo") && loc241.hours === "07:30–21:00" && loc241.phone === "0363 089 565" && (loc241.maps_url || "").startsWith("https://www.google.com/maps/")
);
check(
  "site.json: MG15 Vincom, giờ 07:30–21:00 theo Google",
  !!locMG && locMG.address.includes("MG15") && locMG.hours === "07:30–21:00" && locMG.phone === "0363 089 565" && (locMG.maps_url || "").startsWith("https://www.google.com/maps/")
);
check(
  "site.json: 241 có đánh giá 4.7 (3 đánh giá), MG15 không ghi đánh giá",
  !!loc241 && loc241.rating === 4.7 && loc241.reviews === 3 && !!locMG && !("rating" in locMG)
);
for (const f of files.filter((x) => x.endsWith(".html"))) {
  const src = readFileSync(f, "utf8");
  const rel = f.replace(root + "/", "");
  check("HTML có cả 2 địa chỉ showroom: " + rel, src.includes("241 Trần Hưng Đạo") && src.includes("MG15 Shophouse Vincom"));
  check("HTML có giờ cả 2 showroom (07:30–21:00): " + rel, (src.match(/07:30–21:00/g) || []).length === 2);
  check("HTML footer ghi cả 2 showroom: " + rel, src.includes("241 Trần Hưng Đạo · MG15 Shophouse Vincom"));
}
check("CSS có lưới 2 địa điểm", css.includes(".loc-grid") && css.includes(".loc-card"));
/* ---------- Style Điệp Xuân (A–D) + 8 trang chính sách (2026-11-26) ---------- */
/* A. Màu nhấn đỏ nâu gỉ sắt #A93C11 (diepxuan.com): đúng mã chỉ dùng
   trên nền sáng (--rust, tương phản với trắng 6.28:1); trên nền navy
   dùng tông sáng cùng họ --rust-light (5.25:1). Vàng gold cũ bỏ hẳn. */
check("A: CSS có --rust #a93c11 (đúng mã diepxuan.com)", /--rust:\s*#a93c11/i.test(cssSrc));
check("A: CSS có --rust-light cho chữ trên nền tối", cssSrc.includes("--rust-light:"));
check("A: không còn dùng var(--gold)", !cssSrc.includes("var(--gold)"));
check("A: tên hãng EVERON trắng + ĐIỆP XUÂN đỏ nâu sáng trên nền navy (lockup 2 dòng mẫu DreamLand)", /\.brand strong \{[^}]*color: #fff/.test(cssSrc) && /\.brand-lockup em \{[^}]*color: var\(--rust-light\)/.test(cssSrc));
check("A: link Xem tất cả dùng #A93C11 trên nền sáng", /\.section-head \.more \{[^}]*color: var\(--rust\)/.test(cssSrc));
check("A: vạch active drawer + số hero-stats dùng đỏ nâu sáng", cssSrc.includes("box-shadow: inset 3px 0 0 var(--rust-light)") && cssSrc.includes(".hero-stats b { display: block; font-size: 24px; color: var(--rust-light); }"));
check("A: tiêu đề h2 trang chính sách có vạch đỏ nâu #A93C11", cssSrc.includes("border-left: 4px solid var(--rust)"));
check("C: hero trang chủ có slogan Chăn ga gối đệm cao cấp!", indexSrc.includes('<span class="hero-slogan">Chăn ga gối đệm cao cấp!</span>') && cssSrc.includes(".hero-slogan { color: var(--rust-light);"));
/* B. Logo Đ tự host (không hotlink): file tồn tại + mọi trang dùng. */
check("B: logo Điệp Xuân tự host tồn tại (assets/img/logo-diep-xuan.png)", existsSync(join(root, "assets/img/logo-diep-xuan.png")) && statSync(join(root, "assets/img/logo-diep-xuan.png")).size > 1000);
check("B: logo Đ đặt trên chip trắng bo tròn (mẫu DreamLand: .brand-logo 34px)", /\.brand-logo \{[^}]*background: #fff;[^}]*border-radius: 9px/.test(cssSrc) && cssSrc.includes(".footer-logo-dx { height: 24px;"));
check("B: drawer hiện đủ cụm logo (chip Đ + EVERON/ĐIỆP XUÂN, không ẩn logo)", !cssSrc.includes(".drawer-brand .brand-logo { display: none; }") && cssSrc.includes(".drawer-text { display: flex;") && /\.drawer-brand em \{[^}]*color: var\(--rust-light\)/.test(cssSrc));
for (const f of files.filter((x) => x.endsWith(".html"))) {
  const src = readFileSync(f, "utf8");
  const rel = f.replace(root + "/", "");
  check("logo header: lockup chip Đ + EVERON/ĐIỆP XUÂN xếp chồng: " + rel, src.includes('<span class="brand-text"><strong>EVERON</strong><em>ĐIỆP XUÂN</em></span>') && src.includes('src="' + (rel === "bo-chan-ga/index.html" ? "../" : "") + 'assets/img/logo-diep-xuan.png" alt="Điệp Xuân" width="34"'));
  check("logo drawer: đầu drawer chip Đ + EVERON/ĐIỆP XUÂN: " + rel, src.includes('<span class="drawer-text"><strong>EVERON</strong><em>ĐIỆP XUÂN</em></span>') && src.includes('src="' + (rel === "bo-chan-ga/index.html" ? "../" : "") + 'assets/img/logo-diep-xuan.png" alt="Điệp Xuân" width="30"'));
  check("logo header: không còn brand-logo-dx / wordmark Everon trong header+drawer (footer-logo-dx giữ nguyên): " + rel, !src.includes("brand-logo-dx") && !src.includes("logo-everon-trang.png") && src.includes('class="footer-logo-dx"'));
  check("logo header: CSS ?v=6 (cache-bust sau khi đổi CSS): " + rel, src.includes("style.css?v=6"));
}
/* D + 8 trang chính sách. */
const POLICY_PAGES = [
  "chinh-sach-van-chuyen.html", "chinh-sach-doi-tra.html", "chinh-sach-bao-hanh.html",
  "chinh-sach-bao-mat.html", "dieu-khoan-dich-vu.html", "huong-dan-mua-hang.html",
  "cau-hoi-thuong-gap.html", "he-thong-cua-hang.html",
];
for (const p of POLICY_PAGES) {
  check("chính sách: có trang " + p, existsSync(join(root, p)));
  const src = readFileSync(join(root, p), "utf8");
  check("chính sách: " + p + " có breadcrumb + khối hỗ trợ Zalo/gọi", src.includes('class="breadcrumb"') && src.includes("Cần hỗ trợ?") && src.includes("data-zalo-buttons") && src.includes('data-hotline'));
  check("chính sách: " + p + " không nhắc giỏ hàng/thanh toán online như luồng mua", !src.includes("thêm vào giỏ") && !src.includes("Tiết kiệm") && !/%\s*giảm|giá sale/i.test(src));
}
check("chính sách: trang hướng dẫn mua hàng viết theo luồng Zalo (4 bước, không giỏ hàng)", (() => {
  const s = readFileSync(join(root, "huong-dan-mua-hang.html"), "utf8");
  return ["Bước 1", "Bước 2", "Bước 3", "Bước 4"].every((b) => s.includes(b)) && s.includes("Nhắn Zalo") && !s.includes("thêm vào giỏ");
})());
for (const f of files.filter((x) => x.endsWith(".html"))) {
  const src = readFileSync(f, "utf8");
  const rel = f.replace(root + "/", "");
  const pfx = rel === "bo-chan-ga/index.html" ? "../" : "";
  check("D: footer có GPDKKD + địa chỉ xưởng: " + rel, src.includes("GPDKKD: 3100349022") && src.includes("Khu làng nghề Thuận Đức, Thuận Hoà, Thuận Đức, Đồng Hới, Quảng Bình"));
  check("D: footer có đủ 8 link chính sách + cửa hàng: " + rel, POLICY_PAGES.every((p) => src.includes('href="' + pfx + p + '"')));
  /* Footer mới (gói 26/11/2026): 2 dòng cuối + bỏ dòng Zalo bán hàng. */
  const footer = (src.match(/<footer[\s\S]*?<\/footer>/) || [""])[0];
  check("footer mới: có 2 dòng cuối (©2026 + GPDKKD + Liên hệ 241): " + rel, footer.includes('class="footer-bottom"') && footer.includes("©2026 Công ty TNHH Điệp Xuân. GPDKKD 3100349022. Địa chỉ: Khu làng nghề Thuận Đức, Đồng Hới, Quảng Trị.") && footer.includes("Liên hệ: 241 Trần Hưng Đạo, Nam Lý 2, Đồng Hới, Quảng Trị."));
  check("footer mới: không còn dòng Zalo bán hàng, Zalo vẫn còn ở mục liên hệ: " + rel, !footer.includes("Zalo bán hàng") && src.includes("data-zalo-buttons"));
}
check("D: CSS có lưới footer + nhóm link chính sách", cssSrc.includes(".footer-grid") && cssSrc.includes(".footer-policy"));
check("footer mới: CSS có .footer-bottom", cssSrc.includes(".footer-bottom"));
check("chính sách: site.json có đủ 2 số Zalo/hotline", Array.isArray(siteJson.zalo) && siteJson.zalo.map((z) => z.phone.replace(/\s/g, "")).includes("0911825151") && siteJson.zalo.map((z) => z.phone.replace(/\s/g, "")).includes("0363089565"));
const appJs = readFileSync(join(root, "assets/js/app.js"), "utf8");
check("app.js vẽ địa điểm từ site.locations", appJs.includes("[data-locations]") && appJs.includes("site.locations") && appJs.includes("locationsHTML"));
/* Header gọn: tìm kiếm ?q= + nút liên hệ nổi (2026-11-26). */
check("header gọn: app.js đọc ?q= vào ô lọc trang danh mục", appJs.includes('params.get("q")') && appJs.includes("qInput.value = qParam"));
check("header gọn: app.js chèn nút liên hệ nổi 1 lần (contact-fab)", appJs.includes("contact-fab") && appJs.includes('document.createElement("div")'));
check("header gọn: nút nổi mở ra đủ 4 lựa chọn (2 Zalo + 2 gọi)", ["https://zalo.me/0911825151", "https://zalo.me/0363089565", "tel:0911825151", "tel:0363089565"].every((h) => appJs.includes(h)));
check("header gọn: nút nổi không thêm Messenger/Facebook", !/messenger|facebook/i.test(appJs));
/* Scraper lấy toàn bộ ảnh: không còn giới hạn 3 ảnh trong media. */
const scraper = readFileSync(join(root, "scripts/sync/scrape-full.mjs"), "utf8");
check("scraper: lấy toàn bộ ảnh, không giới hạn 3 ảnh", scraper.includes("const media = base.images.map(") && !scraper.includes("base.images.slice(0, 3)"));
/* Tăng dần thật sự theo lastmod (sửa 23/11/2026): regex sitemap đọc đúng
   thứ tự thẻ, so sánh với lastmod đã lưu trong sync-state.json, --full
   chỉ dùng cho quét toàn bộ. */
check("scraper: tăng dần theo lastmod (so sánh sync-state.json)", scraper.includes("sync-state.json") && scraper.includes("isChanged") && scraper.includes("--full"));
/* Sửa 25/11/2026 (PR #18): 2 loại combo "+ Vỏ gối ôm" nằm cuối danh sách
   Bộ/Ga nên bước 2 phải thử hết boGaSets (không slice(0, 7)); ngân sách
   26 và vòng vét combo bước 6a để combo có đủ size chuẩn. */
check("scraper: thử hết loại Bộ/Ga, không slice(0, 7); ngân sách 26; có vòng vét combo",
  !scraper.includes("boGaSets.slice(0, 7)") && scraper.includes("for (const st of boGaSets)") && scraper.includes("budget: 26") && scraper.includes("comboSets"));

/* ---------- 2. DOM shim + chạy thử app.js ---------- */
const ENTITY_MAP = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decodeEntities(s) {
  return String(s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (_, n) => ENTITY_MAP[n] ?? "&" + n + ";");
}
class MiniElement {
  constructor(tag) {
    this.tagName = (tag || "div").toUpperCase();
    this.children = [];
    this._handlers = {};
    this.style = {};
    this.dataset = {};
    this._classSet = new Set();
    this.classList = {
      add: (c) => this._classSet.add(c),
      remove: (c) => this._classSet.delete(c),
      contains: (c) => this._classSet.has(c)
    };
    this._innerHTML = "";
    this.textContent = "";
    this.value = "";
    this._attrs = {};
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v);
    if (this.tagName === "TEXTAREA") this.value = decodeEntities(this._innerHTML);
    const s = this._innerHTML;
    for (const m of s.matchAll(/id="([^"]+)"/g)) {
      const el = new MiniElement("div");
      if (m[1] === "detail-info-wrap") {
        const openEnd = s.indexOf(">", s.indexOf('id="detail-info-wrap"')) + 1;
        const closeStart = s.lastIndexOf("</div>");
        el._innerHTML = s.slice(openEnd, closeStart);
      }
      MiniElement.registry[m[1]] = el;
    }
  }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(t, fn) { (this._handlers[t] = this._handlers[t] || []).push(fn); }
  dispatch(t, ev) { (this._handlers[t] || []).forEach((fn) => fn(ev || { target: this })); }
  querySelector() { return new MiniElement("div"); }
  querySelectorAll() { return []; }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k] ?? null; }
  closest() { return null; }
}
MiniElement.registry = {};

function makeEnv({ page, search, hover, mobile }) {
  MiniElement.registry = {};
  const byId = {};
  const doc = {
    readyState: "loading",
    title: "",
    body: { getAttribute: (k) => (k === "data-page" ? page : null), style: {} },
    _domHandlers: {},
    addEventListener(t, fn) { (this._domHandlers[t] = this._domHandlers[t] || []).push(fn); },
    getElementById(id) { return (byId[id] = byId[id] || MiniElement.registry[id] || new MiniElement("div")); },
    querySelectorAll() { return [new MiniElement("div"), new MiniElement("div")]; },
    querySelector() { return new MiniElement("span"); },
    createElement(tag) { return new MiniElement(tag); }
  };
  const sandbox = {
    console,
    URLSearchParams,
    document: doc,
    location: { search: search || "", pathname: page === "category" ? "/bo-chan-ga/" : "/" }
  };
  sandbox.window = sandbox;
  sandbox.innerWidth = mobile ? 390 : 1280;
  sandbox.window.__ROOT__ = page === "category" ? "../" : "./";
  sandbox.window.__DATA_BASE__ = page === "category" ? "../data/" : "data/";
  /* Giả lập thiết bị: mặc định là cảm ứng (không hover) để kiểm tra
     bấm mở menu; truyền hover: true để giả lập desktop có chuột. */
  sandbox.matchMedia = (q) => ({ matches: (hover === true && q === "(hover: hover)") || (mobile === true && q === "(max-width: 720px)"), media: q, addListener() {}, removeListener() {} });
  sandbox.fetch = async (url) => {
    const rel = String(url).replace(/^(\.\.\/)+/, "");
    const text = readFileSync(join(root, rel), "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, "assets/js/app.js"), "utf8"), sandbox);
  (doc._domHandlers.DOMContentLoaded || []).forEach((fn) => fn());
  return { sandbox, doc, byId };
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

/* Trang chủ */
{
  const { byId, doc } = makeEnv({ page: "home", search: "" });
  await tick(300);
  const feat = byId["featured-grid"].innerHTML;
  check("trang chủ: 8 sản phẩm nổi bật", (feat.match(/<article class="card">/g) || []).length === 8);
  check("trang chủ: không có link ra ngoài trong HTML render", !/href="https?:\/\/(?!zalo\.me)/.test(feat));
  /* Menu "Sản phẩm" render từ data: 4 nhóm, Bộ chăn ga là link duy
     nhất, 13 mục còn lại là "Sắp có" (không phải thẻ <a>). */
  const menu = byId["menu-san-pham"].innerHTML;
  check("menu Sản phẩm: đủ 4 nhóm Chăn ga gối / Đệm / Ruột / Phụ kiện", ["Chăn ga gối", "Đệm", "Ruột", "Phụ kiện"].every((g) => menu.includes(g)));
  check("menu Sản phẩm: Bộ chăn ga là link duy nhất tới bo-chan-ga/", (menu.match(/<a /g) || []).length === 1 && menu.includes('href="./bo-chan-ga/"') && menu.includes("Bộ chăn ga"));
  check("menu Sản phẩm: 13 mục Sắp có", (menu.match(/Sắp có/g) || []).length === 13);
  check("menu: trang chủ thì Sản phẩm không active", !byId["nav-san-pham"].classList.contains("active"));
  /* Bấm mục cha (môi trường kiểm thử giả lập cảm ứng): lần 1 mở
     dropdown, không chuyển trang; lần 2 thì theo link. */
  const prodLink = byId["nav-san-pham"];
  let prevented = false;
  const ev = { target: prodLink, preventDefault: () => { prevented = true; } };
  prodLink.dispatch("click", ev);
  check("menu: bấm Sản phẩm lần 1 mở dropdown, không chuyển trang", prodLink.classList.contains("open") && prevented);
  prevented = false;
  prodLink.dispatch("click", ev);
  check("menu: bấm Sản phẩm lần 2 thì theo link", !prodLink.classList.contains("open") && !prevented);
  prodLink.dispatch("click", ev);
  (doc._domHandlers.keydown || []).forEach((fn) => fn({ key: "Escape" }));
  check("menu: bấm Esc đóng dropdown", !prodLink.classList.contains("open"));
  /* Drawer: mặc định đóng; hamburger mở/đóng; nút ☰ thành ✕ khi mở;
     bấm backdrop / nút ✕ / Esc đóng; mở thì khoá cuộn body. */
  const navToggle = byId["nav-toggle"];
  const mainNav = byId["main-nav"];
  const backdrop = byId["nav-backdrop"];
  check("drawer: mặc định đóng (nav + backdrop không có open)", !mainNav.classList.contains("open") && !backdrop.classList.contains("open"));
  navToggle.dispatch("click", { target: navToggle });
  check("drawer: hamburger mở drawer + backdrop, nút ☰ thành ✕, khoá cuộn body", mainNav.classList.contains("open") && backdrop.classList.contains("open") && navToggle.textContent === "✕" && doc.body.style.overflow === "hidden");
  backdrop.dispatch("click", { target: backdrop });
  check("drawer: bấm backdrop đóng drawer + mở khoá cuộn", !mainNav.classList.contains("open") && !backdrop.classList.contains("open") && doc.body.style.overflow === "");
  navToggle.dispatch("click", { target: navToggle });
  byId["nav-close"].dispatch("click", { target: byId["nav-close"] });
  check("drawer: nút ✕ trong drawer đóng", !mainNav.classList.contains("open"));
  navToggle.dispatch("click", { target: navToggle });
  (doc._domHandlers.keydown || []).forEach((fn) => fn({ key: "Escape" }));
  check("drawer: bấm Esc đóng drawer", !mainNav.classList.contains("open"));
  navToggle.dispatch("click", { target: navToggle });
  check("menu: hamburger mở drawer", mainNav.classList.contains("open"));
  navToggle.dispatch("click", { target: navToggle });
  check("menu: hamburger bấm lại đóng drawer", !mainNav.classList.contains("open"));
}

/* Menu trên desktop có chuột (hover): bấm mục cha là đi thẳng theo
   link, không mở dropdown bằng click. */
{
  const { byId } = makeEnv({ page: "home", search: "", hover: true });
  await tick(300);
  const prodLink = byId["nav-san-pham"];
  let prevented = false;
  prodLink.dispatch("click", { target: prodLink, preventDefault: () => { prevented = true; } });
  check("menu (desktop): bấm Sản phẩm thì theo link, không mở dropdown", !prevented && !prodLink.classList.contains("open"));
}

/* Accordion 2 tầng trong drawer (mobile): mặc định chỉ hiện tiêu đề
   nhóm kèm số lượng; bấm 1 nhóm mở đúng nhóm đó, nhóm khác đóng. */
{
  const { byId } = makeEnv({ page: "home", search: "" });
  await tick(300);
  const menu = byId["menu-san-pham"].innerHTML;
  check("accordion: đủ 4 tiêu đề nhóm kèm số lượng (7/4/2/1)", ["Chăn ga gối", "(7)", "Đệm", "(4)", "Ruột", "(2)", "Phụ kiện", "(1)"].every((x) => menu.includes(x)));
  check("accordion: tiêu đề nhóm là nút bấm (4 nút menu-group-toggle)", (menu.match(/menu-group-toggle/g) || []).length === 4);
  const panel = byId["menu-san-pham"];
  const g1 = new MiniElement("div");
  const g2 = new MiniElement("div");
  const t1 = new MiniElement("button");
  const t2 = new MiniElement("button");
  t1.closest = (sel) => (sel === ".menu-group" ? g1 : (sel === ".menu-group-toggle" ? t1 : null));
  t2.closest = (sel) => (sel === ".menu-group" ? g2 : (sel === ".menu-group-toggle" ? t2 : null));
  g1.querySelector = () => t1;
  g2.querySelector = () => t2;
  panel.querySelectorAll = () => [g1, g2];
  panel.dispatch("click", { target: t1 });
  check("accordion: bấm nhóm 1 mở nhóm 1, nhóm 2 đóng", g1.classList.contains("open") && !g2.classList.contains("open") && t1.getAttribute("aria-expanded") === "true");
  panel.dispatch("click", { target: t2 });
  check("accordion: bấm nhóm 2 mở nhóm 2, nhóm 1 đóng", g2.classList.contains("open") && !g1.classList.contains("open"));
  panel.dispatch("click", { target: t2 });
  check("accordion: bấm lại nhóm 2 thì đóng", !g2.classList.contains("open"));
}

/* Drawer vuốt mở/đóng (mô phỏng touch, mobile 390px). */
{
  const { byId, doc } = makeEnv({ page: "home", search: "", mobile: true });
  await tick(300);
  const nav = byId["main-nav"];
  const touch = (x, y) => ({ touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }], preventDefault: () => {} });
  const fire = (handlers, ev) => (handlers || []).forEach((fn) => fn(ev));
  check("drawer: mặc định đóng trên mobile", !nav.classList.contains("open"));
  /* Vuốt từ mép phải sang trái để mở. */
  fire(doc._domHandlers.touchstart, touch(385, 400));
  fire(doc._domHandlers.touchmove, touch(320, 400));
  fire(doc._domHandlers.touchmove, touch(260, 400));
  fire(doc._domHandlers.touchend, touch(260, 400));
  check("drawer: vuốt từ mép phải mở được", nav.classList.contains("open") && byId["nav-backdrop"].classList.contains("open"));
  check("drawer: mở thì khoá cuộn body", doc.body.style.overflow === "hidden");
  /* Vuốt drawer sang phải để đóng. */
  fire((nav._handlers || {}).touchstart, touch(100, 400));
  fire((nav._handlers || {}).touchmove, touch(200, 400));
  fire((nav._handlers || {}).touchend, touch(200, 400));
  check("drawer: vuốt sang phải đóng được", !nav.classList.contains("open"));
  /* Vuốt dọc thì không mở drawer. */
  fire(doc._domHandlers.touchstart, touch(385, 400));
  fire(doc._domHandlers.touchmove, touch(380, 300));
  fire(doc._domHandlers.touchend, touch(380, 300));
  check("drawer: vuốt dọc không mở drawer", !nav.classList.contains("open"));
}

/* Địa điểm: render từ site.json */
{
  const { sandbox } = makeEnv({ page: "home", search: "" });
  await tick(300);
  const locHtml = sandbox.window.EveronUI.locationsHTML(siteJson);
  check("locations: render đủ 2 thẻ địa điểm", (locHtml.match(/<article class="loc-card">/g) || []).length === 2);
  check("locations: render có giờ 07:30–21:00 cả 2 chỗ", (locHtml.match(/07:30–21:00/g) || []).length === 2);
  check("locations: render có link bản đồ cả 2 chỗ", (locHtml.match(/google\.com\/maps/g) || []).length === 2);
  check("locations: chỉ 241 có đánh giá sao", (locHtml.match(/★/g) || []).length === 1 && locHtml.includes("4,7★"));
}

/* Trang danh mục */
{
  const { byId } = makeEnv({ page: "category", search: "" });
  await tick(300);
  const grid = byId["product-grid"];
  const cards = (grid.innerHTML.match(/<article class="card">/g) || []).length;
  check("danh mục: render đủ 189 sản phẩm", cards === 189, "đếm được " + cards);
  const oos = (grid.innerHTML.match(/Hết hàng/g) || []).length;
  check("danh mục: 33 nhãn Hết hàng", oos === 33, "đếm được " + oos);
  check("danh mục: số lượng hiển thị 189 / 189", byId["result-count"].textContent.includes("189 / 189"));
  check("danh mục: EPM22064 hiện giá gốc 4.980.000đ", grid.innerHTML.includes("EPM22064") && grid.innerHTML.includes("4.980.000đ"));
  check("danh mục: không hiện giá sale 2.739.000đ", !grid.innerHTML.includes("2.739.000đ"));
  check("giá gốc: không có nhãn % giảm trong danh sách", !/>−\d+%/.test(grid.innerHTML));
  check("giá gốc: không có giá gạch ngang trong danh sách", !grid.innerHTML.includes('class="old"'));
  check("ảnh: thẻ dùng đường dẫn tự lưu assets/img/products/", grid.innerHTML.includes('src="assets/img/products/'));
  check("ảnh: thẻ có data-fallback về nguồn", grid.innerHTML.includes('data-fallback="https://everon.com/'));
  const q = byId["filter-q"];
  q.value = "EPM22064";
  q.dispatch("input");
  await tick(50);
  check("lọc: tìm EPM22064 ra 1 sản phẩm", (grid.innerHTML.match(/<article class="card">/g) || []).length === 1);
  q.value = "";
  q.dispatch("input");
  const stock = byId["filter-stock"];
  stock.value = "out";
  stock.dispatch("change");
  await tick(50);
  check("lọc: hết hàng ra 33 sản phẩm", (grid.innerHTML.match(/<article class="card">/g) || []).length === 33);
  stock.value = "";
  stock.dispatch("change");
  const col = byId["filter-collection"];
  const has2027 = col.children.some((o) => o.value === "everon-2027");
  check("lọc: có option bộ sưu tập Everon 2027", has2027);
  col.value = "everon-2027";
  col.dispatch("change");
  await tick(50);
  check("lọc: Everon 2027 ra 25 sản phẩm", (grid.innerHTML.match(/<article class="card">/g) || []).length === 25);
  col.value = "";
  col.dispatch("change");
  const sort = byId["filter-sort"];
  sort.value = "price-asc";
  sort.dispatch("change");
  await tick(50);
  const firstPrice = grid.innerHTML.match(/<p class="price">([\d.]+)đ/);
  check("sắp xếp: giá tăng dần bắt đầu 219.000đ", firstPrice && firstPrice[1] === "219.000", firstPrice && firstPrice[1]);
  check("menu: trang danh mục thì Sản phẩm active", byId["nav-san-pham"].classList.contains("active"));
}

/* Trang danh mục: link ?collection= từ menu Bộ sưu tập */
{
  const { byId } = makeEnv({ page: "category", search: "?collection=bst-cutie-2027" });
  await tick(300);
  check("?collection=: Cutie 2027 lọc ra 3 sản phẩm", (byId["product-grid"].innerHTML.match(/<article class="card">/g) || []).length === 3);
  check("?collection=: ô chọn bộ sưu tập đã chọn Cutie 2027", byId["filter-collection"].value === "bst-cutie-2027");
}
{
  const { byId } = makeEnv({ page: "category", search: "?collection=khong-co" });
  await tick(300);
  check("?collection=: mã lạ thì bỏ qua, hiện đủ 189", (byId["product-grid"].innerHTML.match(/<article class="card">/g) || []).length === 189);
}

/* Trang danh mục: tìm kiếm từ ô tìm kiếm ở header (?q=) */
{
  const { byId } = makeEnv({ page: "category", search: "?q=EST25024" });
  await tick(300);
  check("?q=: tìm EST25024 từ header ra 1 sản phẩm", (byId["product-grid"].innerHTML.match(/<article class="card">/g) || []).length === 1);
  check("?q=: ô lọc trang danh mục đã điền EST25024", byId["filter-q"].value === "EST25024");
}

/* Trang chi tiết EPM22064 */
{
  const { byId, sandbox, doc } = makeEnv({ page: "detail", search: "?sku=EPM22064" });
  await tick(300);
  const box = byId["product-detail"];
  check("menu: trang chi tiết thì Sản phẩm active", byId["nav-san-pham"].classList.contains("active"));
  check("chi tiết: render EPM22064", box.innerHTML.includes("EPM22064"));
  check("chi tiết: giá mặc định là giá gốc 4.980.000đ", box.innerHTML.includes("4.980.000đ") && !box.innerHTML.includes("2.739.000đ"));
  check("giá gốc: chi tiết không có nhãn % giảm, không có giá gạch ngang, không có dòng Tiết kiệm", !/>−\d+%/.test(box.innerHTML) && !box.innerHTML.includes('class="old"') && !box.innerHTML.includes("Tiết kiệm"));
  check("giá gốc: bảng giá chỉ có 1 cột Giá gốc", box.innerHTML.includes("<th>Giá gốc</th>") && !box.innerHTML.includes("<th>Giá</th>"));
  check("chi tiết: có nút chọn Bộ chăn bốn mùa", box.innerHTML.includes("Bộ chăn bốn mùa"));
  check("chi tiết: có bảng giá 4 biến thể", (box.innerHTML.match(/<tr class="/g) || []).length === 4);
  check("chi tiết: mô tả đã cắt phần rác", !box.innerHTML.includes("Chính sách giao hàng"));
  check("chi tiết: có nút Nhắn Zalo kèm mã SP", box.innerHTML.includes("zalo.me") && box.innerHTML.includes("EPM22064"));
  check("chi tiết: ảnh chính dùng đường dẫn tự lưu, có fallback", box.innerHTML.includes('src="assets/img/products/') && box.innerHTML.includes('data-fallback="https://everon.com/'));
  {
    const ui = sandbox.window.EveronUI;
    const fakeImg = doc.createElement("img");
    fakeImg.src = "assets/img/products/epm22064/cover.webp";
    fakeImg.setAttribute("data-fallback", "https://everon.com/upload/x.jpg");
    ui.onImgError({ target: fakeImg });
    check("fallback: lỗi lần 1 đổi sang source_url", fakeImg.src === "https://everon.com/upload/x.jpg", fakeImg.src);
    ui.onImgError({ target: fakeImg });
    check("fallback: lỗi lần 2 ẩn ảnh, không đổi src nữa", fakeImg.style.display === "none" && fakeImg.src === "https://everon.com/upload/x.jpg");
    const noFb = doc.createElement("img");
    noFb.src = "assets/img/products/epm22064/cover.webp";
    ui.onImgError({ target: noFb });
    check("fallback: không có source_url thì ẩn luôn", noFb.style.display === "none");
  }
  const wrap = doc.getElementById("detail-info-wrap");
  const fakeBtn = { getAttribute: () => "Bộ chăn bốn mùa" };
  box.dispatch("click", { target: { closest: (sel) => (sel === "[data-set]" ? fakeBtn : null) } });
  await tick(50);
  check("chi tiết: đổi biến thể cập nhật giá gốc 5.640.000đ", wrap.innerHTML.includes("5.640.000đ") && !wrap.innerHTML.includes("3.102.000đ"));
  const gal = doc.getElementById("gallery");
  check("thư viện: có nút Trước/Sau và số đếm 1 / 3", box.innerHTML.includes('data-gal="prev"') && box.innerHTML.includes('data-gal="next"') && box.innerHTML.includes("1 / 3"));
  check("thư viện: ảnh chính có nút xem lớn", box.innerHTML.includes('data-gal="zoom"'));
  check("thư viện: đủ 3 ảnh nhỏ", (box.innerHTML.match(/data-gal-idx="/g) || []).length === 3);
  const fakeNext = { getAttribute: () => "next" };
  box.dispatch("click", { target: { closest: (sel) => (sel === "[data-gal]" ? fakeNext : null) } });
  await tick(50);
  check("thư viện: bấm Sau sang ảnh 2 / 3", gal.innerHTML.includes("2 / 3") && gal.innerHTML.includes("img-2.webp"));
  const fakeThumb3 = { getAttribute: () => "2" };
  box.dispatch("click", { target: { closest: (sel) => (sel === "[data-gal-idx]" ? fakeThumb3 : null) } });
  await tick(50);
  check("thư viện: bấm ảnh nhỏ thứ 3 sang ảnh 3 / 3", gal.innerHTML.includes("3 / 3") && gal.innerHTML.includes("img-3.webp"));
  const fakeZoom = { getAttribute: () => "zoom" };
  box.dispatch("click", { target: { closest: (sel) => (sel === "[data-gal]" ? fakeZoom : null) } });
  await tick(50);
  check("thư viện: bấm xem lớn không lỗi (môi trường kiểm thử không có body thật)", gal.innerHTML.includes("3 / 3"));
  const dirty = sandbox.window.EveronUI.cleanDescription("Mô tả thật. Đánh giá ( 0 ) Chính sách giao hàng xyz");
  check("cleanDescription cắt đúng phần rác", dirty === "Mô tả thật.");
}

/* Trang chi tiết mã không tồn tại */
{
  const { byId } = makeEnv({ page: "detail", search: "?sku=KHONGCO" });
  await tick(300);
  check("chi tiết: mã lạ hiện trang không tìm thấy", byId["not-found"].style.display === "block");
}

/* Dữ liệu */
{
  const products = JSON.parse(readFileSync(join(root, "data/products.json"), "utf8"));
  check("data: 189 sản phẩm", products.length === 189);
  check("data: 33 hết hàng", products.filter((p) => p.status === "out_of_stock").length === 33);
  check("data: mọi SP có ảnh cover", products.every((p) => (p.media || []).some((m) => m.source_url)));
  check("data: slug duy nhất", new Set(products.map((p) => p.slug)).size === 189);
}

console.log(failures === 0 ? "\nTẤT CẢ KIỂM TRA ĐẠT." : "\nCÓ " + failures + " KIỂM TRA LỖI.");
process.exit(failures === 0 ? 0 : 1);
