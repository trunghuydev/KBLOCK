// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SwiftUI

struct FilterItem: Identifiable {
    let id: String
    let name: String
    let description: String
    let ruleCount: Int
    let version: String
    let isRecommended: Bool
    let bindingKeyPath: ReferenceWritableKeyPath<AppGroupManager, Bool>
}

struct FilterListsView: View {
    @ObservedObject var state = AppGroupManager.shared

    private let availableFilters: [FilterItem] = [
        FilterItem(
            id: "abpvn",
            name: "🇻🇳 ABPVN — Web Việt Nam",
            description: "Bộ lọc tối ưu cho các trang web Việt Nam (phim ảnh, báo chí, truyện tranh, diễn đàn)",
            ruleCount: 8420,
            version: "2026.10",
            isRecommended: true,
            bindingKeyPath: \.filterAbpvn
        ),
        FilterItem(
            id: "gambling",
            name: "🎰 Chống Nhà cái & Cá cược",
            description: "Chặn sạch banner cá độ, casino, VSbet, CM88, SUN88, SUNWIN trên web phim lậu",
            ruleCount: 5120,
            version: "2026.10",
            isRecommended: true,
            bindingKeyPath: \.filterGambling
        ),
        FilterItem(
            id: "annoyances",
            name: "🚫 Chống Pop-up & Chuyển hướng",
            description: "Triệt tiêu bẫy clickjacking, tự động nhảy tab mới và thông báo cookie phiền phức",
            ruleCount: 6300,
            version: "2026.10",
            isRecommended: true,
            bindingKeyPath: \.filterAnnoyances
        ),
        FilterItem(
            id: "easylist",
            name: "🌐 EasyList Quốc Tế",
            description: "Bộ lọc tiêu chuẩn chặn quảng cáo banner, video preroll và theo dõi toàn cầu",
            ruleCount: 48500,
            version: "2026.10",
            isRecommended: true,
            bindingKeyPath: \.filterEasylist
        ),
    ]

    var body: some View {
        List {
            Section(header: Text("Bộ lọc hoạt động")) {
                ForEach(availableFilters) { item in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(item.name)
                                .font(.headline)
                                .foregroundColor(KBlockTheme.textPrimary)

                            if item.isRecommended {
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

                            Toggle("", isOn: Binding(
                                get: { state[keyPath: item.bindingKeyPath] },
                                set: { state[keyPath: item.bindingKeyPath] = $0 }
                            ))
                            .labelsHidden()
                        }

                        Text(item.description)
                            .font(.subheadline)
                            .foregroundColor(KBlockTheme.textSecondary)

                        HStack {
                            Label("\(item.ruleCount.formatted()) quy tắc", systemImage: "shield.lefthalf.filled")
                            Spacer()
                            Text("Bản: \(item.version)")
                        }
                        .font(.caption)
                        .foregroundColor(KBlockTheme.textSecondary)
                    }
                    .padding(.vertical, 6)
                }
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
}
