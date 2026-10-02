# Long-term Memory

Memory dài hạn cho Bột trên dự án này. Mỗi entry khi có thay đổi cơ chế, sự cố hay bài học đều ghi vào đây. Đọc MEMORY.md trước mọi task lớn để không lặp lại lỗi cũ.

Cập nhật lần cuối: 2026-10-01 — chốt stack kỹ thuật (build-time fetch + JSON tĩnh) + CTA fallback (branch `codex/record-stack-and-contact`).

---

## 0. Quy tắc cố định (không theo task, theo SOUL.md/AGENTS.md/TOOLS.md)

### Dự án

| Thuộc tính | Giá trị | Nguồn |
|---|---|---|
| Tên dự án | `everon.site` | Sếp (turn 2026-10-01) |
| Đơn vị vận hành site | Công ty TNHH Điệp Xuân | Sếp |
| Vai trò Điệp Xuân | **Nhà phân phối** nhãn hiệu Everon tại **Quảng Bình, Quảng Trị** | Sếp (turn 2026-10-01, refine) |
| Chủ sở hữu nhãn hiệu Everon | Công ty Cổ phần Everpia | Công bố trên `everon.com` (bài viết CSR 2026-01-30) |
| Mục tiêu site | **Giới thiệu** nhãn hiệu Everon (chăn ga, gối, đệm, phụ kiện) đến khách hàng tại thị trường Quảng Bình, Quảng Trị | Sếp (turn 2026-10-01, refine) |
| Stack kỹ thuật | **Thuần JS** client + **build-time fetch** `everon.com` → JSON tĩnh (script + GitHub Action định kỳ) | Sếp (turn 2026-10-01, chốt) |
| CTA chính (fallback) | `tel:0363089565` (SĐT cá nhân Sếp Duc Tran) — thay bằng ZaloOA Điệp Xuân khi có | Sếp (turn 2026-10-01, chốt) |
| Brand thành lập | 1999 | `everon.com` (mục "5 lý do chọn Everon") |
| Ngôn ngữ hiển thị | Tiếng Việt (`lang="vi"`) | Persona + SOUL.md §3 |

### Ràng buộc

- **Quan hệ pháp nhân:** **Công ty TNHH Điệp Xuân là nhà phân phối** của nhãn hiệu Everon (thuộc sở hữu Công ty Cổ phần Everpia) **tại Quảng Bình và Quảng Trị**. Không suy luận quan hệ ngoài phạm vi này (công ty mẹ/con, nhượng quyền, đại lý độc quyền, …).
- **Số liệu sản phẩm (tên, giá, mô tả, danh mục, BST) lấy từ `everon.com`** là nguồn sự thật. Không tự sửa, không bịa.
- **Phạm vi site là "giới thiệu".** Site hiển thị nội dung sản phẩm từ `everon.com` để giới thiệu; không đặt hàng / thanh toán trên site.
- **Client JS KHÔNG gọi trực tiếp `everon.com`** vì CORS chặn (không có `Access-Control-Allow-Origin`) + CSP `frame-ancestors 'self'` chặn iframe + không có public JSON API. Vì vậy dùng **build-time fetch**: chạy script server-side (Node hoặc Python) fetch HTML, parse, ghi JSON tĩnh → commit lên repo → client JS đọc JSON local.
- **Build-time fetch vẫn là scraping `everon.com`** — cần Sếp tự chịu trách nhiệm pháp lý hoặc có thoả thuận với Everpia. Em không tự ý chạy script trước khi Sếp xác nhận.
- **Domain `everon.site`**: đã đăng ký, file `CNAME` đã có trên `main` (do Sếp push). Pages URL mặc định là `https://diepxuan.github.io/everon`, khi DNS active sẽ là `https://everon.site`.
- **Hosting mặc định**: GitHub Pages, build từ `main` (root). Có thể chuyển nếu Sếp yêu cầu.
- **CTA hiện dùng SĐT cá nhân Sếp `0363089565`** — đây là fallback tạm thời. Khi có ZaloOA Điệp Xuân, phải thay thế và xoá SĐT cá nhân khỏi UI.

### Remote / branch policy

- Remote: `https://github.com/diepxuan/everon.git`
- Branch tracked chính: `main`
- Branch phụ: tạo khi cần task cụ thể, format `codex/<task-slug>`, dọn sau merge
- Mỗi task = 1 branch = 1 PR; squash-merge + delete-branch khi Sếp duyệt

---

## 1. Nhật ký thay đổi

### Chốt stack kỹ thuật + CTA fallback (2026-10-01)

- Sếp chốt:
  - **Stack**: thuần JS client; JS tự động load sản phẩm từ `everon.com`.
  - **Zalo**: ưu tiên ZaloOA Điệp Xuân; nếu không có thì dùng Zalo cá nhân Sếp `0363089565`.
- Em verify kỹ thuật:
  - `everon.com` không có CORS headers (HTTP 405 cho OPTIONS preflight), CSP `frame-ancestors 'self'` chặn iframe, không có public JSON API → **client JS KHÔNG thể gọi trực tiếp**.
  - Em đề xuất 4 option; Sếp chọn **build-time fetch + JSON tĩnh**.
  - Em hỏi Zalo; Sếp chọn **CTA = gọi điện SĐT `0363089565`** (fallback, không dùng Zalo).
- Branch: `codex/record-stack-and-contact`. Chờ Sếp duyệt push/PR.
- **CHƯA code** — task này chỉ ghi nhận stack + CTA vào meta files. Code (HTML/CSS/JS/script fetch/workflow) tách branch riêng sau khi meta được merge.

### Merge PR #2 — fill project meta (2026-10-01)

- Sếp ra lệnh merge; squash commit: `f74ccc1 docs(meta): fill project meta for everon.site (#2)`.
- Phát hiện trên `main` có thêm commit `13360ab Create CNAME` (file `CNAME` chứa `everon.site`) — Sếp đã push trước/song song. Em không tạo file này.

### Refine quan hệ pháp nhân + khu vực phân phối (2026-10-01)

- Sếp làm rõ:
  - `everon.site` là của Điệp Xuân, **giới thiệu** nhãn hàng Everon (tinh chỉnh từ "bán" → "giới thiệu").
  - Điệp Xuân là **nhà phân phối** của Everon tại **Quảng Bình, Quảng Trị**.
  - `everon.com` thuộc nhãn hàng Everon (= Everpia).
- Cập nhật: `MEMORY.md`, `README.md`, `USER.md`, `AGENTS.md`, `CLAUDE.md`, `IDENTITY.md`. Branch: `codex/fill-project-meta`.

### Lấp project meta cho `everon.site` (2026-10-01)

- Sếp cung cấp brief dự án: tên miền `everon.site`, đơn vị vận hành Công ty TNHH Điệp Xuân, mục tiêu bán nhãn hàng Everon, site là alias của `everon.com` mirror toàn bộ thông tin sản phẩm.
- Em đối chiếu `everon.com`: chủ sở hữu nhãn hiệu là Công ty Cổ phần Everpia → Sếp chọn ghi cả hai với quan hệ rõ ràng.
- Squash commit: `1f9d30e chore: fill project meta for everon.site`.

### Merge PR #1 — bootstrap instruction files (2026-10-01)

- Sếp ra lệnh merge, em chạy `gh pr merge 1 --squash --delete-branch`.
- Squash commit: `564e0ca chore: bootstrap agent instruction files (#1)`.

### Khởi tạo bộ 8 file instruction

- Sếp yêu cầu dựa trên cấu trúc `warmdream` (đã có bộ 8 file instruction hoàn chỉnh) để tạo bộ file tương ứng cho dự án này.
- Template generic, giữ persona Bột dùng chung Portal / dsh-zero-trust / warmdream / warmdream-org.
- 8 file: SOUL.md, USER.md, IDENTITY.md, TOOLS.md, AGENTS.md, MEMORY.md, HEARTBEAT.md, CLAUDE.md.

---

## 2. Tasks done

- 2026-10-01: Tạo branch `codex/bootstrap-instruction-files` + mở PR #1 (squash-merged → `564e0ca`).
- 2026-10-01: Lấp project meta cho `everon.site` (squash commit `1f9d30e`).
- 2026-10-01: Refine quan hệ pháp nhân + khu vực phân phối.
- 2026-10-01: Merge PR #2 (squash → `f74ccc1`).
- 2026-10-01: Chốt stack kỹ thuật (build-time fetch + JSON tĩnh) + CTA fallback (`tel:0363089565`). Branch `codex/record-stack-and-contact` đang chờ review.

---

## 3. Bài học rút ra

- **Luôn đối chiếu nguồn sự thật trước khi ghi thông tin thương hiệu.** `everon.com` công bố Everpia là chủ sở hữu, không phải "Điệp Xuân" như Sếp nói ban đầu. Em không tự sửa mà hỏi Sếp — Sếp xác nhận ghi cả hai với quan hệ rõ ràng.
- **Mục tiêu site có thể refine sau vài turn.** Sếp ban đầu nói "bán nhãn hàng", sau đó refine thành "giới thiệu". Em phải ghi nhận thay đổi và cập nhật đồng bộ các file, không giữ nguyên bản đầu.
- **Domain cần DNS kiểm tra kỹ.** Em không thể truy vấn `everon.site` từ máy (ENOTFOUND) → Sếp xác nhận domain đã đăng ký, cấu hình sau. Tránh giả định domain đang live.
- **Client JS không thể load trực tiếp everon.com vì CORS.** Em phải verify kỹ thuật trước khi nhận task; Sếp đề xuất stack có thể chưa biết giới hạn web. Bài học: luôn test CORS / CSP / API public trước khi chốt stack dựa trên client-side fetch.
- **Có thể có commit Sếp push thẳng lên `main` song song với em.** Em thấy commit `13360ab Create CNAME` xuất hiện trong khi em làm việc trên branch khác. Bài học: luôn `git fetch origin` trước khi tạo branch mới từ `main`.

---

## 4. Backlog / Open questions

- [ ] **Cấu hình DNS/CNAME cho `everon.site`** — Sếp xử lý sau. File `CNAME` đã có trên `main`.
- [ ] **Tạo `CHANGELOG.md`** — file chưa tồn tại, cần format release cho dự án.
- [ ] **Tạo `memory/<ngày>.md`** — chưa có daily log nào.
- [ ] **Build code landing page** (task sau khi meta này merge): `index.html`, `assets/css/main.css`, `assets/js/main.js`, `scripts/fetch-everon.js`, `.github/workflows/fetch-everon.yml`. Sẽ tách branch riêng.
- [ ] **Quyết định ngôn ngữ script fetch**: Python (có sẵn, `requests` + `beautifulsoup4`) hay Node.js (phổ biến hơn trong GitHub Actions). Hỏi Sếp khi bắt đầu code.
- [ ] **ZaloOA Điệp Xuân** — khi có link, thay thế SĐT cá nhân Sếp trong CTA.
- [ ] **Vị trí đề cập "nhà phân phối" trên site** — footer, trang Giới thiệu, hay trang Liên hệ. Chốt khi build layout.
- [ ] **Pháp lý build-time fetch**: Sếp tự chịu trách nhiệm scraping everon.com. Em không tự ý chạy script trước khi Sếp xác nhận thoả thuận với Everpia.
