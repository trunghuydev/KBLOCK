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
}

struct FilterListsView: View {
    @ObservedObject var state = AppGroupManager.shared

    private let availableFilters: [FilterItem] = [
        FilterItem(
            id: "abpvn",
            name: "ABPVN List",
            description: "Bộ lọc tối ưu đặc biệt cho các trang web Việt Nam (báo chí, diễn đàn, phim ảnh)",
            ruleCount: 14500,
            version: "2026.10",
            isRecommended: true
        ),
        FilterItem(
            id: "easylist",
            name: "EasyList Global",
            description: "Bộ lọc quảng cáo quốc tế tiêu chuẩn",
            ruleCount: 38200,
            version: "2026.10",
            isRecommended: true
        ),
        FilterItem(
            id: "adguard_mobile",
            name: "AdGuard Mobile Filter",
            description: "Bộ lọc tinh gọn dành cho thiết bị di động",
            ruleCount: 11000,
            version: "2026.10",
            isRecommended: false
        )
    ]

    var body: some View {
        List {
            Section(header: Text("Bộ lọc đã cài đặt")) {
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
                                get: { state.activeFilterLists.contains(item.id) },
                                set: { active in
                                    if active {
                                        if !state.activeFilterLists.contains(item.id) {
                                            state.activeFilterLists.append(item.id)
                                        }
                                    } else {
                                        state.activeFilterLists.removeAll { $0 == item.id }
                                    }
                                }
                            ))
                            .labelsHidden()
                        }

                        Text(item.description)
                            .font(.subheadline)
                            .foregroundColor(KBlockTheme.textSecondary)

                        HStack {
                            Label("\(item.ruleCount) quy tắc", systemImage: "shield.lefthalf.filled")
                            Spacer()
                            Text("Bản: \(item.version)")
                        }
                        .font(.caption)
                        .foregroundColor(KBlockTheme.textSecondary)
                    }
                    .padding(.vertical, 4)
                }
            }

            Section(header: Text("Giới hạn DeclarativeNetRequest")) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Safari MV3 giới hạn tối đa ~50.000 quy tắc cho mỗi ruleset tĩnh.")
                        .font(.footnote)
                        .foregroundColor(KBlockTheme.textSecondary)
                    Text("KBlock tự động tối ưu hóa và hợp nhất quy tắc để không vượt quá giới hạn này.")
                        .font(.footnote)
                        .foregroundColor(KBlockTheme.textSecondary)
                }
            }
        }
        .navigationTitle("Bộ lọc quảng cáo")
    }
}
