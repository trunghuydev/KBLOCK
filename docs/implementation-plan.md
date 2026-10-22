# KBlock — Implementation Plan (Ticket Breakdown)

> **Version:** 0.1.0  
> **Last updated:** 2026-10-22  
> **Status:** Phase 0 — Active planning document

---

## Giai đoạn 0: Khảo sát & Kế hoạch ✅ Đang hoàn thành

| Ticket | Nhiệm vụ | Môi trường | Trạng thái |
|--------|---------|-----------|-----------|
| P0-01 | Kiểm tra hệ điều hành, Node.js, Git | Windows | ✅ Done |
| P0-02 | Khảo sát repository hiện tại | Windows | ✅ Done — empty |
| P0-03 | Tạo cấu trúc thư mục | Windows | ✅ Done |
| P0-04 | Nghiên cứu Safari Web Extension API | Windows | ✅ Done |
| P0-05 | Nghiên cứu DNR support theo iOS version | Windows | ✅ Done |
| P0-06 | Nghiên cứu SideStore + extension signing | Windows | ✅ Done |
| P0-07 | Nghiên cứu giấy phép ABPVN, EasyList | Windows | ✅ Done |
| P0-08 | Tạo docs/architecture.md | Windows | ✅ Done |
| P0-09 | Tạo docs/compatibility.md | Windows | ✅ Done |
| P0-10 | Tạo LICENSE, THIRD_PARTY_NOTICES, FILTER_SOURCES | Windows | ✅ Done |
| P0-11 | Tạo README, CONTRIBUTING, SECURITY | Windows | ✅ Done |
| P0-12 | Tạo .gitignore | Windows | ✅ Done |
| P0-13 | Tạo implementation plan (file này) | Windows | ✅ Done |
| P0-14 | Git commit initial | Windows | ⬜ Pending |

---

## Giai đoạn 1: Proof of Concept

> **Mục tiêu:** Chứng minh app + extension hoạt động trên thiết bị thật  
> **Yêu cầu môi trường:** macOS + Xcode + iPhone

### 1A. Extension (có thể chuẩn bị trên Windows)

| Ticket | Nhiệm vụ | Môi trường | Trạng thái |
|--------|---------|-----------|-----------|
| P1-01 | Khởi tạo cấu trúc extension (TypeScript) | Windows | ⬜ |
| P1-02 | Viết manifest.json với quyền tối thiểu | Windows | ⬜ |
| P1-03 | Viết background service worker stub | Windows | ⬜ |
| P1-04 | Tạo test DNR rule (block test domain) | Windows | ⬜ |
| P1-05 | Viết content script stub | Windows | ⬜ |
| P1-06 | Cài TypeScript, ESLint, Prettier | Windows | ⬜ |
| P1-07 | Viết tsconfig.json và build script | Windows | ⬜ |

### 1B. iOS App (yêu cầu macOS)

| Ticket | Nhiệm vụ | Môi trường | Trạng thái |
|--------|---------|-----------|-----------|
| P1-08 | Tạo Xcode project với iOS app target | **macOS** | 🔲 BLOCKED |
| P1-09 | Thêm Safari Web Extension target vào project | **macOS** | 🔲 BLOCKED |
| P1-10 | Cấu hình App Group entitlement | **macOS** | 🔲 BLOCKED |
| P1-11 | Viết SwiftUI HomeView tối giản | **macOS** | 🔲 BLOCKED |
| P1-12 | Tích hợp SFSafariExtensionManager | **macOS** | 🔲 BLOCKED |
| P1-13 | Viết hướng dẫn bật extension trong Safari | **macOS** | 🔲 BLOCKED |

### 1C. Build & Device Test (yêu cầu macOS + iPhone)

| Ticket | Nhiệm vụ | Môi trường | Trạng thái |
|--------|---------|-----------|-----------|
| P1-14 | Build thành công trên macOS/Xcode | **macOS** | 🔲 BLOCKED |
| P1-15 | Ký app với free Apple ID | **macOS** | 🔲 BLOCKED |
| P1-16 | Xuất IPA | **macOS** | 🔲 BLOCKED |
| P1-17 | Cài IPA qua SideStore trên iPhone | **iPhone** | 🔲 BLOCKED |
| P1-18 | Bật extension trong Safari Settings | **iPhone** | 🔲 BLOCKED |
| P1-19 | Xác nhận DNR rule có tác dụng (test domain) | **iPhone** | 🔲 BLOCKED |
| P1-20 | Xác nhận content script chạy trên test domain | **iPhone** | 🔲 BLOCKED |
| P1-21 | Ghi lại kết quả test: iOS version, Safari version | **iPhone** | 🔲 BLOCKED |

**Cổng P1:** Tất cả P1-14 đến P1-21 phải PASS trước khi tiếp tục Phase 2.

---

## Giai đoạn 2: Filter Engine

> **Yêu cầu:** P1 cổng phải PASS

| Ticket | Nhiệm vụ | Môi trường | Trạng thái |
|--------|---------|-----------|-----------|
| P2-01 | Xác định tập con cú pháp EasyList cần parse | Windows | ⬜ |
| P2-02 | Viết parser TypeScript + unit tests | Windows | ⬜ |
| P2-03 | Viết converter (AST → DNR JSON) + tests | Windows | ⬜ |
| P2-04 | Viết validator (schema check, duplicates) | Windows | ⬜ |
| P2-05 | Viết reporter (conversion stats) | Windows | ⬜ |
| P2-06 | Tạo test fixtures (valid, invalid, edge cases) | Windows | ⬜ |
| P2-07 | Tạo regression tests | Windows | ⬜ |
| P2-08 | Đặt giới hạn kích thước đầu vào | Windows | ⬜ |
| P2-09 | Cơ chế phiên bản ruleset | Windows | ⬜ |
| P2-10 | Vitest CI workflow | Windows | ⬜ |

**Cổng P2:** Parser và converter tests phải pass 100% trước Phase 3.

---

## Giai đoạn 3: Bộ lọc cộng đồng

> **Yêu cầu:** P2 cổng phải PASS + Legal review hoàn thành

| Ticket | Nhiệm vụ | Môi trường | Trạng thái |
|--------|---------|-----------|-----------|
| P3-01 | Hoàn thành legal review ABPVN (GPL-3.0) | - | ⬜ |
| P3-02 | Hoàn thành legal review EasyList (CC-BY-SA) | - | ⬜ |
| P3-03 | Tích hợp ABPVN (download-only, not bundled) | Windows | ⬜ |
| P3-04 | Test ABPVN conversion rate và report | Windows | ⬜ |
| P3-05 | Tích hợp EasyList nếu legal review OK | Windows | ⬜ |
| P3-06 | Tích hợp EasyPrivacy nếu legal review OK | Windows | ⬜ |
| P3-07 | Bật/tắt từng nguồn filter | Windows | ⬜ |
| P3-08 | Regression tests cho mỗi nguồn | Windows | ⬜ |
| P3-09 | Cơ chế rollback khi update lỗi | Windows | ⬜ |

---

## Giai đoạn 4–9

> Chi tiết sẽ được thêm khi Phase 1 cổng pass.

---

## Điều kiện để chuyển sang Phase 1 ngay

Bạn (chủ dự án) cần:
1. **Có máy Mac** (cloud hoặc vật lý) với Xcode 14+ được cài đặt.
2. **Có Apple ID** (không cần trả tiền cho Developer Program).
3. **Có iPhone thật** chạy iOS 15+.
4. **Cài SideStore** trên iPhone đó.
5. Thông báo để agent bắt đầu Phase 1A (phần Windows) và cung cấp hướng dẫn cho Phase 1B/1C.
