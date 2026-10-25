// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SwiftUI

/// Live feed of popups/redirects/clickjacks the extension actually
/// intercepted. Written by the extension into the App Group; read-only here.
struct ActivityLogView: View {
    @ObservedObject var state = AppGroupManager.shared

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter
    }()

    var body: some View {
        List {
            if state.activity.isEmpty {
                Section {
                    VStack(spacing: 10) {
                        Image(systemName: "tray")
                            .font(.system(size: 36))
                            .foregroundColor(KBlockTheme.textSecondary)
                        Text("Chưa có sự kiện nào")
                            .font(.headline)
                            .foregroundColor(KBlockTheme.textPrimary)
                        Text("Khi tiện ích chặn một pop-up, chuyển hướng hoặc overlay clickjack, sự kiện sẽ xuất hiện ở đây.")
                            .font(.footnote)
                            .foregroundColor(KBlockTheme.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 30)
                }
            } else {
                Section(header: Text("50 sự kiện gần nhất")) {
                    ForEach(state.activity.reversed()) { event in
                        HStack(spacing: 12) {
                            Image(systemName: Self.icon(for: event.type))
                                .foregroundColor(Self.color(for: event.type))
                                .font(.system(size: 20))
                                .frame(width: 28)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(Self.title(for: event.type))
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(KBlockTheme.textPrimary)
                                Text(event.host.isEmpty ? event.url : event.host)
                                    .font(.caption)
                                    .foregroundColor(KBlockTheme.textSecondary)
                                    .lineLimit(1)
                            }

                            Spacer()

                            Text(Self.timeLabel(event.at))
                                .font(.caption2)
                                .foregroundColor(KBlockTheme.textSecondary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("Nhật ký chặn")
        .onAppear {
            state.refresh()
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static func title(for type: String) -> String {
        switch type {
        case "popup": return "Pop-up bị chặn"
        case "redirect": return "Chuyển hướng bị chặn"
        case "clickjack": return "Overlay clickjack bị diệt"
        default: return type
        }
    }

    private static func icon(for type: String) -> String {
        switch type {
        case "popup": return "macwindow.on.rectangle"
        case "redirect": return "arrow.triangle.turn.up.right.circle"
        case "clickjack": return "hand.tap.fill"
        default: return "shield.fill"
        }
    }

    private static func color(for type: String) -> Color {
        switch type {
        case "popup": return KBlockTheme.accent
        case "redirect": return KBlockTheme.success
        case "clickjack": return .orange
        default: return KBlockTheme.primary
        }
    }

    private static func timeLabel(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: iso) else { return "" }
        return relativeFormatter.localizedString(for: date, relativeTo: Date())
    }
}
