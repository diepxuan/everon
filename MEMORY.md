# Long-term Memory

Memory dài hạn cho Bột trên dự án này. Mỗi entry khi có thay đổi cơ chế, sự cố hay bài học đều ghi vào đây. Đọc MEMORY.md trước mọi task lớn để không lặp lại lỗi cũ.

Cập nhật lần cuối: 2026-10-01 — lấp project meta cho `everon.site` (branch `codex/fill-project-meta`).

---

## 0. Quy tắc cố định (không theo task, theo SOUL.md/AGENTS.md/TOOLS.md)

### Dự án

| Thuộc tính | Giá trị | Nguồn |
|---|---|---|
| Tên dự án | `everon.site` | Sếp (turn 2026-10-01) |
| Đơn vị vận hành site | Công ty TNHH Điệp Xuân | Sếp |
| Chủ sở hữu nhãn hiệu Everon | Công ty Cổ phần Everpia | Công bố trên `everon.com` (bài viết CSR 2026-01-30) |
| Mục tiêu | Bán nhãn hàng Everon (chăn ga, gối, đệm, phụ kiện) | Sếp |
| Phạm vi kỹ thuật | Mirror nội dung sản phẩm từ `everon.com` — hiển thị nguyên bản, không tự scraping | Sếp |
| Brand thành lập | 1999 | `everon.com` (mục "5 lý do chọn Everon") |
| Ngôn ngữ hiển thị | Tiếng Việt (`lang="vi"`) | Persona + SOUL.md §3 |

### Ràng buộc

- **KHÔNG tự ý thay đổi thông tin pháp nhân.** Quan hệ "Điệp Xuân — Everpia" chỉ ghi theo dạng: Điệp Xuân vận hành site, Everpia sở hữu nhãn hiệu. Không suy luận quan hệ công ty mẹ/con/đối tác khi Sếp chưa xác nhận.
- **Số liệu sản phẩm (tên, giá, mô tả, danh mục, BST) lấy từ `everon.com`** là nguồn sự thật. Không tự sửa, không bịa.
- **Domain `everon.site`**: đã đăng ký, DNS/CNAME sẽ cấu hình sau. Trong thời gian chờ, Pages URL mặc định là `https://diepxuan.github.io/everon`.
- **Hosting mặc định**: GitHub Pages, build từ `main` (root). Có thể chuyển nếu Sếp yêu cầu.

### Remote / branch policy

- Remote: `https://github.com/diepxuan/everon.git`
- Branch tracked chính: `main`
- Branch phụ: tạo khi cần task cụ thể, format `codex/<task-slug>`, dọn sau merge
- Mỗi task = 1 branch = 1 PR; squash-merge + delete-branch khi Sếp duyệt

---

## 1. Nhật ký thay đổi

### Lấp project meta cho `everon.site` (2026-10-01)

- Sếp cung cấp brief dự án: tên miền `everon.site`, đơn vị vận hành Công ty TNHH Điệp Xuân, mục tiêu bán nhãn hàng Everon, site là alias của `everon.com` mirror toàn bộ thông tin sản phẩm.
- Em đối chiếu `everon.com`: chủ sở hữu nhãn hiệu là Công ty Cổ phần Everpia → Sếp chọn ghi cả hai với quan hệ rõ ràng (Điệp Xuân vận hành site, Everpia sở hữu nhãn hiệu).
- `everon.site` đã đăng ký, DNS/CNAME cấu hình sau.
- Phạm vi: mirror nội dung, hiển thị nguyên bản từ `everon.com`, không tự scraping.
- Cập nhật: `MEMORY.md`, `README.md`, `IDENTITY.md`, `TOOLS.md`, `USER.md`, `AGENTS.md`. Branch: `codex/fill-project-meta`.

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
- 2026-10-01: Lấp project meta cho `everon.site` (branch `codex/fill-project-meta`, đang chờ review).

---

## 3. Bài học rút ra

- **Luôn đối chiếu nguồn sự thật trước khi ghi thông tin thương hiệu.** `everon.com` công bố Everpia là chủ sở hữu, không phải "Điệp Xuân" như Sếp nói ban đầu. Em không tự sửa mà hỏi Sếp — Sếp xác nhận ghi cả hai với quan hệ rõ ràng.
- **Domain cần DNS kiểm tra kỹ.** Em không thể truy vấn `everon.site` từ máy (ENOTFOUND) → Sếp xác nhận domain đã đăng ký, cấu hình sau. Tránh giả định domain đang live.

---

## 4. Backlog / Open questions

- [ ] **Cấu hình DNS/CNAME cho `everon.site`** — Sếp xử lý sau.
- [ ] **Chốt stack kỹ thuật** — chưa quyết mirror bằng cách nào (API everon.com, scraping có phép, embed iframe, build-time fetch). Cần Sếp cho hướng.
- [ ] **Tạo `CHANGELOG.md`** — file chưa tồn tại, cần format release cho dự án.
- [ ] **Tạo `memory/<ngày>.md`** — chưa có daily log nào.
- [ ] **Code Scope (HTML/CSS/JS chính, asset thương hiệu)** — phụ thuộc stack, sẽ lấp sau khi chốt kiến trúc.
- [ ] **Quan hệ pháp lý Điệp Xuân ↔ Everpia** — Sếp chưa cung cấp (công ty mẹ/con, đối tác phân phối, nhượng quyền, …). Nếu cần đưa vào site, hỏi thêm.
