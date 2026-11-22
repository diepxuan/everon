# Đồng bộ catalog + ảnh tự lưu — everon.site

Thư mục này chứa pipeline đồng bộ chạy bằng GitHub Actions
(`.github/workflows/sync.yml`). Chế độ đã chốt: mở PR để duyệt thủ công,
KHÔNG tự merge.

## Luồng chạy

| Bước | Script | Làm gì |
| --- | --- | --- |
| 1. Scrape | `scrape-full.mjs` | Cập nhật dữ liệu từ everon.com (sitemap + product-variation) → `data/products-bo-chan-ga.full.json` (bản wrapper) |
| 2. Xuất dữ liệu site | `export-site-data.mjs` | Xuất mảng trần `data/products.json` + cập nhật `data/sync-state.json` |
| 3. Ảnh | `images.mjs` | Tải ảnh mới/thay đổi về `assets/img/products/<sku>/*.webp`, ghi `data/image-manifest.json` |
| 4. Validate + safety gate | `validate.mjs` | Kiểm tra schema, đối chiếu manifest, chặn nếu mất >10% catalog hoặc giá = 0 |
| 5. Diff | `diff.mjs` | Tóm tắt thay đổi (giá, trạng thái, biến thể, ảnh gốc) → `data/sync-diff.json` |
| 6. Mở PR | `peter-evans/create-pull-request@v6` | Chỉ mở PR khi có thay đổi thật |

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

- `data/products.json` — mảng trần 189 sản phẩm, giao diện đọc file này.
- `data/image-manifest.json` — manifest ảnh (tự sinh, commit cùng PR).
- `data/sync-state.json` — trạng thái đồng bộ (tổng số, url_lastmod).
- `data/sync-diff.json` — diff lần chạy gần nhất (tự sinh).
- `data/discovery.json`, `data/state.json` — file làm việc của scrape
  (resume + đối chiếu lastmod), commit cùng để lần sau chạy tiếp được.
