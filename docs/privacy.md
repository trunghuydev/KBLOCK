# KBlock — Privacy Policy

> **Version:** 0.1.0-draft  
> **Last updated:** 2026-10-22

---

## Tóm tắt (TL;DR)

KBlock **không thu thập, không lưu trữ, và không gửi** lịch sử duyệt web của bạn đến bất kỳ server nào. Tất cả xử lý diễn ra trên thiết bị của bạn.

---

## Dữ liệu KBlock thu thập

### Không thu thập
- Lịch sử duyệt web
- URL bạn truy cập
- Nội dung trang web
- Thông tin cá nhân
- Địa chỉ IP

### Lưu trữ cục bộ (chỉ trên thiết bị của bạn)
- Cài đặt ứng dụng (bộ lọc nào đang bật/tắt)
- Danh sách whitelist domain do bạn tạo
- Cache bộ lọc đã tải (để hoạt động offline)
- Bộ lọc tùy chỉnh do bạn thêm

Dữ liệu này **không bao giờ rời khỏi thiết bị** của bạn trừ khi bạn tự xuất và chia sẻ.

---

## Bộ lọc cộng đồng

Khi KBlock tải bộ lọc từ nguồn cộng đồng (EasyList, ABPVN, v.v.):
- KBlock thực hiện HTTP GET đến URL của bộ lọc đó
- Server của bộ lọc có thể ghi log địa chỉ IP của bạn (đây là hành vi tiêu chuẩn của HTTP)
- KBlock không kiểm soát chính sách của các server bên thứ ba đó
- Bạn có thể tắt tự động cập nhật để hạn chế điều này

---

## Analytics

KBlock **không tích hợp** bất kỳ SDK analytics nào:
- Không Firebase Analytics
- Không Mixpanel
- Không Amplitude
- Không bất kỳ dịch vụ tracking người dùng nào

---

## Quyền của Extension

Safari Web Extension của KBlock yêu cầu:
- `declarativeNetRequest` — để chặn request mạng theo quy tắc
- `storage` — để lưu cài đặt cục bộ trong extension
- Quyền truy cập `<all_urls>` — cần thiết để DNR hoạt động trên tất cả trang

KBlock **không** đọc nội dung trang web để gửi đi nơi khác.

---

## Liên hệ

Câu hỏi về quyền riêng tư: trunghuy832@gmail.com
