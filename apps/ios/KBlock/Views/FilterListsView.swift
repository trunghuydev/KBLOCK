// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SwiftUI

struct FilterListsView: View {
    @ObservedObject var state = AppGroupManager.shared

    var body: some View {
        List {
            Section(header: Text("Bộ lọc hoạt động"), footer: pipelineFooter) {
                filterCard(
                    title: "🇻🇳 ABPVN — Web Việt Nam",
                    description: "Quy tắc cho web Việt Nam (phim ảnh, báo chí, truyện tranh). Bản đầy đủ được nạp qua pipeline cập nhật bộ lọc.",
                    ruleCount: pipelineRun ? "Bản đầy đủ" : "\(AppGroupManager.bundledAbpvnRules) quy tắc",
                    isOn: $state.filterAbpvn
                )

                filterCard(
                    title: "🎰 Chống Nhà cái & Cá cược",
                    description: "Chặn banner cá độ, casino, VSbet, SUNWIN… trên web phim lậu.",
                    ruleCount: "\(AppGroupManager.bundledGamblingRules) quy tắc",
                    isOn: $state.filterGambling
                )

                filterCard(
                    title: "🚫 Chống Pop-up & Khó chịu",
                    description: "Lớp cosmetic + anti-popup + element-hide từ bộ lọc: diệt banner nổi, bẫy clickjack, pop-under.",
                    ruleCount: "Lớp nội dung",
                    isOn: $state.filterAnnoyances
                )

                filterCard(
                    title: "🍪 Chặn banner cookie",
                    description: "Ẩn popup hỏi consent/GDPR (OneTrust, Cookiebot…) và mở khóa cuộn trang.",
                    ruleCount: "Lớp nội dung",
                    isOn: $state.cookieBanners
                )

                filterCard(
                    title: "🌐 EasyList Quốc Tế",
                    description: "Quảng cáo banner, video preroll và tracker toàn cầu (kèm EasyPrivacy khi có bản đầy đủ).",
                    ruleCount: pipelineRun ? "Bản đầy đủ" : "\(AppGroupManager.bundledEasylistRules) quy tắc",
                    isOn: $state.filterEasylist
                )
            }

            Section("Tổng quan") {
                HStack {
                    Text("Quy tắc đang chạy (báo bởi tiện ích)")
                    Spacer()
                    Text(extensionRuleLabel)
                        .foregroundColor(KBlockTheme.primary)
                        .bold()
                }
                .font(.subheadline)

                HStack {
                    Text("Quy tắc động (tùy chỉnh + whitelist)")
                    Spacer()
                    Text("\(state.dynamicRuleCount) quy tắc")
                        .foregroundColor(KBlockTheme.primary)
                        .bold()
                }
                .font(.subheadline)
            }
        }
        .navigationTitle("Bộ lọc quảng cáo")
    }

    /// The extension reports the real bundled rule count via the App Group.
    private var pipelineRun: Bool {
        state.extensionRuleCount > 100
    }

    private var extensionRuleLabel: String {
        if state.extensionRuleCount > 0 {
            return "\(state.extensionRuleCount.formatted()) quy tắc"
        }
        return "\(state.totalActiveRules) quy tắc đóng gói"
    }

    private var pipelineFooter: some View {
        Text("Bản đóng gói hiện chứa 87 quy tắc chọn lọc. Pipeline nạp ABPVN/EasyList đầy đủ (hàng chục nghìn quy tắc, tự cập nhật) đang được phát triển ở Giai đoạn 2 — xem docs/filter-pipeline.md.")
    }

    private func filterCard(title: String, description: String, ruleCount: String, isOn: Binding<Bool>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundColor(KBlockTheme.textPrimary)

                Spacer()

                Toggle("", isOn: isOn)
                    .labelsHidden()
                    .toggleStyle(SwitchToggleStyle(tint: KBlockTheme.primary))
            }

            Text(description)
                .font(.subheadline)
                .foregroundColor(KBlockTheme.textSecondary)

            Label(ruleCount, systemImage: "shield.lefthalf.filled")
                .font(.caption)
                .foregroundColor(KBlockTheme.textSecondary)
        }
        .padding(.vertical, 6)
    }
}
