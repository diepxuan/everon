# everon.site

Site bán nhãn hàng **Everon** — chăn ga, gối, đệm, phụ kiện.

## Mục tiêu

`everon.site` là tên miền vận hành bởi **Công ty TNHH Điệp Xuân**, dùng để bán nhãn hàng Everon. Nhãn hiệu **Everon** thuộc sở hữu của **Công ty Cổ phần Everpia** (theo công bố trên [everon.com](https://everon.com)).

Site là alias nội dung của [everon.com](https://everon.com): mirror toàn bộ thông tin sản phẩm (tên, mã SKU, giá, mô tả, danh mục, bộ sưu tập) và hiển thị nguyên bản. Mọi thay đổi về sản phẩm, giá, chính sách phải đối chiếu với `everon.com` làm nguồn sự thật.

## Trạng thái

Đang ở giai đoạn bootstrap. Workspace hiện chứa bộ instruction files cho agent **Bột** (persona dùng chung với Portal, dsh-zero-trust, warmdream). Source code sẽ được bổ sung ở các task tiếp theo.

| Hạng mục | Trạng thái |
|---|---|
| Bộ instruction (SOUL/USER/IDENTITY/TOOLS/AGENTS/MEMORY/HEARTBEAT/CLAUDE) | đã có |
| Source code (HTML/CSS/JS) | chưa có |
| Domain `everon.site` | đã đăng ký, DNS/CNAME chưa cấu hình |
| Hosting | GitHub Pages (mặc định), build từ `main` (root) |
| URL tạm | `https://diepxuan.github.io/everon` |
| `CHANGELOG.md` / `memory/` | chưa có |

## Stack kỹ thuật (dự kiến)

Chưa chốt. Theo nguyên tắc persona:

- Ưu tiên HTML/CSS/JS thuần, không framework, không build step khi chưa có yêu cầu rõ.
- Số liệu sản phẩm từ `everon.com` — cơ chế lấy dữ liệu (API / scraping có phép / embed / build-time fetch) sẽ chốt khi bắt đầu code.

## Phát triển local

```bash
git clone https://github.com/diepxuan/everon.git
cd everon
python3 -m http.server 8000
# Mở http://localhost:8000
```

Lệnh trên thuộc nhóm read-only/preview trong `TOOLS.md`, không cần xin phép.

## Deploy

Hosting mặc định: GitHub Pages, build từ `main`. Mỗi task đi theo quy trình:

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

Nội dung thương hiệu Everon (tên sản phẩm, hình ảnh, bộ sưu tập, giá) thuộc quyền sở hữu của **Công ty Cổ phần Everpia** và hiển thị theo thỏa thuận với **Công ty TNHH Điệp Xuân** — đơn vị vận hành site.
