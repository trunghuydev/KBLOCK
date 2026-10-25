# KBlock — README

<div align="center">

🛡️ **KBlock** — Trình chặn quảng cáo Safari miễn phí, mã nguồn mở cho iOS

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
[![Version: 0.2.0](https://img.shields.io/badge/Version-0.2.0-blue)]()
[![Platform: iOS 15+](https://img.shields.io/badge/Platform-iOS%2015%2B-blue)]()

</div>

---

## Giới thiệu

**KBlock** là ứng dụng iOS chặn quảng cáo cho Safari, hoàn toàn miễn phí và mã nguồn mở. Ứng dụng sử dụng Safari Web Extension để chặn quảng cáo, tracker, popup và redirect — đặc biệt trên website Việt Nam.

### Cam kết

- ✅ Hoàn toàn miễn phí. Không có phiên bản Pro, không thuê bao.
- ✅ Mã nguồn mở (MPL-2.0).
- ✅ Không thu thập lịch sử duyệt web.
- ✅ Không yêu cầu tạo tài khoản.
- ✅ Không có quảng cáo trong ứng dụng.
- ✅ Cho phép tùy chỉnh bộ lọc và whitelist.

---

## Trạng thái dự án

> 🚧 **Đang phát triển — PoC đã chạy, đang hoàn thiện tính năng**

| Giai đoạn | Tên | Trạng thái |
|-----------|-----|-----------|
| 0 | Khảo sát & Kế hoạch | ✅ Hoàn thành |
| 1 | Proof of Concept (iOS + Extension) | ✅ Hoàn thành |
| 2 | Filter Engine | 🟢 Pipeline tải ABPVN/EasyList/EasyPrivacy → ~107K quy tắc DNR hoạt động |
| 3 | Bộ lọc cộng đồng | 🟡 3 nguồn chính đã nối, mở rộng thêm nguồn |
| 4 | Popup & Redirect | 🟢 Anti-popup + anti-tracking + cookie banner + element picker |
| 5 | Giao diện SwiftUI | 🟡 Core xong (bộ lọc, whitelist, tùy chỉnh, nhật ký) + Widget |
| 6 | Cập nhật & Rollback | 🟡 Pipeline build-time xong, runtime update đang làm |
| 7 | Bảo mật & Quyền riêng tư | 🟡 100% on-device |
| 8 | Build, Ký & SideStore | 🟡 XcodeGen + hướng dẫn xong |
| 9 | Beta & Phát hành | ⬜ Chưa bắt đầu |

---

## Kiến trúc

KBlock bao gồm:
- **1 ứng dụng iOS** (SwiftUI, container app)
- **1 Safari Web Extension** (TypeScript + Manifest V3)

Hai bên đồng bộ qua **App Group + native messaging** (`SafariWebExtensionHandler`): app là nguồn chân lý cho cấu hình (bộ lọc, whitelist, quy tắc tùy chỉnh), extension là nguồn chân lý cho thống kê và nhật ký chặn.

Xem chi tiết: [docs/architecture.md](./docs/architecture.md)

---

## Tính tương thích

- **iOS:** 15.0 trở lên
- **Safari Web Extension API:** declarativeNetRequest (DNR)
- **Phân phối thử nghiệm:** SideStore (sideload)

Xem chi tiết: [docs/compatibility.md](./docs/compatibility.md)

---

## Cài đặt (Sideload qua SideStore)

> Hướng dẫn chi tiết sẽ có tại [docs/sideloading.md](./docs/sideloading.md) sau Phase 8.

---

## Cấu trúc repository

```
KBlock/
  apps/
    ios/                    # Swift/SwiftUI app
    safari-extension/       # Safari Web Extension (TypeScript)
  packages/
    filter-engine/          # Parser, converter, validator (TypeScript)
  filters/
    sources.json            # Filter source metadata
    custom/                 # User custom rules
  tests/                    # Test suites
  docs/                     # Documentation
  .github/workflows/        # CI/CD
  LICENSE                   # MPL-2.0
  THIRD_PARTY_NOTICES.md
  FILTER_SOURCES.md
  CONTRIBUTING.md
  SECURITY.md
  README.md
```

---

## Build (yêu cầu macOS + Xcode)

> Phần iOS app và Safari Web Extension yêu cầu macOS và Xcode.
> Xem hướng dẫn build tại [docs/architecture.md](./docs/architecture.md).

**Filter engine (Windows/Linux/macOS):**
```bash
cd packages/filter-engine
npm install
npm test
```

---

## Đóng góp

Xem [CONTRIBUTING.md](./CONTRIBUTING.md) để biết quy trình đóng góp.

---

## Bảo mật

Xem [SECURITY.md](./SECURITY.md) để báo cáo lỗ hổng bảo mật.

---

## Giấy phép

Mã nguồn KBlock được phân phối dưới [Mozilla Public License 2.0](./LICENSE).

Các bộ lọc cộng đồng giữ nguyên giấy phép gốc của mình. Xem [FILTER_SOURCES.md](./FILTER_SOURCES.md).
