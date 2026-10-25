// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SwiftUI

struct ContentView: View {
    @ObservedObject var state = AppGroupManager.shared
    @State private var showingSafariGuide = false

    var body: some View {
        NavigationView {
            ZStack {
                KBlockTheme.background.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 20) {
                        heroStatusCard

                        statsRow

                        if !state.hasAppGroup {
                            appGroupWarningCard
                        }

                        setupNoticeCard

                        navigationSection

                        footerSection
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 36)
                }
            }
            .navigationTitle("KBlock")
            .sheet(isPresented: $showingSafariGuide) {
                SafariSetupGuideView()
            }
            .onAppear {
                state.refresh()
            }
        }
    }

    // ─── Subviews ─────────────────────────────────────────────────────────────

    private var heroStatusCard: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(state.isEnabled ? KBlockTheme.primary.opacity(0.08) : Color.gray.opacity(0.06))
                    .frame(width: 110, height: 110)

                Circle()
                    .fill(state.isEnabled ? KBlockTheme.primary.opacity(0.16) : Color.gray.opacity(0.12))
                    .frame(width: 86, height: 86)

                Image(systemName: state.isEnabled ? "checkmark.shield.fill" : "shield.slash.fill")
                    .font(.system(size: 42, weight: .semibold))
                    .foregroundColor(state.isEnabled ? KBlockTheme.primary : Color.gray)
                    .shadow(color: state.isEnabled ? KBlockTheme.primary.opacity(0.3) : Color.clear, radius: 8, x: 0, y: 4)
            }
            .animation(.spring(response: 0.4, dampingFraction: 0.6), value: state.isEnabled)

            VStack(spacing: 6) {
                Text(state.isEnabled ? "Đang Bảo Vệ An Toàn" : "Đã Tạm Dừng Bảo Vệ")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(KBlockTheme.textPrimary)

                Text(state.isEnabled ? "Quảng cáo, theo dõi và pop-up trên Safari đang bị chặn" : "Gạt công tắc bên dưới để tiếp tục bảo vệ thiết bị")
                    .font(.subheadline)
                    .foregroundColor(KBlockTheme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 10)
            }

            Toggle(isOn: $state.isEnabled.animation(.spring(response: 0.35, dampingFraction: 0.7))) {
                Text(state.isEnabled ? "Bảo Vệ Hoạt Động" : "Tạm Dừng")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(state.isEnabled ? KBlockTheme.primary : KBlockTheme.textSecondary)
            }
            .toggleStyle(SwitchToggleStyle(tint: KBlockTheme.primary))
            .padding(.horizontal, 24)
            .padding(.vertical, 8)
            .background(KBlockTheme.background.opacity(0.6))
            .cornerRadius(12)
        }
        .padding(.vertical, 28)
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity)
        .background(KBlockTheme.surface)
        .cornerRadius(22)
        .shadow(color: Color.black.opacity(0.05), radius: 14, x: 0, y: 6)
    }

    private var statsRow: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                statBox(
                    number: "\(state.stats.totalBlocked.formatted())",
                    title: "Tổng đã chặn",
                    icon: "shield.fill"
                )
                statBox(
                    number: "\(String(format: "%.1f", state.stats.bandwidthSavedMB)) MB",
                    title: "Dữ liệu tiết kiệm",
                    icon: "arrow.down.circle.fill"
                )
            }
            HStack(spacing: 10) {
                statBox(
                    number: "\(state.stats.popupsBlocked.formatted())",
                    title: "Pop-up/Redirect diệt",
                    icon: "xmark.circle.fill"
                )
                statBox(
                    number: "\(state.totalActiveRules.formatted())",
                    title: "Quy tắc hoạt động",
                    icon: "checklist"
                )
            }
        }
    }

    private func statBox(number: String, title: String, icon: String) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(KBlockTheme.primary.opacity(0.1))
                    .frame(width: 36, height: 36)
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundColor(KBlockTheme.primary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(number)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(KBlockTheme.primary)
                Text(title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(KBlockTheme.textSecondary)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background(KBlockTheme.surface)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 3)
    }

    private var appGroupWarningCard: some View {
        HStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 22))
                .foregroundColor(.orange)

            VStack(alignment: .leading, spacing: 3) {
                Text("Thiếu App Group")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(KBlockTheme.textPrimary)

                Text("Cài đặt trong app chưa đồng bộ sang tiện ích Safari. Hãy build lại với App Group capability (xem README-XCODE).")
                    .font(.system(size: 12))
                    .foregroundColor(KBlockTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()
        }
        .padding(16)
        .background(KBlockTheme.surface)
        .cornerRadius(18)
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color.orange.opacity(0.4), lineWidth: 1)
        )
    }

    private var setupNoticeCard: some View {
        Button(action: { showingSafariGuide = true }) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(KBlockTheme.accent.opacity(0.12))
                        .frame(width: 44, height: 44)
                    Image(systemName: "safari.fill")
                        .font(.system(size: 24))
                        .foregroundColor(KBlockTheme.accent)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text("Kích hoạt tiện ích trong Safari")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(KBlockTheme.textPrimary)

                    Text("Nhấn vào đây để xem hướng dẫn bật 1 lần duy nhất")
                        .font(.system(size: 12))
                        .foregroundColor(KBlockTheme.textSecondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(KBlockTheme.textSecondary.opacity(0.6))
            }
            .padding(16)
            .background(KBlockTheme.surface)
            .cornerRadius(18)
            .shadow(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 3)
        }
    }

    private var navigationSection: some View {
        VStack(spacing: 12) {
            NavigationLink(destination: FilterListsView()) {
                menuRow(
                    icon: "list.bullet.rectangle.portrait.fill",
                    title: "Bộ lọc quảng cáo",
                    subtitle: "\(state.totalActiveRules.formatted()) quy tắc đóng gói đang chạy"
                )
            }

            NavigationLink(destination: CustomRulesView()) {
                menuRow(
                    icon: "slider.horizontal.3",
                    title: "Bộ lọc tùy chỉnh",
                    subtitle: "\(state.customRules.count) quy tắc của bạn"
                )
            }

            NavigationLink(destination: WhitelistView()) {
                menuRow(
                    icon: "shield.lefthalf.filled",
                    title: "Danh sách trắng (Whitelist)",
                    subtitle: "\(state.whitelist.count) tên miền được cho phép"
                )
            }

            NavigationLink(destination: ActivityLogView()) {
                menuRow(
                    icon: "clock.arrow.circlepath",
                    title: "Nhật ký chặn",
                    subtitle: state.activity.isEmpty
                        ? "Chưa có sự kiện nào được ghi"
                        : "Sự kiện mới nhất: \(state.activity.last?.host ?? "")"
                )
            }
        }
    }

    private func menuRow(icon: String, title: String, subtitle: String) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(KBlockTheme.primary.opacity(0.1))
                    .frame(width: 38, height: 38)
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(KBlockTheme.primary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(KBlockTheme.textPrimary)

                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundColor(KBlockTheme.textSecondary)
                    .lineLimit(1)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(KBlockTheme.textSecondary.opacity(0.6))
        }
        .padding(14)
        .background(KBlockTheme.surface)
        .cornerRadius(16)
        .shadow(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 3)
    }

    private var footerSection: some View {
        VStack(spacing: 6) {
            Text("KBlock v0.2.0 • Mã nguồn mở MPL-2.0")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(KBlockTheme.textSecondary)

            Text("Bảo vệ quyền riêng tư 100% trên thiết bị • Không gửi dữ liệu mạng")
                .font(.system(size: 10))
                .foregroundColor(KBlockTheme.textSecondary.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .padding(.top, 10)
    }
}

// ─── Safari Setup Modal ────────────────────────────────────────────────────────

struct SafariSetupGuideView: View {
    @Environment(\.presentationMode) var presentationMode

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("Các bước kích hoạt KBlock")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(KBlockTheme.textPrimary)
                        .padding(.top, 6)

                    stepItem(num: "1", title: "Mở Cài đặt iPhone", desc: "Mở ứng dụng Cài đặt (Settings) trên máy, cuộn xuống và chọn Safari.")
                    stepItem(num: "2", title: "Mục Phần mở rộng", desc: "Trong màn hình Safari, chọn mục 'Phần mở rộng' (Extensions).")
                    stepItem(num: "3", title: "Bật KBlock", desc: "Tìm KBlock trong danh sách và gạt công tắc sang BẬT (ON).")
                    stepItem(num: "4", title: "Cấp quyền trang web", desc: "Nhấn vào 'Tất cả trang web' và chọn 'Luôn cho phép' để tiện ích có quyền lọc quảng cáo.")

                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Hướng dẫn Safari")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing: Button("Đã hiểu") {
                presentationMode.wrappedValue.dismiss()
            }.font(.system(size: 16, weight: .semibold)).foregroundColor(KBlockTheme.primary))
        }
    }

    private func stepItem(num: String, title: String, desc: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle()
                    .fill(KBlockTheme.primary)
                    .frame(width: 30, height: 30)
                Text(num)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(KBlockTheme.textPrimary)
                Text(desc)
                    .font(.system(size: 13))
                    .foregroundColor(KBlockTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
