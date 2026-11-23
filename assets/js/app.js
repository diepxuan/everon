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
  function categoryUrl() {
    return ROOT + "bo-chan-ga/";
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
    document.querySelectorAll("[data-site-distributor]").forEach(function (el) {
      el.textContent = site.distributor;
    });
    document.querySelectorAll("[data-zalo-buttons]").forEach(function (el) {
      el.innerHTML = zaloButtonsHTML(site, null, null);
    });
    document.querySelectorAll("[data-hotline]").forEach(function (el) {
      var phone = (site.zalo || [])[0] ? site.zalo[0].phone : "";
      el.setAttribute("href", "tel:" + phone);
      el.textContent = phone.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
    });
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
    var catGrid = document.getElementById("category-grid");
    if (catGrid) {
      var cats = (data.categories.categories || []).map(function (c) {
        var ready = c.id === "bo-chan-ga";
        var count = ready ? data.products.length : c.product_count_on_source;
        if (ready) {
          return (
            '<a class="cat-card" href="' + esc(categoryUrl()) + '">' +
            "<h3>" + esc(c.name) + "</h3>" +
            '<p><span class="count">' + count + ' mẫu</span> — giá niêm yết, nhắn Zalo để đặt hàng.</p>' +
            "<p>Xem danh mục →</p></a>"
          );
        }
        return (
          '<div class="cat-card soon">' +
          "<h3>" + esc(c.name) + "</h3>" +
          '<p>Danh mục đang được cập nhật dữ liệu.</p>' +
          '<span class="tag-soon">Sắp có</span></div>'
        );
      }).join("\n");
      catGrid.innerHTML = cats;
    }
    var stat = document.getElementById("stat-products");
    if (stat) stat.textContent = data.products.length;
  }

  /* ---------- trang danh mục ---------- */
  var COLLECTION_LABELS = {
    "everon-2027": "Everon 2027",
    "bst-chan-ga-2022": "Bộ chăn ga 2022",
    "bst-cutie-2027": "Cutie 2027"
  };
  function initCategory(data) {
    var site = data.site;
    var products = data.products;
    var grid = document.getElementById("product-grid");
    var countEl = document.getElementById("result-count");
    var emptyEl = document.getElementById("empty-state");
    var qInput = document.getElementById("filter-q");
    var colSelect = document.getElementById("filter-collection");
    var stockSelect = document.getElementById("filter-stock");
    var sortSelect = document.getElementById("filter-sort");

    /* Bộ sưu tập: chỉ đưa những bộ sưu tập có ý nghĩa lọc
       (bỏ 2 bộ sưu tập mà cả 189 sản phẩm đều thuộc về). */
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

    function applyFilters() {
      var q = norm(qInput.value.trim());
      var col = colSelect.value;
      var stock = stockSelect.value;
      var sort = sortSelect.value;
      var list = products.filter(function (p) {
        if (q && norm(p.name + " " + p.sku).indexOf(q) === -1) return false;
        if (col && (p.collection_ids || []).indexOf(col) === -1) return false;
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
    [qInput, colSelect, stockSelect, sortSelect].forEach(function (el) {
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

  /* ---------- khởi động ---------- */
  function init() {
    var page = document.body ? document.body.getAttribute("data-page") : null;
    loadData()
      .then(function (data) {
        bindSite(data.site);
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
    defaultVariant: defaultVariant,
    displayPriceOfProduct: displayPriceOfProduct,
    displayPriceAmount: displayPriceAmount,
    onImgError: onImgError,
    localSrc: localSrc,
    fallbackSrc: fallbackSrc
  };
})();
