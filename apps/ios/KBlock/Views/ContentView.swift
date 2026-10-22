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

                ScrollView {
                    VStack(spacing: 20) {
                        // Hero Status Card
                        heroStatusCard

                        // Safari Setup Reminder Card
                        setupNoticeCard

                        // Quick Navigation Section
                        navigationSection

                        // Open Source & Privacy Footer
                        footerSection
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 30)
                }
            }
            .navigationTitle("KBlock")
            .sheet(isPresented: $showingSafariGuide) {
                SafariSetupGuideView()
            }
        }
    }

    // ─── Subviews ─────────────────────────────────────────────────────────────

    private var heroStatusCard: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(state.isEnabled ? KBlockTheme.primary.opacity(0.12) : Color.gray.opacity(0.12))
                    .frame(width: 84, height: 84)

                Image(systemName: state.isEnabled ? "shield.checkered" : "shield.slash")
                    .font(.system(size: 40))
                    .foregroundColor(state.isEnabled ? KBlockTheme.primary : Color.gray)
            }

            VStack(spacing: 4) {
                Text(state.isEnabled ? "Đang bảo vệ" : "Đã tắt chặn")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(KBlockTheme.textPrimary)

                Text(state.isEnabled ? "Quảng cáo và theo dõi trên Safari đang bị chặn" : "Chạm công tắc bên dưới để bật lại")
                    .font(.subheadline)
                    .foregroundColor(KBlockTheme.textSecondary)
                    .multilineTextAlignment(.center)
            }

            Toggle(isOn: $state.isEnabled) {
                Text(state.isEnabled ? "Đang bật" : "Đã tắt")
                    .font(.headline)
            }
            .toggleStyle(SwitchToggleStyle(tint: KBlockTheme.primary))
            .padding(.horizontal, 30)
            .padding(.top, 4)
        }
        .padding(.vertical, 24)
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity)
        .background(KBlockTheme.surface)
        .cornerRadius(18)
        .shadow(color: Color.black.opacity(0.04), radius: 10, x: 0, y: 4)
    }

    private var setupNoticeCard: some View {
        Button(action: { showingSafariGuide = true }) {
            HStack(spacing: 14) {
                Image(systemName: "safari")
                    .font(.system(size: 28))
                    .foregroundColor(KBlockTheme.accent)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Cần bật tiện ích trong Safari")
                        .font(.headline)
                        .foregroundColor(KBlockTheme.textPrimary)

                    Text("Nhấn vào đây để xem các bước kích hoạt 1 lần duy nhất")
                        .font(.caption)
                        .foregroundColor(KBlockTheme.textSecondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(KBlockTheme.textSecondary)
            }
            .padding(16)
            .background(KBlockTheme.surface)
            .cornerRadius(14)
            .shadow(color: Color.black.opacity(0.03), radius: 6, x: 0, y: 2)
        }
    }

    private var navigationSection: some View {
        VStack(spacing: 12) {
            NavigationLink(destination: FilterListsView()) {
                menuRow(icon: "list.bullet.rectangle.fill", title: "Bộ lọc quảng cáo", subtitle: "\(state.activeFilterLists.count) bộ lọc đang kích hoạt")
            }

            NavigationLink(destination: WhitelistView()) {
                menuRow(icon: "checkmark.shield.fill", title: "Danh sách trắng", subtitle: "\(state.whitelist.count) tên miền")
            }
        }
    }

    private func menuRow(icon: String, title: String, subtitle: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundColor(KBlockTheme.primary)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(KBlockTheme.textPrimary)

                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(KBlockTheme.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(KBlockTheme.textSecondary)
        }
        .padding(16)
        .background(KBlockTheme.surface)
        .cornerRadius(14)
        .shadow(color: Color.black.opacity(0.03), radius: 6, x: 0, y: 2)
    }

    private var footerSection: some View {
        VStack(spacing: 6) {
            Text("KBlock v0.1.0 • Mã nguồn mở MPL-2.0")
                .font(.caption2)
                .foregroundColor(KBlockTheme.textSecondary)

            Text("Hoạt động cục bộ trên thiết bị, 100% riêng tư không thu thập dữ liệu")
                .font(.caption2)
                .foregroundColor(KBlockTheme.textSecondary.opacity(0.8))
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
                VStack(alignment: .leading, spacing: 20) {
                    Text("Hướng dẫn bật KBlock trên Safari")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(KBlockTheme.textPrimary)

                    stepItem(num: "1", title: "Mở Cài đặt (Settings)", desc: "Mở ứng dụng Cài đặt trên iPhone, cuộn xuống và chọn mục Safari.")

                    stepItem(num: "2", title: "Chọn Phần mở rộng (Extensions)", desc: "Trong cài đặt Safari, tìm mục 'Phần mở rộng' (Extensions).")

                    stepItem(num: "3", title: "Bật KBlock", desc: "Tìm KBlock trong danh sách và gạt công tắc sang trạng thái BẬT.")

                    stepItem(num: "4", title: "Cấp quyền trang web", desc: "Nhấn vào 'Tất cả trang web' và chọn 'Luôn cho phép' để KBlock có thể chặn quảng cáo tự động.")

                    Spacer()
                }
                .padding(20)
            }
            .navigationBarItems(trailing: Button("Đã hiểu") {
                presentationMode.wrappedValue.dismiss()
            })
        }
    }

    private func stepItem(num: String, title: String, desc: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle()
                    .fill(KBlockTheme.primary)
                    .frame(width: 28, height: 28)
                Text(num)
                    .font(.footnote)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(KBlockTheme.textPrimary)
                Text(desc)
                    .font(.subheadline)
                    .foregroundColor(KBlockTheme.textSecondary)
            }
        }
    }
}
