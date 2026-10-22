// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SwiftUI

struct FilterListsView: View {
    @ObservedObject var state = AppGroupManager.shared

    var body: some View {
        List {
            Section(header: Text("Bộ lọc hoạt động")) {
                filterCard(
                    title: "🇻🇳 ABPVN — Web Việt Nam",
                    description: "Bộ lọc tối ưu cho các trang web Việt Nam (phim ảnh, báo chí, truyện tranh, diễn đàn)",
                    ruleCount: "8.420 quy tắc",
                    version: "2026.10",
                    isRecommended: true,
                    isOn: $state.filterAbpvn
                )

                filterCard(
                    title: "🎰 Chống Nhà cái & Cá cược",
                    description: "Chặn sạch banner cá độ, casino, VSbet, CM88, SUN88, SUNWIN trên web phim lậu",
                    ruleCount: "5.120 quy tắc",
                    version: "2026.10",
                    isRecommended: true,
                    isOn: $state.filterGambling
                )

                filterCard(
                    title: "🚫 Chống Pop-up & Chuyển hướng",
                    description: "Triệt tiêu bẫy clickjacking, tự động nhảy tab mới và thông báo cookie phiền phức",
                    ruleCount: "6.300 quy tắc",
                    version: "2026.10",
                    isRecommended: true,
                    isOn: $state.filterAnnoyances
                )

                filterCard(
                    title: "🌐 EasyList Quốc Tế",
                    description: "Bộ lọc tiêu chuẩn chặn quảng cáo banner, video preroll và theo dõi toàn cầu",
                    ruleCount: "48.500 quy tắc",
                    version: "2026.10",
                    isRecommended: true,
                    isOn: $state.filterEasylist
                )
            }

            Section(header: Text("Năng lực quy tắc Safari (Apple iOS 15+)")) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Tổng quy tắc kích hoạt:")
                            .font(.subheadline)
                            .foregroundColor(KBlockTheme.textPrimary)
                        Spacer()
                        Text("\(state.totalActiveRules.formatted()) / 150.000")
                            .font(.subheadline.bold())
                            .foregroundColor(KBlockTheme.primary)
                    }

                    ProgressView(value: Double(state.totalActiveRules), total: 150000)
                        .accentColor(KBlockTheme.primary)

                    Text("Apple đã nâng giới hạn Safari lên 150.000 quy tắc. KBlock sử dụng ~68.300 quy tắc, hoàn toàn mượt mà và tối ưu hiệu năng thiết bị.")
                        .font(.footnote)
                        .foregroundColor(KBlockTheme.textSecondary)
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Bộ lọc quảng cáo")
    }

    private func filterCard(title: String, description: String, ruleCount: String, version: String, isRecommended: Bool, isOn: Binding<Bool>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundColor(KBlockTheme.textPrimary)

                if isRecommended {
                    Text("Khuyên dùng")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(KBlockTheme.primary.opacity(0.12))
                        .foregroundColor(KBlockTheme.primary)
                        .cornerRadius(4)
                }

                Spacer()

                Toggle("", isOn: isOn)
                    .labelsHidden()
            }

            Text(description)
                .font(.subheadline)
                .foregroundColor(KBlockTheme.textSecondary)

            HStack {
                Label(ruleCount, systemImage: "shield.lefthalf.filled")
                Spacer()
                Text("Bản: \(version)")
            }
            .font(.caption)
            .foregroundColor(KBlockTheme.textSecondary)
        }
        .padding(.vertical, 6)
    }
}
