# everon.site

Site **giới thiệu** nhãn hàng **Everon** — chăn ga, gối, đệm, phụ kiện — tại thị trường Quảng Bình, Quảng Trị.

## Mục tiêu

`everon.site` là kênh giới thiệu nhãn hàng Everon do **Công ty TNHH Điệp Xuân** — nhà phân phối Everon tại **Quảng Bình và Quảng Trị** — vận hành. Site mirror nội dung sản phẩm từ [everon.com](https://everon.com) (thuộc sở hữu **Công ty Cổ phần Everpia**), giúp khách hàng trong khu vực tham khảo catalog đầy đủ.

Phạm vi hiện tại là **giới thiệu**, không phải bán hàng trực tiếp. Kênh mua hàng sẽ chuyển về `everon.com` hoặc qua Điệp Xuân (sẽ xác nhận CTA với Sếp ở task sau).

Site là alias nội dung của [everon.com](https://everon.com): mirror thông tin sản phẩm (tên, mã SKU, giá, mô tả, danh mục, bộ sưu tập) và hiển thị nguyên bản. Mọi thay đổi về sản phẩm, giá, chính sách phải đối chiếu với `everon.com` làm nguồn sự thật.

## Quan hệ thương hiệu

| Bên | Vai trò |
|---|---|
| **Công ty Cổ phần Everpia** | Chủ sở hữu nhãn hiệu **Everon** (theo công bố trên `everon.com`) |
| **Công ty TNHH Điệp Xuân** | Nhà phân phối nhãn hiệu Everon tại Quảng Bình, Quảng Trị — đơn vị vận hành `everon.site` |
| **everon.com** | Site chính thức của nhãn hàng Everon (thuộc Everpia) |
| **everon.site** | Site giới thiệu của nhà phân phối Điệp Xuân |

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

Nội dung thương hiệu Everon (tên sản phẩm, hình ảnh, bộ sưu tập, giá) thuộc quyền sở hữu của **Công ty Cổ phần Everpia** và hiển thị trên `everon.site` theo thỏa thuận phân phối với **Công ty TNHH Điệp Xuân** — nhà phân phối tại Quảng Bình, Quảng Trị.
