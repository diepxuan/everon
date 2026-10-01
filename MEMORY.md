# Long-term Memory

Memory dài hạn cho Bột trên dự án này. Mỗi entry khi có thay đổi cơ chế, sự cố hay bài học đều ghi vào đây. Đọc MEMORY.md trước mọi task lớn để không lặp lại lỗi cũ.

Cập nhật lần cuối: 2026-10-01 — refine quan hệ pháp nhân + khu vực phân phối (branch `codex/fill-project-meta`).

---

## 0. Quy tắc cố định (không theo task, theo SOUL.md/AGENTS.md/TOOLS.md)

### Dự án

| Thuộc tính | Giá trị | Nguồn |
|---|---|---|
| Tên dự án | `everon.site` | Sếp (turn 2026-10-01) |
| Đơn vị vận hành site | Công ty TNHH Điệp Xuân | Sếp |
| Vai trò Điệp Xuân | **Nhà phân phối** nhãn hàng Everon tại **Quảng Bình, Quảng Trị** | Sếp (turn 2026-10-01, refine) |
| Chủ sở hữu nhãn hiệu Everon | Công ty Cổ phần Everpia | Công bố trên `everon.com` (bài viết CSR 2026-01-30) |
| Mục tiêu site | **Giới thiệu** nhãn hàng Everon (chăn ga, gối, đệm, phụ kiện) đến khách hàng tại thị trường Quảng Bình, Quảng Trị | Sếp (turn 2026-10-01, refine) |
| Phạm vi kỹ thuật | Mirror nội dung sản phẩm từ `everon.com` — hiển thị nguyên bản, không tự scraping | Sếp |
| Brand thành lập | 1999 | `everon.com` (mục "5 lý do chọn Everon") |
| Ngôn ngữ hiển thị | Tiếng Việt (`lang="vi"`) | Persona + SOUL.md §3 |

### Ràng buộc

- **Quan hệ pháp nhân:** **Công ty TNHH Điệp Xuân là nhà phân phối** của nhãn hàng Everon (thuộc sở hữu Công ty Cổ phần Everpia) **tại Quảng Bình và Quảng Trị**. Không suy luận quan hệ ngoài phạm vi này (công ty mẹ/con, nhượng quyền, đại lý độc quyền, …).
- **Số liệu sản phẩm (tên, giá, mô tả, danh mục, BST) lấy từ `everon.com`** là nguồn sự thật. Không tự sửa, không bịa.
- **Phạm vi site là "giới thiệu".** Site mirror thông tin sản phẩm từ `everon.com` để giới thiệu; kênh mua hàng hiện chuyển về `everon.com` hoặc qua Điệp Xuân tại Quảng Bình — Quảng Trị (sẽ xác nhận lại với Sếp khi thiết kế CTA/footer).
- **Domain `everon.site`**: đã đăng ký, DNS/CNAME sẽ cấu hình sau. Trong thời gian chờ, Pages URL mặc định là `https://diepxuan.github.io/everon`.
- **Hosting mặc định**: GitHub Pages, build từ `main` (root). Có thể chuyển nếu Sếp yêu cầu.

### Remote / branch policy

- Remote: `https://github.com/diepxuan/everon.git`
- Branch tracked chính: `main`
- Branch phụ: tạo khi cần task cụ thể, format `codex/<task-slug>`, dọn sau merge
- Mỗi task = 1 branch = 1 PR; squash-merge + delete-branch khi Sếp duyệt

---

## 1. Nhật ký thay đổi

### Refine quan hệ pháp nhân + khu vực phân phối (2026-10-01)

- Sếp làm rõ:
  - `everon.site` là của Điệp Xuân, **giới thiệu** nhãn hàng Everon (tinh chỉnh từ "bán" → "giới thiệu").
  - Điệp Xuân là **nhà phân phối** của Everon tại **Quảng Bình, Quảng Trị**.
  - `everon.com` thuộc nhãn hàng Everon (= Everpia).
- Cập nhật: `MEMORY.md`, `README.md`, `USER.md`, `AGENTS.md`, `CLAUDE.md`. Branch: `codex/fill-project-meta`.

### Lấp project meta cho `everon.site` (2026-10-01)

- Sếp cung cấp brief dự án: tên miền `everon.site`, đơn vị vận hành Công ty TNHH Điệp Xuân, mục tiêu bán nhãn hàng Everon, site là alias của `everon.com` mirror toàn bộ thông tin sản phẩm.
- Em đối chiếu `everon.com`: chủ sở hữu nhãn hiệu là Công ty Cổ phần Everpia → Sếp chọn ghi cả hai với quan hệ rõ ràng (Điệp Xuân vận hành site, Everpia sở hữu nhãn hiệu).
- `everon.site` đã đăng ký, DNS/CNAME cấu hình sau.
- Phạm vi: mirror nội dung, hiển thị nguyên bản từ `everon.com`, không tự scraping.
- Cập nhật: `MEMORY.md`, `README.md`, `IDENTITY.md`, `TOOLS.md`, `USER.md`, `AGENTS.md`. Branch: `codex/fill-project-meta`.
- Squash commit: `1f9d30e chore: fill project meta for everon.site`.

### Merge PR #1 — bootstrap instruction files (2026-10-01)

- Sếp ra lệnh merge, em chạy `gh pr merge 1 --squash --delete-branch`.
- Squash commit: `564e0ca chore: bootstrap agent instruction files (#1)`.
- Branch `codex/bootstrap-instruction-files` đã xoá trên origin.

### Khởi tạo bộ 8 file instruction

- Sếp yêu cầu dựa trên cấu trúc `warmdream` (đã có bộ 8 file instruction hoàn chỉnh) để tạo bộ file tương ứng cho dự án này.
- Template generic, giữ persona Bột dùng chung Portal / dsh-zero-trust / warmdream / warmdream-org.
- Phần project-specific đặt placeholder `[FILL: ...]` để Sếp hoặc agent riêng từng dự án bổ sung sau.
- 8 file: SOUL.md, USER.md, IDENTITY.md, TOOLS.md, AGENTS.md, MEMORY.md, HEARTBEAT.md, CLAUDE.md.

---

## 2. Tasks done

- 2026-10-01: Tạo branch `codex/bootstrap-instruction-files` + mở PR #1 (squash-merged → `564e0ca`).
- 2026-10-01: Lấp project meta cho `everon.site` (squash commit `1f9d30e`, branch `codex/fill-project-meta` đang chờ review).
- 2026-10-01: Refine quan hệ pháp nhân + khu vực phân phối (cùng branch `codex/fill-project-meta`, đang chờ review).

---

## 3. Bài học rút ra

- **Luôn đối chiếu nguồn sự thật trước khi ghi thông tin thương hiệu.** `everon.com` công bố Everpia là chủ sở hữu, không phải "Điệp Xuân" như Sếp nói ban đầu. Em không tự sửa mà hỏi Sếp — Sếp xác nhận ghi cả hai với quan hệ rõ ràng.
- **Mục tiêu site có thể refine sau vài turn.** Sếp ban đầu nói "bán nhãn hàng", sau đó refine thành "giới thiệu". Em phải ghi nhận thay đổi và cập nhật đồng bộ các file, không giữ nguyên bản đầu.
- **Domain cần DNS kiểm tra kỹ.** Em không thể truy vấn `everon.site` từ máy (ENOTFOUND) → Sếp xác nhận domain đã đăng ký, cấu hình sau. Tránh giả định domain đang live.

---

## 4. Backlog / Open questions

- [ ] **Cấu hình DNS/CNAME cho `everon.site`** — Sếp xử lý sau.
- [ ] **Chốt stack kỹ thuật** — chưa quyết mirror bằng cách nào (API everon.com, scraping có phép, embed iframe, build-time fetch). Cần Sếp cho hướng.
- [ ] **Tạo `CHANGELOG.md`** — file chưa tồn tại, cần format release cho dự án.
- [ ] **Tạo `memory/<ngày>.md`** — chưa có daily log nào.
- [ ] **Code Scope (HTML/CSS/JS chính, asset thương hiệu)** — phụ thuộc stack, sẽ lấp sau khi chốt kiến trúc.
- [ ] **CTA / kênh mua hàng** — site chỉ giới thiệu; cần xác nhận CTA (nút "Mua hàng" đi đâu: everon.com, Zalo/SĐT Điệp Xuân, form liên hệ).
- [ ] **Thông tin liên hệ Điệp Xuân** — địa chỉ văn phòng / cửa hàng tại Quảng Bình, Quảng Trị, SĐT, email. Hiển thị ở đâu trên site (footer, trang Liên hệ).
- [ ] **Hợp đồng phân phối** — Sếp có cần đề cập "Điệp Xuân là nhà phân phối chính thức tại Quảng Bình — Quảng Trị" trên site không (yêu cầu xác nhận quyền dùng nhãn hiệu từ Everpia).
