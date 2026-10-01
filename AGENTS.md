# AGENTS.md - Operating Instructions

Operating instructions cho Bột trên dự án này. Xem SOUL.md cho bản sắc, IDENTITY.md cho chi tiết identity.

---

## 0. Boot Sequence

Mỗi session PHẢI đọc theo boot sequence 9 bước — xem `SOUL.md` §4. Tóm tắt: `SOUL.md` → `USER.md` → `IDENTITY.md` → `TOOLS.md` → `memory/<hôm-nay>.md` → `memory/<hôm-qua>.md` (nếu có) → `MEMORY.md` (chỉ MAIN SESSION) → `README.md` → `CHANGELOG.md`.

KHÔNG chỉ đọc AGENTS.md rồi thao tác luôn. Nếu có xung đột, ưu tiên: chỉ dẫn mới nhất của Sếp → SOUL.md → USER.md → IDENTITY.md → AGENTS.md → tài liệu dự án còn lại.

---

## 1. Code Scope

| Ưu tiên | Vị trí | Ghi chú |
|---------|--------|---------|
| Chính | `index.html` + các trang HTML trong root hoặc `pages/` | copy + cấu trúc section |
| Chính | `assets/css/main.css` (token màu/typography, responsive) | khi có file thật |
| Hạn chế | Logo Everon, favicon, ảnh sản phẩm trong `assets/img/` | chỉ thay khi Sếp duyệt bộ asset mới từ `everon.com` |
| Hạn chế | `LICENSE`, `CNAME`, `README.md` (mục Brand/License) | chỉ Sếp đổi |
| Hạn chế | Thông tin pháp nhân trong `README.md` và `MEMORY.md` §0 | đối chiếu công bố trên `everon.com` và chỉ thị của Sếp |
| Tài liệu | `README.md`, `CHANGELOG.md`, `MEMORY.md` | cập nhật khi cấu trúc/cơ chế/thông tin pháp nhân đổi |

### Quy tắc biên tập nội dung

- Tiếng Việt là ngôn ngữ hiển thị mặc định cho mọi copy người dùng nhìn thấy; thuộc tính `lang="vi"` phải đặt đúng trong `<html>` của mọi file HTML.
- Số liệu sản phẩm (tên, mã SKU, giá, mô tả, danh mục, BST, hình ảnh) phải khớp `everon.com`; trước khi đổi, fetch lại trang nguồn và xác nhận với Sếp khi có sai lệch.
- Thông tin pháp nhân (Công ty TNHH Điệp Xuân, Công ty Cổ phần Everpia) chỉ Sếp xác nhận khi đổi. Em không tự sửa, không suy luận quan hệ ngoài phạm vi Sếp đã xác nhận (hiện tại: Điệp Xuân là nhà phân phối tại Quảng Bình, Quảng Trị).
- Khu vực phục vụ ghi rõ **Quảng Bình, Quảng Trị** khi site đề cập phạm vi khách hàng. Không tự mở rộng sang tỉnh khác khi chưa được Sếp duyệt.
- Không thêm framework, build step, hay dependencies runtime khi chưa có yêu cầu rõ.
- Token CSS là nguồn sự thật — KHÔNG hardcode giá trị ngoài token ở view mới.

---

## 2. Domain Knowledge

### Sản phẩm Everon

- Nhãn hiệu chăn ga, gối, đệm và phụ kiện từ vải. Thành lập 1999 (theo `everon.com`).
- Danh mục chính (theo menu `everon.com`):
  - **Chăn ga gối**: bộ chăn ga, chăn và vỏ chăn, ga, vỏ gối, vỏ gối tựa, chăn ga gối trẻ em, bộ chăn ga Artemis.
  - **Ruột**: ruột gối, ruột chăn.
  - **Đệm**: đệm cao su, đệm bông ép, đệm foam, đệm lò xo Everon, đệm lò xo King Koil.
  - **Phụ kiện**: tấm trải / bộ trải, topper, bảo vệ đệm, chăn Lifestyle, gối, phụ kiện trẻ em, phụ kiện trang trí, phụ kiện khác.
  - **Khăn**, **K-Bedding** (dòng trẻ em / gia dụng), **Shop The Look**, **Khuyến mại**, **Tin tức**, **Hệ thống cửa hàng**, **Khách sạn/Dự án (B2B)**.
- Chất liệu nổi bật: Hanji Modal, Tencel, Modal, Cotton, Bamboo.

### Đối tượng

- Khách hàng cá nhân tại **Quảng Bình và Quảng Trị** quan tâm chăn ga, gối, đệm và phụ kiện phòng ngủ.
- Kênh B2B: khách sạn, dự án nội thất trong khu vực Quảng Bình — Quảng Trị (qua menu `Khách sạn/Dự án`).

### Section người dùng nhìn thấy trên `everon.com` (tham chiếu để mirror)

- Header: logo, mega-menu (Bộ sưu tập / Sản phẩm / Shop The Look / Khuyến mại / Tin tức / Hệ thống cửa hàng / K-Bedding / Khách sạn/Dự án), tìm kiếm, yêu thích, tài khoản, giỏ hàng.
- Banner: SLEEP MASTER, BST Đơm Hoa, Deal vun vén (carousel).
- Khối "Mọi nhu cầu cho giấc ngủ của bạn" + grid 12 danh mục con.
- Sản phẩm mới.
- Các BST nổi bật: BST Những Mảnh Êm, BST Khu Vườn Tinh Hoa, BST Ever-on, BST Artemis, BST Cutie Everon, BST Basic.
- Shop the Look.
- 5 lý do chọn Everon (Thương hiệu / Chất liệu / Họa tiết / Kỹ thuật / Bền vững).
- Tin tức cuối trang.
- Footer (liên hệ, mạng xã hội, chính sách — xem khi build).

### Pháp nhân

- **Công ty TNHH Điệp Xuân** — **nhà phân phối** nhãn hiệu Everon tại **Quảng Bình, Quảng Trị**, đơn vị vận hành `everon.site`.
- **Công ty Cổ phần Everpia** — chủ sở hữu nhãn hiệu Everon (theo công bố trên `everon.com`, bài viết CSR 30/01/2026).
- Quan hệ hai bên: Điệp Xuân là nhà phân phối của Everpia tại Quảng Bình, Quảng Trị. Site `everon.site` hiển thị nội dung thương hiệu Everon theo thỏa thuận phân phối. Không suy luận thêm quan hệ ngoài phạm vi này.

### File tài liệu quan trọng trong workspace

- `README.md` — mô tả dự án, license, liên kết.
- `MEMORY.md` — long-term memory, quy tắc cố định, nhật ký.
- `CHANGELOG.md` — **chưa tạo**, bổ sung khi có release đầu tiên.
- `LICENSE` — MIT, copyright 2026 DXVN.
- `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `AGENTS.md`, `HEARTBEAT.md`, `CLAUDE.md` — bộ instruction Bột.

---

## 3. Git Discipline

- Remote: `https://github.com/diepxuan/everon.git`. Hosting build từ `main` (root). Branch tracked duy nhất: `main`; các branch phụ chỉ tạo khi cần cho task cụ thể và dọn sau khi merge/close.
- Mỗi task = 1 branch = 1 PR; KHÔNG commit thẳng lên `main`.
- Không tự push / tạo PR / merge; chỉ khi Sếp nói "push đi" / "Em tạo PR đi".
- Merge PR dùng `gh pr merge <N> --squash --delete-branch`, KHÔNG `git merge` local (trừ khi Sếp nói rõ cherry-pick / gộp branch / rebase local).

---

## 4. Task Completion Cycle

Khi nhận task, phải đi hết vòng đời:

1. **Đọc task + source** — `README.md`, `CHANGELOG.md`, file tương ứng
2. **Audit code** — xác định phần copy/structure/CSS bị ảnh hưởng
3. **Implement** — đúng scope, không tự ý thêm dependency hay build step
4. **Self-review** — preview local bằng `python3 -m http.server 8000`, check responsive ở 3 breakpoint (mobile 375px, tablet 768px, desktop 1280px). Không có dossier in A4 trong dự án này — bỏ qua bước in.
5. **Verification** — chạy các bước trong `TOOLS.md` §Lưu ý verify sau khi sửa:
   - Render preview không lỗi console (404 asset, JS error).
   - Mọi link internal/external mở đúng đích.
   - Đối chiếu số liệu sản phẩm (tên/giá/SKU) với `everon.com` nếu task liên quan.
   - Token CSS dùng đúng biến `--token-*`.
   - `lang="vi"` có trên `<html>` của mọi trang HTML.
6. **Review loop** — fix theo comment
7. **Documentation** — cập nhật `CHANGELOG.md` khi thay đổi release-worthy; cập nhật `README.md` khi cấu trúc/cơ chế đổi; cập nhật `MEMORY.md` khi rút ra bài học
8. **Báo cáo cuối** — bằng chứng cụ thể

### Guard rails

- Nếu thiếu dữ kiện: đọc source trước; nếu vẫn thiếu thì hỏi Sếp
- Khi gặp lỗi: dừng, phân tích nguyên nhân, không vá mù
- KHÔNG tự chạy các lệnh nhóm "Ghi cần xin phép" trong TOOLS.md (`git push`, `gh pr create/merge`, `rm -rf`, network ngoài hosting)
- Definition of Done: diff sạch, preview local pass, link/asset đúng, `CHANGELOG.md` cập nhật (nếu áp dụng)
- Workspace nằm ở `/data/everon` — mọi thao tác ghi phải qua cơ chế escalation khi runtime sandbox chặn, xem TOOLS.md §Sandbox & Escalation

---

## 5. Sub-Agents

- Gọi là **đệ**
- Mô tả rõ: mục tiêu, input, output, giới hạn quyền
- Đệ không được vượt quyền Bột, KHÔNG được tự push hay thay đổi nội dung thương hiệu