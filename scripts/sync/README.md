# Đồng bộ catalog + ảnh tự lưu — everon.site

Thư mục này chứa pipeline đồng bộ chạy bằng GitHub Actions
(`.github/workflows/sync.yml`). Chế độ đã chốt: mở PR để duyệt thủ công,
KHÔNG tự merge.

## Luồng chạy

| Bước | Script | Làm gì |
| --- | --- | --- |
| 1. Scrape | `scrape-full.mjs` | Tăng dần thật sự theo sitemap lastmod: chỉ cào lại URL mới/đổi, giữ lại phần còn lại từ `data/products.json`. `--full` (Chủ nhật / chạy tay) thì cào toàn bộ. Ghi bản wrapper ra `data/products-bo-chan-ga.full.json` (chỉ dùng trong lần chạy) |
| 2. Xuất dữ liệu site | `export-site-data.mjs` | Xuất mảng trần `data/products.json` + cập nhật `data/sync-state.json` (gộp lastmod mới từ discovery) |
| 3. Ảnh | `images.mjs` | Tải ảnh mới/thay đổi về `assets/img/products/<sku>/*.webp`, ghi `data/image-manifest.json` |
| 4. Validate + safety gate | `validate.mjs` | Kiểm tra schema, đối chiếu manifest, chặn nếu mất >10% catalog hoặc giá = 0 |
| 5. Diff | `diff.mjs` | Tóm tắt thay đổi (giá, trạng thái, biến thể, ảnh gốc) → `data/sync-diff.json` (chỉ dùng để soạn mô tả PR, không commit) |
| 6. Dọn file trung gian | (bước trong workflow) | Xóa `products-bo-chan-ga.full.json(.jsonl)`, `state.json`, `run-stats.json`, `discovery.json`, `sync-diff.json` trước khi tạo PR |
| 7. Mở PR | `peter-evans/create-pull-request@v6` | Chỉ mở PR khi có thay đổi thật. PR chỉ gồm `products.json`, `sync-state.json`, `image-manifest.json` và ảnh |

## Ảnh tự lưu

- Đường dẫn ảnh đã có sẵn trong dữ liệu: mỗi media entry có trường `src`
  (vd: `assets/img/products/cpm27202/cover.webp`) do scrape sinh ra.
  `images.mjs` chỉ tải file về đúng đường dẫn đó — **không thêm trường
  `local_path` mới** (trường đó đã tồn tại dưới tên `src` theo phương án).
- Chỉ tải ảnh mới/thay đổi: `data/image-manifest.json` ghi
  `source_url → local_path + sha256`. Ảnh đã có trong manifest và file
  còn trên đĩa thì bỏ qua. `--force` để tải lại toàn bộ.
- Chuyển sang WebP bằng **ffmpeg (libwebp)**, chất lượng 80, song song 5 ảnh,
  timeout 30s/ảnh, thử lại 2 lần. Chuyển đổi thất bại với 1 ảnh: giữ nguyên
  định dạng gốc (.jpg/.png), cập nhật lại `src` trong `products.json`, ghi
  cảnh báo — không dừng cả đợt. Tải lỗi >10% ảnh thì fail toàn bộ.
- Giao diện dùng ảnh tự lưu trước; lỗi thì tự đổi sang `source_url`
  (xem `assets/js/app.js`: `imgHTML` / `onImgError` / `bindImageFallbacks`),
  lỗi cả hai thì ẩn ảnh.
- Quy mô: 400 ảnh / 189 sản phẩm, tổng ~9 MB WebP (đo mẫu 60 ảnh:
  trung bình 22,5 KB/ảnh, lớn nhất 62 KB; nhỏ hơn ~64% so với JPG gốc).
  Lần chạy đầu tải toàn bộ (~70 giây); các lần sau chỉ tải ảnh mới.

## Lịch chạy

- Hằng ngày **03:00 giờ Việt Nam** (`0 20 * * *` UTC).
- **Chủ nhật** (giờ Việt Nam) quét **toàn bộ**; các ngày khác quét tăng dần
  theo lastmod. Lưu ý: 03:00 +07 Chủ nhật = 20:00 UTC Thứ bảy, nên workflow
  tự tính thứ theo múi giờ `Asia/Ho_Chi_Minh`, không dùng giờ UTC.
- Chạy tay: Actions → Sync catalog → Run workflow, tick `full_scan`
  nếu muốn quét toàn bộ.

## Chạy tay trên máy (local)

```bash
# Cần ffmpeg có libwebp: Ubuntu `sudo apt-get install -y ffmpeg`, macOS `brew install ffmpeg`
node scripts/sync/scrape-full.mjs --limit 5 --out data/test.json
node scripts/sync/export-site-data.mjs --full data/test.json --out data/test-products.json --state data/test-sync-state.json
node scripts/sync/images.mjs --products data/test-products.json --manifest data/test-manifest.json
node scripts/sync/validate.mjs data/test-products.json --manifest data/test-manifest.json
node scripts/sync/diff.mjs data/products.json data/test-products.json
```

## File dữ liệu liên quan

Giữ lại trên repo (cần cho lần chạy sau hoặc giao diện đọc):

- `data/products.json` — mảng trần 189 sản phẩm, giao diện đọc file này; đồng thời là nguồn giữ lại sản phẩm không đổi trong lần chạy tăng dần.
- `data/image-manifest.json` — manifest ảnh (tự sinh, commit cùng PR). Thiếu file này thì lần sau phải tải lại toàn bộ ~400 ảnh.
- `data/sync-state.json` — trạng thái đồng bộ (tổng số, `url_lastmod` cho 755 URL sitemap). Đây là khóa của cơ chế tăng dần: scraper so lastmod mới với lastmod đã lưu ở đây.

Chỉ dùng trong lần chạy, KHÔNG commit (workflow xóa trước bước tạo PR):

- `data/products-bo-chan-ga.full.json` — bản wrapper do scraper ghi, `export-site-data.mjs` đọc để xuất `products.json`.
- `data/products-bo-chan-ga.full.jsonl` — checkpoint từng dòng (phục vụ `--resume` khi chạy tay).
- `data/state.json` — checkpoint của scraper (`{updated_at, count, products}`); nội dung `products` trùng y hệt bản wrapper nên là bản sao thừa, chỉ phục vụ `--resume` khi chạy tay.
- `data/discovery.json` — kết quả discovery lần này (URL + `lastmod_by_url`); `export-site-data.mjs` đã gộp lastmod vào `sync-state.json` trước khi xóa.
- `data/run-stats.json` — báo cáo lần chạy (không script nào đọc lại).
- `data/sync-diff.json` — diff lần chạy này, chỉ dùng để soạn mô tả PR.

## Tăng dần theo lastmod (sửa 23/11/2026)

- Sitemap của everon.com CÓ `<lastmod>` cho mọi URL (đã kiểm chứng trực tiếp ngày 23/11/2026: 1543/1543 URL có lastmod), nhưng regex cũ trong `discover()` chỉ bắt `<lastmod>` khi nó đứng ngay sau `</loc>`, trong khi thứ tự thật là `<loc> → <priority> → <lastmod>`. Hậu quả: `lastmod_by_url` lưu toàn `null`, và code cũ cũng không hề so sánh lastmod — chế độ `--resume` chỉ nạp lại `state.json` rồi bỏ qua mọi URL đã có, nên lần chạy ngày thường thực chất viết lại dữ liệu cũ (giá mới không bao giờ được cập nhật; giá giảm 15% trong PR #8 chỉ xuất hiện vì lần đó chạy full do chưa có `discovery.json` trên main). Đã sửa regex (đọc theo từng khối `<url>`) và triển khai so sánh thật: URL mới, URL thiếu tín hiệu lastmod ở một trong hai bên, hoặc URL đổi lastmod thì cào lại; còn lại giữ nguyên từ `products.json`.
- Lần chạy đầu tiên sau PR dọn dẹp này sẽ cào lại toàn bộ 189 sản phẩm (vì lastmod đang lưu trên main đều `null`); từ lần sau trở đi mới tăng dần thật sự. Chủ nhật vẫn quét toàn bộ (`--full`) để bắt mọi thay đổi mà lastmod bỏ sót (vd: everon.com đổi giá mà không cập nhật lastmod).
