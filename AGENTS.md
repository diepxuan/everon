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
| Chính | [FILL: file HTML/CSS/JS chính] | copy + cấu trúc section |
| Chính | [FILL: file CSS] | token màu/typography, responsive |
| Hạn chế | [FILL: asset thương hiệu — logo, brand, favicon] | chỉ thay khi Sếp duyệt bộ asset mới |
| Hạn chế | `LICENSE`, [FILL: CNAME hoặc file khác] | chỉ Sếp đổi |
| Hạn chế | [FILL: file chứa số liệu pháp lý / nhãn hiệu / văn bằng] | đối chiếu nguồn [FILL: WIPO/IP Việt Nam/mã] |
| Tài liệu | `README.md`, `CHANGELOG.md` | cập nhật khi cấu trúc/cơ chế đổi |

### Quy tắc biên tập nội dung

- Tiếng Việt là ngôn ngữ hiển thị mặc định cho mọi copy người dùng nhìn thấy; thuộc tính `lang="vi"` đã đặt đúng trong `<html>` của [FILL: các file HTML].
- Số liệu [FILL: loại số liệu] phải khớp [FILL: nguồn sự thật]; trước khi đổi, đọc file thật và xác nhận với Sếp.
- Không thêm framework, build step, hay dependencies runtime khi chưa có yêu cầu rõ.
- Token CSS là nguồn sự thật — KHÔNG hardcode giá trị ngoài token ở view mới.

---

## 2. Domain Knowledge

[FILL: kiến thức riêng về dự án — sản phẩm, thương hiệu, đối tượng, các section người dùng nhìn thấy, các file tài liệu quan trọng]

---

## 3. Git Discipline

- Remote: [FILL: git URL]. Hosting build từ `main` (root). Branch tracked duy nhất: `main`; các branch phụ chỉ tạo khi cần cho task cụ thể và dọn sau khi merge/close.
- Mỗi task = 1 branch = 1 PR; KHÔNG commit thẳng lên `main`.
- Không tự push / tạo PR / merge; chỉ khi Sếp nói "push đi" / "Em tạo PR đi".
- Merge PR dùng `gh pr merge <N> --squash --delete-branch`, KHÔNG `git merge` local (trừ khi Sếp nói rõ cherry-pick / gộp branch / rebase local).

---

## 4. Task Completion Cycle

Khi nhận task, phải đi hết vòng đời:

1. **Đọc task + source** — `README.md`, `CHANGELOG.md`, file tương ứng
2. **Audit code** — xác định phần copy/structure/CSS bị ảnh hưởng
3. **Implement** — đúng scope, không tự ý thêm dependency hay build step
4. **Self-review** — preview local, check responsive (mobile + desktop), check in [A4] đối với dossier
5. **Verification** — [FILL: lệnh verify cụ thể của dự án]
6. **Review loop** — fix theo comment
7. **Documentation** — cập nhật `CHANGELOG.md` khi thay đổi release-worthy; cập nhật `README.md` khi cấu trúc/cơ chế đổi; cập nhật `MEMORY.md` khi rút ra bài học
8. **Báo cáo cuối** — bằng chứng cụ thể

### Guard rails

- Nếu thiếu dữ kiện: đọc source trước; nếu vẫn thiếu thì hỏi Sếp
- Khi gặp lỗi: dừng, phân tích nguyên nhân, không vá mù
- KHÔNG tự chạy các lệnh nhóm "Ghi cần xin phép" trong TOOLS.md (`git push`, `gh pr create/merge`, `rm -rf`, network ngoài hosting)
- Definition of Done: diff sạch, preview local pass, link/asset đúng, `CHANGELOG.md` cập nhật (nếu áp dụng)
- Workspace nằm ở [FILL: đường dẫn workspace] — mọi thao tác ghi phải qua cơ chế escalation, xem TOOLS.md

---

## 5. Sub-Agents

- Gọi là **đệ**
- Mô tả rõ: mục tiêu, input, output, giới hạn quyền
- Đệ không được vượt quyền Bột, KHÔNG được tự push hay thay đổi nội dung thương hiệu