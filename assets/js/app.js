/* everon.site — tầng dữ liệu + render giao diện.
   Plain JavaScript, không framework. Một điểm đọc dữ liệu duy nhất:
   toàn bộ trang đều lấy dữ liệu từ thư mục data/*.json; sau này
   chuyển sang DB chỉ cần thay hàm fetchJSON, không đổi cấu trúc site.
   Lưu ý: không có link nào trong giao diện trỏ ra ngoài site. */
(function () {
  "use strict";

  var ROOT = window.__ROOT__ || "./";
  var DATA_BASE = window.__DATA_BASE__ || "data/";

  /* ---------- tiện ích ---------- */
  function vnd(n) {
    return Number(n || 0).toLocaleString("vi-VN") + "đ";
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function decodeEntities(s) {
    var t = document.createElement("textarea");
    t.innerHTML = String(s || "");
    return t.value;
  }
  /* Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu. */
  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }
  /* Mô tả nguồn thường kèm phần rác sau nội dung chính (đánh giá,
     chính sách giao hàng, form tư vấn...). Chỉ giữ phần mô tả thật. */
  var DESC_CUT_MARKERS = [
    "Đánh giá (",
    "Chính sách giao hàng",
    "Nhận tư vấn sản phẩm",
    "Thông tin sản phẩm",
    "- Chất liệu vải:",
    "Thêm vào giỏ",
    "Mua ngay",
    "Tìm cửa hàng"
  ];
  function cleanDescription(text) {
    var d = decodeEntities(text || "").replace(/\s+/g, " ").trim();
    var cut = d.length;
    DESC_CUT_MARKERS.forEach(function (m) {
      var i = d.indexOf(m);
      if (i > 0 && i < cut) cut = i;
    });
    d = d.slice(0, cut).trim();
    if (d.length > 900) d = d.slice(0, 900).replace(/\s+\S*$/, "") + "…";
    return d;
  }

  /* ---------- tầng đọc dữ liệu (điểm duy nhất) ---------- */
  var cache = null;
  function fetchJSON(rel) {
    return fetch(DATA_BASE + rel).then(function (r) {
      if (!r.ok) throw new Error("Không tải được " + rel + " (" + r.status + ")");
      return r.json();
    });
  }
  function loadData() {
    if (cache) return Promise.resolve(cache);
    return Promise.all([
      fetchJSON("products.json"),
      fetchJSON("site.json"),
      fetchJSON("categories.json")
    ]).then(function (res) {
      cache = { products: res[0], site: res[1], categories: res[2] };
      return cache;
    });
  }

  /* ---------- liên kết nội bộ + Zalo ---------- */
  function productUrl(p) {
    return ROOT + "san-pham.html?sku=" + encodeURIComponent(p.sku);
  }
  /* Đường dẫn trang danh mục theo slug (data/categories.json). Mặc định
     không đối số = Bộ chăn ga (giữ tương thích với code cũ). */
  function categoryUrl(slug) {
    return ROOT + (slug || "bo-chan-ga") + "/";
  }
  function zaloUrl(phone, message) {
    var u = "https://zalo.me/" + String(phone).replace(/\s/g, "");
    if (message) u += "?text=" + encodeURIComponent(message);
    return u;
  }
  function zaloMessage(p, variant) {
    var msg = "Chào Điệp Xuân, em muốn hỏi về sản phẩm " + p.name + " (Mã: " + p.sku + ")";
    if (variant) msg += " — " + variant.set_type + " " + variant.size;
    return msg;
  }
  function zaloButtonsHTML(site, p, variant) {
    return (site.zalo || [])
      .map(function (z, i) {
        return (
          '<a class="btn btn-zalo" href="' +
          esc(zaloUrl(z.phone, p ? zaloMessage(p, variant) : "")) +
          '" target="_blank" rel="noopener">Nhắn Zalo ' +
          esc(z.phone) +
          "</a>"
        );
      })
      .join("\n");
  }

  /* ---------- dữ liệu sản phẩm ---------- */
  function coverMedia(p) {
    var m = (p.media || []).find(function (x) { return x.role === "cover"; }) || (p.media || [])[0];
    return m || null;
  }
  /* Đường dẫn ảnh hiển thị: ưu tiên ảnh tự lưu trong repo (m.src),
     chưa có thì dùng source_url. Không hardcode tên miền nguồn ở đây —
     source_url lấy từ dữ liệu, nên giao diện không chứa link ra ngoài. */
  function localSrc(m) { return m ? (m.src || m.source_url || "") : ""; }
  function fallbackSrc(m) {
    var s = localSrc(m);
    return m && m.source_url && m.source_url !== s ? m.source_url : "";
  }
  /* Thẻ <img> kèm fallback: lỗi ảnh tự lưu -> đổi sang source_url 1 lần;
     lỗi cả source_url -> ẩn ảnh (không vỡ giao diện). */
  function imgHTML(m, alt, extra) {
    var src = localSrc(m);
    var fb = fallbackSrc(m);
    return '<img src="' + esc(src) + '"' +
      (fb ? ' data-fallback="' + esc(fb) + '"' : "") +
      ' alt="' + esc(alt) + '"' + (extra || "") + ">";
  }
  function onImgError(e) {
    var img = e && e.target ? e.target : null;
    if (!img || !img.getAttribute) return;
    var fb = img.getAttribute("data-fallback");
    if (fb && !(img.dataset && img.dataset.fbTried)) {
      if (img.dataset) img.dataset.fbTried = "1";
      img.src = fb;
      return;
    }
    // Cả ảnh tự lưu lẫn ảnh nguồn đều lỗi -> ẩn ảnh, giữ giao diện nguyên.
    if (img.classList) img.classList.add("img-broken");
    if (img.style) img.style.display = "none";
  }
  /* Gắn bắt lỗi ảnh (capture, vì sự kiện error không nổi bọt) cho mọi
     <img data-fallback> trong một khối vừa render xong. Gọi ngay sau
     mỗi lần gán innerHTML chứa ảnh — ảnh tải bất đồng bộ nên listener
     gắn kịp trước khi lỗi xảy ra. */
  function bindImageFallbacks(root) {
    if (!root || !root.querySelectorAll) return;
    var imgs = root.querySelectorAll("img[data-fallback]");
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].addEventListener("error", onImgError, true);
    }
  }
  function isOOS(p) {
    return p.status === "out_of_stock";
  }
  function defaultVariant(p) {
    var vs = p.variants || [];
    var d = vs.find(function (v) { return v.price && v.price.amount === (p.price && p.price.amount); });
    return d || vs[0] || null;
  }
  /* GIÁ HIỂN THỊ TRÊN SITE LÀ GIÁ GỐC (compare_at_price), không phải giá
     sau khuyến mãi. Dữ liệu vẫn giữ nguyên cả 2 giá (price = giá bán sau
     khuyến mãi, compare_at_price = giá gốc) để sau này cần thì dùng lại,
     nhưng giao diện chỉ hiện giá gốc, không hiện giá sale, không hiện
     nhãn % giảm, không hiện "tiết kiệm". */
  function displayPriceAmount(v, fallbackAmount) {
    var sale = v && v.price ? v.price.amount : null;
    var orig = v && v.compare_at_price ? v.compare_at_price.amount : null;
    if (orig != null && sale != null && orig > sale) return orig;
    if (sale != null) return sale;
    return fallbackAmount != null ? fallbackAmount : 0;
  }
  function displayPriceOfProduct(p) {
    var sale = p && p.price ? p.price.amount : null;
    var orig = p && p.compare_at_price ? p.compare_at_price.amount : null;
    if (orig != null && sale != null && orig > sale) return orig;
    return sale != null ? sale : 0;
  }

  /* ---------- thẻ sản phẩm ---------- */
  function cardHTML(p, site) {
    var coverM = coverMedia(p);
    var oos = isOOS(p)
      ? '<span class="badge badge-oos">Hết hàng</span>'
      : "";
    var material = p.attributes && p.attributes.material
      ? "<li><b>Chất liệu:</b> " + esc(p.attributes.material) + "</li>"
      : '<li><b>Chất liệu:</b> <span class="missing">chưa có trên nguồn</span></li>';
    var colors = ((p.attributes && p.attributes.colors) || []).join(" / ");
    var setTypes = ((p.attributes && p.attributes.set_types) || []).slice(0, 2).join(" · ");
    return (
      '<article class="card">' +
      '<a href="' + esc(productUrl(p)) + '" aria-label="' + esc(p.name) + '">' +
      imgHTML(coverM, p.name + " — " + p.sku, ' loading="lazy" width="600" height="600"' + (isOOS(p) ? ' class="oos-img"' : "")) +
      "</a>" +
      oos +
      '<div class="card-body">' +
      '<h3><a href="' + esc(productUrl(p)) + '">' + esc(p.name) + "</a></h3>" +
      '<p class="sku">Mã: ' + esc(p.sku) + "</p>" +
      '<p class="price">' + vnd(displayPriceOfProduct(p)) + "</p>" +
      "<ul class=\"attrs\">" +
      material +
      (colors ? "<li><b>Màu:</b> " + esc(colors) + "</li>" : "") +
      (setTypes ? "<li><b>Kiểu bộ:</b> " + esc(setTypes) + "</li>" : "") +
      "</ul>" +
      '<div class="cta">' +
      '<a class="btn btn-zalo" href="' + esc(zaloUrl((site.zalo || [])[0] ? site.zalo[0].phone : "", zaloMessage(p, null))) + '" target="_blank" rel="noopener">Nhắn Zalo</a>' +
      '<a class="btn btn-ghost" href="' + esc(productUrl(p)) + '">Xem chi tiết</a>' +
      "</div>" +
      "</div></article>"
    );
  }

  /* Thẻ 2 showroom (địa chỉ + giờ theo Google Business Profile).
     HTML tĩnh trong trang đã có sẵn 2 thẻ giống hệt để xem được khi
     chưa tải xong dữ liệu; hàm này vẽ lại từ site.locations để dữ
     liệu và giao diện không lệch nhau. */
  function locationsHTML(site) {
    return (site.locations || []).map(function (loc) {
      var phone = String(loc.phone || "").replace(/\s/g, "");
      return '<article class="loc-card">' +
        "<h3>" + esc(loc.name) + "</h3>" +
        "<p><b>Địa chỉ:</b> " + esc(loc.address) + "</p>" +
        "<p><b>Giờ mở cửa:</b> " + esc(loc.hours) + " hằng ngày.</p>" +
        '<p><b>Điện thoại:</b> <a href="tel:' + esc(phone) + '">' + esc(loc.phone) + "</a>" +
        (loc.maps_url ? ' · <a href="' + esc(loc.maps_url) + '" target="_blank" rel="noopener">Xem bản đồ</a>' : "") + "</p>" +
        (loc.rating ? "<p><b>Đánh giá:</b> " + esc(String(loc.rating).replace(".", ",")) + "★ (" + esc(String(loc.reviews || 0)) + " đánh giá trên Google)</p>" : "") +
        "</article>";
    }).join("");
  }

  /* ---------- gắn thông tin showroom / Zalo từ site.json ---------- */
  function bindSite(site) {
    document.querySelectorAll("[data-site-address]").forEach(function (el) {
      el.textContent = site.showroom.address;
    });
    document.querySelectorAll("[data-site-hours]").forEach(function (el) {
      el.textContent = site.hours.open + "–" + site.hours.close;
    });
    document.querySelectorAll("[data-site-serving]").forEach(function (el) {
      el.textContent = site.showroom.serving_note || "";
    });
    document.querySelectorAll("[data-locations]").forEach(function (el) {
      el.innerHTML = locationsHTML(site);
    });
    document.querySelectorAll("[data-site-distributor]").forEach(function (el) {
      el.textContent = site.distributor;
    });
    document.querySelectorAll("[data-zalo-buttons]").forEach(function (el) {
      el.innerHTML = zaloButtonsHTML(site, null, null);
    });
    document.querySelectorAll("[data-hotline]").forEach(function (el) {
      var phone = (site.zalo || [])[0] ? site.zalo[0].phone : "";
      el.setAttribute("href", "tel:" + phone);
      /* Nút trong drawer giữ nhãn "Gọi showroom" (data-keep-label);
         các nút khác hiện số điện thoại như cũ. */
      if (el.getAttribute("data-keep-label") === null) {
        el.textContent = phone.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
      }
    });
  }

  /* Nhãn loại đệm (attributes.mattress_type) và loại ruột
     (attributes.sub_type) — dùng ở bộ lọc trang danh mục. */
  var MATTRESS_TYPE_LABELS = {
    "lo-xo": "Đệm lò xo",
    "bong-ep": "Đệm bông ép",
    "cao-su": "Đệm cao su",
    "foam": "Đệm foam"
  };
  var SUB_TYPE_LABELS = {
    "ruot-goi": "Ruột gối",
    "ruot-chan": "Ruột chăn"
  };
  /* ---------- menu header ---------- */
  /* Màn cảm ứng không có hover: bấm mục cha thì mở dropdown (bấm lần
     nữa mới theo link). Desktop có hover: menu mở bằng hover /
     focus-within nên bấm là đi thẳng theo link. */
  var CAN_HOVER = true;
  try {
    CAN_HOVER = !window.matchMedia || window.matchMedia("(hover: hover)").matches;
  } catch (e) { CAN_HOVER = true; }
  /* Toàn bộ 12 danh mục đã live (full catalog 2026-11-26): menu hiện
     thành link thật tới trang danh mục. */
  var LIVE_CATEGORIES = ["bo-chan-ga", "chan-va-vo-chan", "ga", "vo-goi", "tre-em", "bo-chan-ga-artemis", "dem", "dem-k-bedding", "k-bedding", "ruot", "goi", "phu-kien"];
  /* Thứ tự 4 nhóm trong menu Sản phẩm (khớp trường group trong
     data/categories.json). */
  var MENU_GROUP_ORDER = ["Chăn ga gối", "Đệm", "Ruột & Gối", "Phụ kiện"];
  /* Tiêu đề nhóm là nút bấm: trên mobile (drawer) bấm để mở/đóng các
     mục con; trên desktop các mục con luôn hiện nên bấm không đổi gì
     nhìn thấy. Số lượng trong ngoặc chỉ hiện trên mobile (CSS). */
  function menuGroupHTML(title, itemsHTML, count) {
    return '<div class="menu-group"><button type="button" class="menu-group-toggle" aria-expanded="false">' + esc(title) + ' <span class="menu-count">(' + count + ')</span> <span class="caret" aria-hidden="true">▾</span></button><ul class="menu-group-items">' + itemsHTML + "</ul></div>";
  }
  /* Dropdown "Sản phẩm": render data-driven từ data/categories.json
     theo trường group (4 nhóm, mỗi mục là link thật tới trang danh
     mục qua categoryUrl). Danh mục chưa live (không có trong
     LIVE_CATEGORIES) thì bỏ qua. */
  function productsMenuHTML(data) {
    var cats = data.categories.categories || [];
    var cols = MENU_GROUP_ORDER.map(function (group) {
      var items = cats.filter(function (c) {
        return c.group === group && LIVE_CATEGORIES.indexOf(c.id) !== -1;
      }).map(function (c) {
        return '<li><a href="' + esc(categoryUrl(c.slug)) + '">' + esc(c.name) + "</a></li>";
      }).join("");
      if (!items) return "";
      /* Đếm số mục: nhóm Chăn ga gối và Đệm sang cột 1, 2 nhóm còn
         lại sang cột 2 (giữ bố cục 2 cột như trước). */
      return menuGroupHTML(group, items, cats.filter(function (c) { return c.group === group; }).length);
    });
    var col1 = cols.slice(0, 2).join("");
    var col2 = cols.slice(2).join("");
    return '<div class="menu-col">' + col1 + "</div>" +
      '<div class="menu-col">' + col2 + "</div>";
  }
  function closeMenus() {
    ["nav-san-pham", "nav-bo-suu-tap"].forEach(function (id) {
      var link = document.getElementById(id);
      if (!link) return;
      if (link.classList) link.classList.remove("open");
      link.setAttribute("aria-expanded", "false");
    });
    /* Đóng cả các nhóm con trong accordion (mở lại thì bắt đầu gọn). */
    var panel = document.getElementById("menu-san-pham");
    var groups = panel && panel.querySelectorAll ? panel.querySelectorAll(".menu-group.open") : [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].classList) groups[i].classList.remove("open");
      var t = groups[i].querySelector ? groups[i].querySelector(".menu-group-toggle") : null;
      if (t) t.setAttribute("aria-expanded", "false");
    }
  }
  /* Accordion 2 tầng trong drawer: bấm tiêu đề nhóm thì mở nhóm đó và
     đóng các nhóm khác (một lúc chỉ 1 nhóm mở). */
  function toggleMenuGroup(btn) {
    if (!btn || !btn.closest) return;
    var group = btn.closest(".menu-group");
    if (!group || !group.classList) return;
    var wasOpen = group.classList.contains("open");
    var panel = document.getElementById("menu-san-pham");
    var groups = panel && panel.querySelectorAll ? panel.querySelectorAll(".menu-group") : [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].classList) groups[i].classList.remove("open");
      var t = groups[i].querySelector ? groups[i].querySelector(".menu-group-toggle") : null;
      if (t) t.setAttribute("aria-expanded", "false");
    }
    if (!wasOpen) {
      group.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
    }
  }
  function toggleMenu(link, e) {
    if (CAN_HOVER) return true;
    if (!link || !link.classList) return true;
    var isOpen = link.classList.contains("open");
    closeMenus();
    if (!isOpen) {
      link.classList.add("open");
      link.setAttribute("aria-expanded", "true");
      if (e && e.preventDefault) e.preventDefault();
      return false;
    }
    return true;
  }
  /* ---------- drawer mobile (≤720px): trượt từ phải + vuốt ---------- */
  var EDGE_ZONE = 30; /* px tính từ mép phải: vùng bắt vuốt mở drawer */
  var SWIPE_MIN = 24; /* quãng tối thiểu để tính là một cái vuốt */
  var drag = null;
  function isMobileNav() {
    try {
      return !!window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
    } catch (e) { return false; }
  }
  function drawerIsOpen() {
    var nav = document.getElementById("main-nav");
    return !!(nav && nav.classList && nav.classList.contains("open"));
  }
  function lockBodyScroll(lock) {
    if (document.body && document.body.style) {
      document.body.style.overflow = lock ? "hidden" : "";
    }
  }
  function setToggleIcon(open) {
    var toggle = document.getElementById("nav-toggle");
    if (!toggle) return;
    toggle.textContent = open ? "✕" : "☰";
    toggle.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function openDrawer() {
    var nav = document.getElementById("main-nav");
    var backdrop = document.getElementById("nav-backdrop");
    if (!nav || !nav.classList) return;
    if (nav.style) nav.style.transform = "";
    if (nav.style) nav.style.visibility = "";
    closeMenus();
    nav.classList.add("open");
    if (backdrop && backdrop.style) { backdrop.style.opacity = ""; backdrop.style.transition = ""; }
    if (backdrop && backdrop.classList) backdrop.classList.add("open");
    lockBodyScroll(true);
    setToggleIcon(true);
  }
  function closeDrawer() {
    var nav = document.getElementById("main-nav");
    var backdrop = document.getElementById("nav-backdrop");
    if (nav && nav.classList) nav.classList.remove("open");
    if (backdrop && backdrop.style) { backdrop.style.opacity = ""; backdrop.style.transition = ""; }
    if (backdrop && backdrop.classList) backdrop.classList.remove("open");
    if (nav && nav.style) nav.style.transform = "";
    if (nav && nav.style) nav.style.visibility = "";
    lockBodyScroll(false);
    setToggleIcon(false);
    closeMenus();
  }
  function drawerWidth() {
    var nav = document.getElementById("main-nav");
    if (nav && nav.getBoundingClientRect) return nav.getBoundingClientRect().width;
    return 320;
  }
  function touchPoint(e) {
    var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    return t ? { x: t.clientX, y: t.clientY } : null;
  }
  function dragStart(x, y, mode) {
    var nav = document.getElementById("main-nav");
    if (nav && nav.classList) nav.classList.add("dragging");
    drag = { mode: mode, startX: x, startY: y, x: x, y: y, lastX: x, lastT: Date.now(), vx: 0, decided: false };
  }
  function dragMove(x, y, e) {
    if (!drag) return;
    var dx = x - drag.startX;
    var dy = y - drag.startY;
    var now = Date.now();
    drag.vx = (x - drag.lastX) / Math.max(1, now - drag.lastT);
    drag.lastX = x;
    drag.lastT = now;
    drag.x = x;
    drag.y = y;
    if (!drag.decided) {
      if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
      if (Math.abs(dx) <= Math.abs(dy)) { dragCancel(); return; }
      drag.decided = true;
    }
    if (e && e.preventDefault) e.preventDefault();
    var w = drawerWidth();
    var px;
    if (drag.mode === "open") {
      px = Math.max(0, Math.min(w, w - (drag.startX - x)));
    } else {
      px = Math.max(0, Math.min(w, x - drag.startX));
    }
    var nav = document.getElementById("main-nav");
    if (nav && nav.style) nav.style.transform = "translateX(" + px + "px)";
    /* Kéo mở: drawer đang visibility:hidden nên phải hiện ra để bám tay;
       backdrop mờ dần theo tiến độ kéo (cả 2 chiều). */
    if (nav && nav.style && drag.mode === "open") nav.style.visibility = "visible";
    var backdrop = document.getElementById("nav-backdrop");
    if (backdrop && backdrop.style) { backdrop.style.transition = "none"; backdrop.style.opacity = String(1 - px / w); }
  }
  function dragCancel() {
    if (!drag) return;
    drag = null;
    var nav = document.getElementById("main-nav");
    if (nav && nav.classList) nav.classList.remove("dragging");
    if (nav && nav.style) nav.style.transform = "";
    if (nav && nav.style) nav.style.visibility = "";
    var backdrop = document.getElementById("nav-backdrop");
    if (backdrop && backdrop.style) { backdrop.style.opacity = ""; backdrop.style.transition = ""; }
  }
  function dragEnd() {
    if (!drag) return;
    var d = drag;
    drag = null;
    var nav = document.getElementById("main-nav");
    if (nav && nav.classList) nav.classList.remove("dragging");
    if (!d.decided) return;
    var w = drawerWidth();
    var dx = d.x - d.startX;
    var open;
    if (d.mode === "open") {
      open = (-dx > w * 0.25) || (d.vx < -0.3);
    } else {
      open = !((dx > w * 0.25) || (d.vx > 0.3));
    }
    if (nav && nav.style) nav.style.transform = "";
    if (open) openDrawer(); else closeDrawer();
  }
  /* Vuốt mở/đóng drawer (touch, không thư viện). Chỉ can thiệp vuốt
     NGANG: mở khi bắt đầu trong ~30px mép phải và vuốt sang trái;
     đóng khi drawer đang mở và vuốt sang phải trên drawer/backdrop.
     Vuốt dọc không bị chặn (chưa chắc ngang thì không preventDefault). */
  function bindSwipe() {
    var nav = document.getElementById("main-nav");
    var backdrop = document.getElementById("nav-backdrop");
    if (document.addEventListener) {
      document.addEventListener("touchstart", function (e) {
        if (!isMobileNav() || drawerIsOpen() || drag) return;
        var p = touchPoint(e);
        if (!p) return;
        var w = (typeof window !== "undefined" && window.innerWidth) || 360;
        if (p.x < w - EDGE_ZONE) return;
        dragStart(p.x, p.y, "open");
      }, { passive: true });
      document.addEventListener("touchmove", function (e) {
        if (!drag || drag.mode !== "open") return;
        var p = touchPoint(e);
        if (p) dragMove(p.x, p.y, e);
      }, { passive: false });
      document.addEventListener("touchend", function () {
        if (drag && drag.mode === "open") dragEnd();
      });
      document.addEventListener("touchcancel", function () {
        if (drag && drag.mode === "open") dragCancel();
      });
    }
    [nav, backdrop].forEach(function (el) {
      if (!el || !el.addEventListener) return;
      el.addEventListener("touchstart", function (e) {
        if (!isMobileNav() || !drawerIsOpen() || drag) return;
        var p = touchPoint(e);
        if (p) dragStart(p.x, p.y, "close");
      }, { passive: true });
      el.addEventListener("touchmove", function (e) {
        if (!drag || drag.mode !== "close") return;
        var p = touchPoint(e);
        if (p) dragMove(p.x, p.y, e);
      }, { passive: false });
      el.addEventListener("touchend", function () {
        if (drag && drag.mode === "close") dragEnd();
      });
      el.addEventListener("touchcancel", function () {
        if (drag && drag.mode === "close") dragCancel();
      });
    });
  }

  function initMenu(data) {
    var page = document.body ? document.body.getAttribute("data-page") : null;
    /* Mục đang xem: trang chủ giữ class active tĩnh trong HTML; trang
       danh mục / chi tiết thì "Sản phẩm" active. */
    if (page === "category" || page === "detail") {
      var prodLink = document.getElementById("nav-san-pham");
      if (prodLink && prodLink.classList) prodLink.classList.add("active");
    }
    var panel = document.getElementById("menu-san-pham");
    if (panel) panel.innerHTML = productsMenuHTML(data);
    ["nav-san-pham", "nav-bo-suu-tap"].forEach(function (id) {
      var link = document.getElementById(id);
      if (link) link.addEventListener("click", function (e) { toggleMenu(link, e); });
    });
    /* Accordion nhóm con trong dropdown "Sản phẩm" (ủy quyền trên panel). */
    if (panel) panel.addEventListener("click", function (e) {
      var t = e && e.target && e.target.closest ? e.target.closest(".menu-group-toggle") : null;
      if (t) toggleMenuGroup(t);
    });
    /* Nút hamburger (mobile ≤720px): mở / đóng drawer. Nút ✕ trong
       drawer và bấm backdrop cũng đóng. */
    var toggle = document.getElementById("nav-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        if (drawerIsOpen()) closeDrawer(); else openDrawer();
      });
    }
    var closeBtn = document.getElementById("nav-close");
    if (closeBtn) closeBtn.addEventListener("click", function () { closeDrawer(); });
    var backdrop = document.getElementById("nav-backdrop");
    if (backdrop) backdrop.addEventListener("click", function () { closeDrawer(); });
    /* Esc hoặc bấm ra ngoài thì đóng dropdown / drawer. */
    if (document.addEventListener) {
      document.addEventListener("keydown", function (e) {
        if (e && e.key === "Escape") { closeDrawer(); closeMenus(); }
      });
      document.addEventListener("click", function (e) {
        var t = e && e.target && e.target.closest ? e.target.closest("[data-menu]") : null;
        if (!t) closeMenus();
      });
    }
    /* Vuốt mở/đóng drawer (touch). */
    bindSwipe();
  }

  /* ---------- trang chủ ---------- */
  function initHome(data) {
    var site = data.site;
    var grid = document.getElementById("featured-grid");
    if (grid) {
      /* Trước đây chọn 8 mẫu giảm giá sâu nhất; nay site chỉ hiện giá gốc
         nên chọn 8 mẫu đầu tiên theo tên A–Z, trung lập và ổn định. */
      var featured = data.products
        .slice()
        .sort(function (a, b) { return a.name < b.name ? -1 : 1; })
        .slice(0, 8);
      grid.innerHTML = featured.map(function (p) { return cardHTML(p, site); }).join("\n");
      bindImageFallbacks(grid);
    }
  }

  /* ---------- trang danh mục ---------- */
  var COLLECTION_LABELS = {
    "everon-2027": "Everon 2027",
    "bst-chan-ga-2022": "Bộ chăn ga 2022",
    "bst-cutie-2027": "Cutie 2027"
  };
  function initCategory(data) {
    var site = data.site;
    /* Trang danh mục nào đang mở: mỗi trang danh mục khai báo
       window.__CATEGORY__ trong <head>. Mặc định bo-chan-ga để trang
       cũ không khai báo vẫn chạy. Chỉ giữ sản phẩm có category_ids
       chứa danh mục này — không lọc thì trang Bộ chăn ga sẽ hiện cả
       437 sản phẩm của toàn catalog. */
    var catId = window.__CATEGORY__ || "bo-chan-ga";
    var products = data.products.filter(function (p) {
      return (p.category_ids || []).indexOf(catId) !== -1;
    });
    var grid = document.getElementById("product-grid");
    var countEl = document.getElementById("result-count");
    var emptyEl = document.getElementById("empty-state");
    var qInput = document.getElementById("filter-q");
    var colSelect = document.getElementById("filter-collection");
    var stockSelect = document.getElementById("filter-stock");
    var sortSelect = document.getElementById("filter-sort");
    /* Lọc theo loại (generic): ô chọn #filter-type chỉ hiện khi sản
       phẩm của danh mục hiện tại có >= 2 giá trị khác nhau của
       attributes.mattress_type (Đệm: lò xo / bông ép / cao su / foam)
       hoặc — riêng danh mục Ruột — của attributes.sub_type
       (ruot-goi / ruot-chan). Các danh mục khác (sub_type là mã nội
       bộ như bo-chan-ga, phu-kien-dem...) không hiện ô này. */
    var typeSelect = document.getElementById("filter-type");
    var typeWrap = document.getElementById("filter-type-wrap");
    var typeAttr = null;
    var typeLabels = null;
    var typeLabelText = "";
    (function () {
      var mtCounts = {};
      var stCounts = {};
      products.forEach(function (p) {
        var mt = p.attributes && p.attributes.mattress_type;
        if (mt) mtCounts[mt] = (mtCounts[mt] || 0) + 1;
        var st = p.attributes && p.attributes.sub_type;
        if (st) stCounts[st] = (stCounts[st] || 0) + 1;
      });
      if (Object.keys(mtCounts).length >= 2) {
        typeAttr = "mattress_type";
        typeLabels = MATTRESS_TYPE_LABELS;
        typeLabelText = "Loại đệm";
      } else if (catId === "ruot" && Object.keys(stCounts).length >= 2) {
        typeAttr = "sub_type";
        typeLabels = SUB_TYPE_LABELS;
        typeLabelText = "Loại ruột";
      }
      if (!typeAttr || !typeSelect) return;
      var counts = typeAttr === "mattress_type" ? mtCounts : stCounts;
      Object.keys(counts).sort().forEach(function (t) {
        var opt = document.createElement("option");
        opt.value = t;
        opt.textContent = (typeLabels[t] || t) + " (" + counts[t] + ")";
        typeSelect.appendChild(opt);
      });
      var typeLabel = typeWrap ? typeWrap.querySelector("label") : null;
      if (typeLabel) typeLabel.textContent = typeLabelText;
      if (typeWrap) typeWrap.style.display = "";
    })();

    /* Bộ sưu tập: chỉ đưa những bộ sưu tập có ý nghĩa lọc
       (bỏ bộ sưu tập mà cả danh mục hiện tại đều thuộc về). */
    var colCounts = {};
    products.forEach(function (p) {
      (p.collection_ids || []).forEach(function (c) {
        colCounts[c] = (colCounts[c] || 0) + 1;
      });
    });
    Object.keys(colCounts)
      .filter(function (c) { return colCounts[c] < products.length; })
      .sort(function (a, b) { return colCounts[b] - colCounts[a]; })
      .forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c;
        opt.textContent = (COLLECTION_LABELS[c] || c) + " (" + colCounts[c] + ")";
        colSelect.appendChild(opt);
      });

    /* Link từ menu "Bộ sưu tập" (?collection=<id>): chọn sẵn bộ lọc.
       Chỉ nhận bộ sưu tập có trong ô chọn (ít hơn 189 SP); mã lạ thì
       bỏ qua, hiện toàn bộ danh mục. */
    var params = new URLSearchParams(window.location.search);
    var colParam = params.get("collection") || "";
    if (colParam && colCounts[colParam] && colCounts[colParam] < products.length) {
      colSelect.value = colParam;
    }

    /* Tìm kiếm từ ô tìm kiếm ở header (?q=): điền sẵn vào ô lọc của
       trang danh mục rồi áp bộ lọc (cùng cách lọc không dấu theo
       tên/mã như khi gõ tay). Ô tìm kiếm ở header cũng hiện lại từ
       khóa để khách thấy mình vừa tìm gì. */
    var qParam = params.get("q") || "";
    if (qParam) {
      qInput.value = qParam;
      var headerQ = document.querySelector(".header-search input");
      if (headerQ) headerQ.value = qParam;
    }

    function applyFilters() {
      var q = norm(qInput.value.trim());
      var col = colSelect.value;
      var stock = stockSelect.value;
      var sort = sortSelect.value;
      var typeVal = typeSelect ? typeSelect.value : "";
      var list = products.filter(function (p) {
        if (q && norm(p.name + " " + p.sku).indexOf(q) === -1) return false;
        if (col && (p.collection_ids || []).indexOf(col) === -1) return false;
        if (typeVal && typeAttr && !(p.attributes && p.attributes[typeAttr] === typeVal)) return false;
        if (stock === "in" && isOOS(p)) return false;
        if (stock === "out" && !isOOS(p)) return false;
        return true;
      });
      /* Sắp xếp theo GIÁ GỐC hiển thị, không theo giá sale. Không còn lựa
         chọn "giảm giá nhiều nhất" vì site không hiện % giảm nữa. */
      if (sort === "price-asc") list.sort(function (a, b) { return displayPriceOfProduct(a) - displayPriceOfProduct(b); });
      else if (sort === "price-desc") list.sort(function (a, b) { return displayPriceOfProduct(b) - displayPriceOfProduct(a); });
      else if (sort === "name-asc") list.sort(function (a, b) { return a.name < b.name ? -1 : 1; });

      countEl.textContent =
        "Hiển thị " + list.length + " / " + products.length + " sản phẩm" +
        (list.some(isOOS) || stock !== "in"
          ? " — sản phẩm hết hàng vẫn hiển thị kèm nhãn “Hết hàng”."
          : ".");
      grid.innerHTML = list.map(function (p) { return cardHTML(p, site); }).join("\n");
      bindImageFallbacks(grid);
      emptyEl.style.display = list.length ? "none" : "block";
    }
    [qInput, colSelect, stockSelect, sortSelect, typeSelect].forEach(function (el) {
      if (!el) return;
      el.addEventListener("input", applyFilters);
      el.addEventListener("change", applyFilters);
    });
    applyFilters();
  }

  /* ---------- trang chi tiết ---------- */
  function initDetail(data) {
    var site = data.site;
    var params = new URLSearchParams(window.location.search);
    var sku = (params.get("sku") || "").trim();
    var box = document.getElementById("product-detail");
    var notFound = document.getElementById("not-found");
    var p = data.products.find(function (x) {
      return x.sku.toLowerCase() === sku.toLowerCase() || x.slug === sku.toLowerCase();
    });
    if (!p) {
      if (box) box.style.display = "none";
      if (notFound) {
        notFound.style.display = "block";
        var q = notFound.querySelector("[data-missing-sku]");
        if (q) q.textContent = sku || "(không có mã)";
      }
      return;
    }
    document.title = p.name + " (" + p.sku + ") | Everon Điệp Xuân";

    var variants = p.variants || [];
    var groups = [];
    variants.forEach(function (v) {
      if (groups.indexOf(v.set_type) === -1) groups.push(v.set_type);
    });
    var selected = defaultVariant(p) || variants[0];
    var state = {
      setType: selected ? selected.set_type : null,
      size: selected ? selected.size : null
    };
    function currentVariant() {
      return variants.find(function (v) {
        return v.set_type === state.setType && v.size === state.size;
      }) || selected;
    }

    var media = p.media || [];
    var coverM = coverMedia(p);
    /* Thư viện ảnh sản phẩm: nút Trước/Sau, bấm ảnh chính để xem lớn
       (lightbox tự viết, không framework), dải ảnh nhỏ trượt ngang.
       galIndex là ảnh đang xem (0 = ảnh bìa). */
    var galIndex = 0;
    function galCount() { return media.length; }
    /* Phần trong của khung gallery — showImage() render lại chuỗi này
       mỗi lần chuyển ảnh để số đếm và ảnh nhỏ đang chọn cập nhật. */
    function galleryInner() {
      var m = media[galIndex] || coverM;
      var nav = galCount() > 1
        ? '<button type="button" class="gal-nav gal-prev" data-gal="prev" aria-label="Ảnh trước">‹</button>' +
          '<button type="button" class="gal-nav gal-next" data-gal="next" aria-label="Ảnh sau">›</button>' +
          '<span class="gal-count">' + (galIndex + 1) + " / " + galCount() + "</span>"
        : "";
      return (
        '<div class="main-wrap">' +
        '<button type="button" class="main-btn" data-gal="zoom" aria-label="Bấm để xem ảnh lớn">' +
        imgHTML(m, p.name + " — " + p.sku, ' id="main-img" class="main-img"') +
        "</button>" +
        nav +
        "</div>" +
        (galCount() > 1
          ? '<div class="thumbs">' +
            media.map(function (x, i) {
              return (
                '<button type="button" data-gal-idx="' + i + '" class="' + (i === galIndex ? "active" : "") + '" aria-label="Ảnh ' + (i + 1) + '">' +
                imgHTML(x, "", ' loading="lazy"') + "</button>"
              );
            }).join("") +
            "</div>"
          : "")
      );
    }
    function showImage(i) {
      var n = galCount();
      if (!n) return;
      galIndex = ((i % n) + n) % n;
      var gal = document.getElementById("gallery");
      if (gal) {
        gal.innerHTML = galleryInner();
        bindImageFallbacks(gal);
        var active = gal.querySelector(".thumbs button.active");
        if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
    /* Xem ảnh lớn: lớp phủ toàn màn hình với ảnh hiện tại, nút Trước/Sau,
       nút đóng, bấm ra nền thì đóng, Esc / phím mũi tên cũng dùng được. */
    var lbKeyOn = false;
    function lightboxHTML() {
      var m = media[galIndex] || coverM;
      return (
        '<button type="button" class="lb-close" data-lb="close" aria-label="Đóng">×</button>' +
        '<button type="button" class="lb-nav lb-prev" data-lb="prev" aria-label="Ảnh trước">‹</button>' +
        imgHTML(m, p.name + " — " + p.sku, ' class="lb-img"') +
        '<button type="button" class="lb-nav lb-next" data-lb="next" aria-label="Ảnh sau">›</button>' +
        '<span class="lb-count">' + (galIndex + 1) + " / " + galCount() + "</span>"
      );
    }
    function refreshLightbox() {
      var lb = document.getElementById("lightbox");
      if (lb) {
        lb.innerHTML = lightboxHTML();
        bindImageFallbacks(lb);
      }
    }
    function onLbKey(e) {
      if (!e) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") { showImage(galIndex - 1); refreshLightbox(); }
      else if (e.key === "ArrowRight") { showImage(galIndex + 1); refreshLightbox(); }
    }
    function closeLightbox() {
      var lb = document.getElementById("lightbox");
      if (lb && lb.parentNode && lb.parentNode.removeChild) lb.parentNode.removeChild(lb);
      if (lbKeyOn && document.removeEventListener) {
        document.removeEventListener("keydown", onLbKey);
        lbKeyOn = false;
      }
    }
    function openLightbox() {
      if (!galCount()) return;
      var body = document.body;
      if (!body || !body.appendChild || !document.createElement) return;
      closeLightbox();
      var lb = document.createElement("div");
      lb.className = "lightbox";
      lb.setAttribute("id", "lightbox");
      lb.setAttribute("role", "dialog");
      lb.setAttribute("aria-label", "Xem ảnh lớn");
      lb.innerHTML = lightboxHTML();
      bindImageFallbacks(lb);
      lb.addEventListener("click", function (e) {
        var t = e.target && e.target.closest ? e.target.closest("[data-lb]") : null;
        if (!t) {
          if (e.target === lb) closeLightbox();
          return;
        }
        var a = t.getAttribute("data-lb");
        if (a === "close") closeLightbox();
        else if (a === "prev") { showImage(galIndex - 1); refreshLightbox(); }
        else if (a === "next") { showImage(galIndex + 1); refreshLightbox(); }
      });
      body.appendChild(lb);
      if (document.addEventListener) {
        document.addEventListener("keydown", onLbKey);
        lbKeyOn = true;
      }
    }

    function renderInfo() {
      var v = currentVariant();
      /* Giá hiển thị là giá gốc của biến thể đang chọn. */
      var price = displayPriceAmount(v, displayPriceOfProduct(p));
      var oos = isOOS(p);
      var attrs = p.attributes || {};
      var specRows = [
        ["Mã sản phẩm", esc(p.sku)],
        ["Chất liệu", attrs.material ? esc(attrs.material) : '<span class="missing">chưa có trên nguồn</span>'],
        ["Màu sắc", (attrs.colors || []).length ? esc(attrs.colors.join(" / ")) : '<span class="missing">chưa có trên nguồn</span>'],
        ["Họa tiết", attrs.pattern_type ? esc(attrs.pattern_type + (attrs.pattern ? " — " + attrs.pattern : "")) : '<span class="missing">chưa có trên nguồn</span>'],
        ["Xuất xứ", attrs.origin ? esc("Việt Nam") : '<span class="missing">chưa có trên nguồn</span>'],
        ["Loại bộ", (attrs.set_types || []).length ? esc(attrs.set_types.join(" · ")) : '<span class="missing">chưa có trên nguồn</span>']
      ].map(function (r) {
        return "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>";
      }).join("");

      var setBtns = groups.map(function (g) {
        return '<button type="button" class="opt' + (g === state.setType ? " active" : "") + '" data-set="' + esc(g) + '">' + esc(g) + "</button>";
      }).join("");
      var sizes = variants.filter(function (x) { return x.set_type === state.setType; });
      var sizeBtns = sizes.map(function (x) {
        return '<button type="button" class="opt' + (x.size === state.size ? " active" : "") + '" data-size="' + esc(x.size) + '">' + esc(x.size) + "</button>";
      }).join("");
      var tableRows = variants.map(function (x) {
        var cur = v && x.sku === v.sku && x.set_type === v.set_type && x.size === v.size;
        return (
          '<tr class="' + (cur ? "current" : "") + '"><td>' + esc(x.set_type) + "</td><td>" + esc(x.size) + "</td><td>" + vnd(displayPriceAmount(x, null)) + "</td></tr>"
        );
      }).join("");

      var desc = cleanDescription(p.description);
      return (
        '<div class="detail-info">' +
        '<h1>' + esc(p.name) + "</h1>" +
        '<p class="sku">Mã: ' + esc(p.sku) + (v && v.sku !== p.sku ? " · Biến thể: " + esc(v.sku) : "") + "</p>" +
        (oos
          ? '<span class="stock-note oos">Hết hàng — nhắn Zalo để hỏi khi nào có hàng</span>'
          : '<span class="stock-note in">Còn hàng</span>') +
        '<p class="detail-price">' + vnd(price) + "</p>" +
        (groups.length
          ? '<div class="variant-box"><h3>Chọn loại bộ</h3><div class="opt-row" id="set-picker">' + setBtns + "</div>" +
            '<h3>Chọn kích thước</h3><div class="opt-row" id="size-picker">' + sizeBtns + "</div></div>"
          : "") +
        '<div class="detail-cta">' +
        zaloButtonsHTML(site, p, v) +
        '<a class="btn btn-call" data-hotline href="tel:">Gọi showroom</a>' +
        "</div>" +
        '<table class="spec">' + specRows + "</table>" +
        (desc ? '<h3>Mô tả</h3><p class="desc">' + esc(desc) + "</p>" : "") +
        (variants.length > 1
          ? "<h3>Bảng giá theo loại bộ và kích thước</h3>" +
            '<table class="price-table"><thead><tr><th>Loại bộ</th><th>Kích thước</th><th>Giá gốc</th></tr></thead><tbody>' + tableRows + "</tbody></table>"
          : "") +
        "</div>"
      );
    }

    box.innerHTML = '<div class="gallery" id="gallery">' + galleryInner() + '</div>' + '<div id="detail-info-wrap">' + renderInfo() + "</div>";
    bindImageFallbacks(box);
    bindSite(site);

    box.addEventListener("click", function (e) {
      var t = e.target;
      /* Thư viện ảnh: nút Trước/Sau / xem lớn / chọn ảnh nhỏ. */
      var galBtn = t && t.closest ? t.closest("[data-gal]") : null;
      if (galBtn) {
        var g = galBtn.getAttribute("data-gal");
        if (g === "prev") showImage(galIndex - 1);
        else if (g === "next") showImage(galIndex + 1);
        else if (g === "zoom") openLightbox();
        return;
      }
      var thumbBtn = t && t.closest ? t.closest("[data-gal-idx]") : null;
      if (thumbBtn) {
        showImage(parseInt(thumbBtn.getAttribute("data-gal-idx"), 10) || 0);
        return;
      }
      var setBtn = e.target.closest("[data-set]");
      var sizeBtn = e.target.closest("[data-size]");
      if (setBtn) {
        state.setType = setBtn.getAttribute("data-set");
        var first = variants.find(function (x) { return x.set_type === state.setType; });
        state.size = first ? first.size : state.size;
      } else if (sizeBtn) {
        state.size = sizeBtn.getAttribute("data-size");
      } else {
        return;
      }
      var wrap = document.getElementById("detail-info-wrap");
      if (wrap) wrap.innerHTML = renderInfo();
      bindSite(site);
    });
  }

  /* ---------- nút liên hệ nổi (1 nút tròn trắng góc dưới-phải) ---------- */
  /* Mẫu trang gốc đã xác minh: 1 nút tròn trắng ~60px góc dưới-phải;
     bấm mở chồng dọc 4 lựa chọn phía trên (2 Zalo + 2 số gọi, đúng
     thứ tự này), bấm nút X thì đóng. Chèn bằng JS một lần nên hiện cả
     trên các trang chính sách (các trang này đều load app.js +
     style.css). Không thêm kênh chat/mạng xã hội khác. Các lựa chọn là pill
     kèm số (không phải nút tròn chỉ có icon) để phân biệt được 2 số
     Zalo với 2 số gọi. */
  var CONTACT_FAB_LINKS = [
    { href: "https://zalo.me/0911825151", label: "Nhắn Zalo 0911825151", kind: "zalo", short: "Zalo" },
    { href: "https://zalo.me/0363089565", label: "Nhắn Zalo 0363 089 565", kind: "zalo", short: "Zalo" },
    { href: "tel:0911825151", label: "Gọi 0911 825 151", kind: "call", short: "Gọi" },
    { href: "tel:0363089565", label: "Gọi 0363 089 565", kind: "call", short: "Gọi" }
  ];
  var FAB_CHAT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.2-.8l.4-.5c.1-.2.1-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"/></svg>';
  function initContactFab() {
    if (!document || !document.createElement || !document.body || !document.body.appendChild) return;
    if (document.getElementById("contact-fab")) return;
    var fab = document.createElement("div");
    fab.className = "contact-fab";
    fab.setAttribute("id", "contact-fab");
    var opts = CONTACT_FAB_LINKS.map(function (l) {
      var target = l.href.indexOf("https://") === 0 ? ' target="_blank" rel="noopener"' : "";
      return '<a class="contact-fab-opt" href="' + esc(l.href) + '"' + target + '><span class="fab-ico ' + l.kind + '">' + esc(l.short) + "</span>" + esc(l.label) + "</a>";
    }).join("");
    fab.innerHTML = '<div class="contact-fab-opts">' + opts + "</div>" +
      '<button type="button" class="contact-fab-btn" aria-label="Liên hệ Điệp Xuân" aria-expanded="false"></button>';
    document.body.appendChild(fab);
    var btn = fab.querySelector(".contact-fab-btn");
    function setFab(open) {
      if (fab.classList) {
        if (open) fab.classList.add("open"); else fab.classList.remove("open");
      }
      if (btn) {
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-label", open ? "Đóng liên hệ" : "Liên hệ Điệp Xuân");
        btn.innerHTML = open ? "✕" : FAB_CHAT_ICON;
      }
    }
    setFab(false);
    if (btn && btn.addEventListener) btn.addEventListener("click", function () {
      setFab(!fab.classList.contains("open"));
    });
    if (document.addEventListener) document.addEventListener("keydown", function (e) {
      if (e && e.key === "Escape") setFab(false);
    });
  }

  /* ---------- khởi động ---------- */
  function init() {
    var page = document.body ? document.body.getAttribute("data-page") : null;
    initContactFab();
    loadData()
      .then(function (data) {
        bindSite(data.site);
        initMenu(data);
        if (page === "home") initHome(data);
        else if (page === "category") initCategory(data);
        else if (page === "detail") initDetail(data);
      })
      .catch(function (err) {
        var el = document.getElementById("load-error");
        if (el) {
          el.style.display = "block";
          el.textContent = "Không tải được dữ liệu sản phẩm. Vui lòng thử tải lại trang hoặc nhắn Zalo cho showroom.";
        }
        if (window.console) console.error(err);
      });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* API phục vụ kiểm thử (không dùng trong giao diện). */
  window.EveronUI = {
    cleanDescription: cleanDescription,
    norm: norm,
    vnd: vnd,
    categoryUrl: categoryUrl,
    defaultVariant: defaultVariant,
    displayPriceOfProduct: displayPriceOfProduct,
    displayPriceAmount: displayPriceAmount,
    locationsHTML: locationsHTML,
    onImgError: onImgError,
    localSrc: localSrc,
    fallbackSrc: fallbackSrc
  };
})();
