// Kiểm tra giao diện everon.site (chạy bằng node, không cần trình duyệt).
// Usage: node scripts/check.mjs
// 1. Kiểm tra tĩnh: không có chuỗi "everon.com" trong file HTML/CSS/JS,
//    không có link href nào trỏ ra ngoài (trừ Zalo + tel:).
// 2. Chạy thử app.js với DOM shim: render trang chủ / danh mục / chi tiết,
//    đếm sản phẩm, nhãn Hết hàng, thử bộ lọc và chọn biến thể.
import { readFileSync, readdirSync, statSync } from "node:fs";
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
    "không chứa everon.com: " + f.replace(root + "/", ""),
    !/everon\.com/i.test(src)
  );
}
/* Link href trong HTML: chỉ cho phép nội bộ, #..., zalo.me, tel:, mailto: */
for (const f of files.filter((x) => x.endsWith(".html"))) {
  const src = readFileSync(f, "utf8");
  const hrefs = [...src.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const bad = hrefs.filter(
    (h) => /^https?:\/\//i.test(h) && !h.startsWith("https://zalo.me/")
  );
  check("link ngoài chỉ có Zalo: " + f.replace(root + "/", ""), bad.length === 0, bad.join(", "));
}
const css = readFileSync(join(root, "assets/css/style.css"), "utf8");
check("CSS có breakpoint mobile 480px", css.includes("@media (max-width: 480px)"));
check("CSS có breakpoint desktop 720px", css.includes("@media (min-width: 720px)"));
check("CSS có kiểu nút Trước/Sau cho thư viện ảnh", css.includes(".gal-nav") && css.includes(".gal-count"));
check("CSS có kiểu xem ảnh lớn (lightbox)", css.includes(".lightbox") && css.includes(".lb-img"));
check("CSS dải ảnh nhỏ trượt ngang", css.includes(".thumbs") && css.includes("overflow-x: auto"));
/* Scraper lấy toàn bộ ảnh: không còn giới hạn 3 ảnh trong media. */
const scraper = readFileSync(join(root, "scripts/sync/scrape-full.mjs"), "utf8");
check("scraper: lấy toàn bộ ảnh, không giới hạn 3 ảnh", scraper.includes("const media = base.images.map(") && !scraper.includes("base.images.slice(0, 3)"));

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
    // Đăng ký các phần tử có id để getElementById tìm được sau khi render.
    // Riêng #detail-info-wrap là phần tử cuối trong chuỗi nên lấy được nội dung
    // bằng cách cắt tới thẻ </div> cuối cùng của chuỗi.
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

function makeEnv({ page, search }) {
  MiniElement.registry = {};
  const byId = {};
  const doc = {
    readyState: "loading",
    title: "",
    body: { getAttribute: (k) => (k === "data-page" ? page : null) },
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
  sandbox.window.__ROOT__ = page === "category" ? "../" : "./";
  sandbox.window.__DATA_BASE__ = page === "category" ? "../data/" : "data/";
  sandbox.fetch = async (url) => {
    const rel = String(url).replace(/^(\.\.\/)+/, "");
    const text = readFileSync(join(root, rel), "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, "assets/js/app.js"), "utf8"), sandbox);
  // Kích hoạt DOMContentLoaded -> init() chạy, fetch là async nên chờ 1 tick dài.
  (doc._domHandlers.DOMContentLoaded || []).forEach((fn) => fn());
  return { sandbox, doc, byId };
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

/* Trang chủ */
{
  const { byId } = makeEnv({ page: "home", search: "" });
  await tick(300);
  const feat = byId["featured-grid"].innerHTML;
  check("trang chủ: 8 sản phẩm nổi bật", (feat.match(/<article class="card">/g) || []).length === 8);
  check("trang chủ: có danh mục Bộ chăn ga", byId["category-grid"].innerHTML.includes("Bộ chăn ga"));
  check("trang chủ: danh mục chưa có dữ liệu ghi Sắp có", byId["category-grid"].innerHTML.includes("Sắp có"));
  check("trang chủ: không có link ra ngoài trong HTML render", !/href="https?:\/\/(?!zalo\.me)/.test(feat));
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
  /* Site chỉ hiện GIÁ GỐC: EPM22064 hiện 4.980.000đ, không hiện giá sale
     2.739.000đ, không nhãn % giảm, không giá gạch ngang. */
  check("danh mục: EPM22064 hiện giá gốc 4.980.000đ", grid.innerHTML.includes("EPM22064") && grid.innerHTML.includes("4.980.000đ"));
  check("danh mục: không hiện giá sale 2.739.000đ", !grid.innerHTML.includes("2.739.000đ"));
  check("giá gốc: không có nhãn % giảm trong danh sách", !/>−\d+%/.test(grid.innerHTML));
  check("giá gốc: không có giá gạch ngang trong danh sách", !grid.innerHTML.includes('class="old"'));
  // Ảnh: dùng ảnh tự lưu (media.src) trước, kèm fallback về source_url.
  check("ảnh: thẻ dùng đường dẫn tự lưu assets/img/products/", grid.innerHTML.includes('src="assets/img/products/'));
  check("ảnh: thẻ có data-fallback về nguồn", grid.innerHTML.includes('data-fallback="https://everon.com/'));
  // Bộ lọc: tìm theo mã
  const q = byId["filter-q"];
  q.value = "EPM22064";
  q.dispatch("input");
  await tick(50);
  check("lọc: tìm EPM22064 ra 1 sản phẩm", (grid.innerHTML.match(/<article class="card">/g) || []).length === 1);
  // Bộ lọc: hết hàng
  q.value = "";
  q.dispatch("input");
  const stock = byId["filter-stock"];
  stock.value = "out";
  stock.dispatch("change");
  await tick(50);
  check("lọc: hết hàng ra 33 sản phẩm", (grid.innerHTML.match(/<article class="card">/g) || []).length === 33);
  // Bộ lọc: bộ sưu tập everon-2027
  stock.value = "";
  stock.dispatch("change");
  const col = byId["filter-collection"];
  const has2027 = col.children.some((o) => o.value === "everon-2027");
  check("lọc: có option bộ sưu tập Everon 2027", has2027);
  col.value = "everon-2027";
  col.dispatch("change");
  await tick(50);
  check("lọc: Everon 2027 ra 25 sản phẩm", (grid.innerHTML.match(/<article class="card">/g) || []).length === 25);
  // Sắp xếp giá tăng dần
  col.value = "";
  col.dispatch("change");
  const sort = byId["filter-sort"];
  sort.value = "price-asc";
  sort.dispatch("change");
  await tick(50);
  const firstPrice = grid.innerHTML.match(/<p class="price">([\d.]+)đ/);
  check("sắp xếp: giá tăng dần bắt đầu 219.000đ", firstPrice && firstPrice[1] === "219.000", firstPrice && firstPrice[1]);
}

/* Trang chi tiết EPM22064 */
{
  const { byId, sandbox, doc } = makeEnv({ page: "detail", search: "?sku=EPM22064" });
  await tick(300);
  const box = byId["product-detail"];
  check("chi tiết: render EPM22064", box.innerHTML.includes("EPM22064"));
  /* Giá mặc định là GIÁ GỐC 4.980.000đ, không phải giá sale 2.739.000đ. */
  check("chi tiết: giá mặc định là giá gốc 4.980.000đ", box.innerHTML.includes("4.980.000đ") && !box.innerHTML.includes("2.739.000đ"));
  check("giá gốc: chi tiết không có nhãn % giảm, không có giá gạch ngang, không có dòng Tiết kiệm", !/>−\d+%/.test(box.innerHTML) && !box.innerHTML.includes('class="old"') && !box.innerHTML.includes("Tiết kiệm"));
  check("giá gốc: bảng giá chỉ có 1 cột Giá gốc", box.innerHTML.includes("<th>Giá gốc</th>") && !box.innerHTML.includes("<th>Giá</th>"));
  check("chi tiết: có nút chọn Bộ chăn bốn mùa", box.innerHTML.includes("Bộ chăn bốn mùa"));
  check("chi tiết: có bảng giá 4 biến thể", (box.innerHTML.match(/<tr class="/g) || []).length === 4);
  check("chi tiết: mô tả đã cắt phần rác", !box.innerHTML.includes("Chính sách giao hàng"));
  check("chi tiết: có nút Nhắn Zalo kèm mã SP", box.innerHTML.includes("zalo.me") && box.innerHTML.includes("EPM22064"));
  check("chi tiết: ảnh chính dùng đường dẫn tự lưu, có fallback", box.innerHTML.includes('src="assets/img/products/') && box.innerHTML.includes('data-fallback="https://everon.com/'));
  // Fallback ảnh: lỗi lần 1 -> đổi sang source_url; lỗi lần 2 -> ẩn ảnh.
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
  // Đổi biến thể sang Bộ chăn bốn mùa -> giá gốc 5.640.000đ (180x200, biến thể đầu tiên của nhóm)
  const wrap = doc.getElementById("detail-info-wrap");
  const fakeBtn = { getAttribute: () => "Bộ chăn bốn mùa" };
  box.dispatch("click", { target: { closest: (sel) => (sel === "[data-set]" ? fakeBtn : null) } });
  await tick(50);
  check("chi tiết: đổi biến thể cập nhật giá gốc 5.640.000đ", wrap.innerHTML.includes("5.640.000đ") && !wrap.innerHTML.includes("3.102.000đ"));
  // Thư viện ảnh: nút Trước/Sau, số đếm, ảnh nhỏ, bấm ảnh chính xem lớn.
  // (Trạng thái ban đầu đọc từ box.innerHTML; sau mỗi lần chuyển ảnh,
  //  showImage() render lại vào phần tử #gallery nên đọc từ gal.)
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
  // Hàm làm sạch mô tả (API kiểm thử)
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
