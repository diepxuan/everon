# everon.site

Site **giới thiệu** nhãn hàng **Everon** — chăn ga, gối, đệm, phụ kiện — tại thị trường Quảng Bình, Quảng Trị.

## Mục tiêu

`everon.site` là kênh giới thiệu nhãn hàng Everon do **Công ty TNHH Điệp Xuân** — nhà phân phối Everon tại **Quảng Bình và Quảng Trị** — vận hành. Site mirror nội dung sản phẩm từ [everon.com](https://everon.com) (thuộc sở hữu **Công ty Cổ phần Everpia**), giúp khách hàng trong khu vực tham khảo catalog đầy đủ.

Phạm vi hiện tại là **giới thiệu**, không phải bán hàng trực tiếp. CTA liên hệ hiện dùng SĐT cá nhân Sếp `0363089565` (fallback tạm thời); sẽ thay bằng ZaloOA Điệp Xuân khi có.

## Quan hệ thương hiệu

| Bên | Vai trò |
|---|---|
| **Công ty Cổ phần Everpia** | Chủ sở hữu nhãn hiệu **Everon** (theo công bố trên `everon.com`) |
| **Công ty TNHH Điệp Xuân** | Nhà phân phối nhãn hiệu Everon tại Quảng Bình, Quảng Trị — đơn vị vận hành `everon.site` |
| **everon.com** | Site chính thức của nhãn hàng Everon (thuộc Everpia) |
| **everon.site** | Site giới thiệu của nhà phân phối Điệp Xuân |

## Stack kỹ thuật

| Lớp | Công nghệ |
|---|---|
| Markup | HTML5 thuần, `lang="vi"` |
| Style | CSS3 thuần + token (`--token-*`) trong `assets/css/main.css` |
| Script client | **Thuần JS** trong `assets/js/main.js` — `fetch()` JSON tĩnh, render DOM |
| Data tĩnh | `assets/data/products.json` — sinh ra từ **build-time fetch** |
| Build-time fetch | `scripts/fetch-everon.js` — fetch HTML `everon.com`, parse, ghi JSON |
| Scheduler | GitHub Action `.github/workflows/fetch-everon.yml` (cron định kỳ) |
| Hosting | GitHub Pages, build từ `main` (root) |

**Tại sao không fetch trực tiếp từ client JS?**

`everon.com` không có header `Access-Control-Allow-Origin` (CORS chặn), CSP `frame-ancestors 'self'` (chặn iframe), không có public JSON API. Browser sẽ chặn mọi `fetch()` từ domain khác. Vì vậy dùng **build-time fetch**: chạy script server-side (Node hoặc Python) fetch `everon.com`, parse HTML, ghi JSON tĩnh vào repo. Client JS chỉ đọc JSON local.

**Lưu ý pháp lý:** Build-time fetch vẫn là scraping `everon.com`. Sếp tự chịu trách nhiệm hoặc cần thoả thuận với Everpia. Em chỉ chạy script khi Sếp xác nhận.

## Trạng thái

| Hạng mục | Trạng thái |
|---|---|
| Bộ instruction (SOUL/USER/IDENTITY/TOOLS/AGENTS/MEMORY/HEARTBEAT/CLAUDE) | đã có |
| Source code (HTML/CSS/JS/script fetch/workflow) | chưa có |
| Domain `everon.site` | đã đăng ký, file `CNAME` đã có trên `main`, DNS chưa cấu hình |
| Hosting | GitHub Pages, build từ `main` (root) |
| URL tạm | `https://diepxuan.github.io/everon` |
| URL mục tiêu | `https://everon.site` |
| `CHANGELOG.md` / `memory/` | chưa có |

## Phát triển local

```bash
git clone https://github.com/diepxuan/everon.git
cd everon
python3 -m http.server 8000
# Mở http://localhost:8000
```

Lệnh trên thuộc nhóm read-only/preview trong `TOOLS.md`, không cần xin phép.

## Deploy

Hosting: GitHub Pages, build từ `main`. Mỗi task đi theo quy trình:

1. Tạo branch `codex/<task-slug>` từ `main`.
2. Commit + push branch.
3. Mở PR vào `main`.
4. Sếp duyệt → squash-merge `--delete-branch`.

Chi tiết xem `AGENTS.md` §3.

## Liên kết

- Repo: <https://github.com/diepxuan/everon>
- Site tham chiếu: <https://everon.com>
- Bộ instruction agent: `SOUL.md`, `AGENTS.md`, `MEMORY.md`

## Bản quyền

Source code phát hành theo MIT License — xem `LICENSE`.

Nội dung thương hiệu Everon (tên sản phẩm, hình ảnh, bộ sưu tập, giá) thuộc quyền sở hữu của **Công ty Cổ phần Everpia** và hiển thị trên `everon.site` theo thỏa thuận phân phối với **Công ty TNHH Điệp Xuân** — nhà phân phối tại Quảng Bình, Quảng Trị.
