// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import WidgetKit
import SwiftUI

// MARK: - Timeline

struct StatsEntry: TimelineEntry {
    let date: Date
    let totalBlocked: Int
    let bandwidthSavedMB: Double
}

private struct WidgetStats: Codable {
    let totalBlocked: Int?
    let bandwidthSavedMB: Double?
}

struct StatsProvider: TimelineProvider {
    private var defaults: UserDefaults? {
        UserDefaults(suiteName: AppGroup.identifier)
    }

    func placeholder(in context: Context) -> StatsEntry {
        StatsEntry(date: Date(), totalBlocked: 0, bandwidthSavedMB: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (StatsEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StatsEntry>) -> Void) {
        let entry = currentEntry()
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func currentEntry() -> StatsEntry {
        var total = 0
        var bandwidth = 0.0
        if let json = defaults?.string(forKey: AppGroup.statsKey),
           let data = json.data(using: .utf8),
           let stats = try? JSONDecoder().decode(WidgetStats.self, from: data) {
            total = stats.totalBlocked ?? 0
            bandwidth = stats.bandwidthSavedMB ?? 0
        }
        return StatsEntry(date: Date(), totalBlocked: total, bandwidthSavedMB: bandwidth)
    }
}

// MARK: - Views

struct KBlockWidgetEntryView: View {
    var entry: StatsEntry

    private var gradient: LinearGradient {
        LinearGradient(
            colors: [
                Color(red: 0x1B / 255, green: 0x43 / 255, blue: 0x32 / 255),
                Color(red: 0x2D / 255, green: 0x6A / 255, blue: 0x4F / 255),
            ],
            startPoint: .top, endPoint: .bottom
        )
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 5) {
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.white.opacity(0.9))
                Text("KBlock")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(.white.opacity(0.9))
            }

            Spacer()

            Text(entry.totalBlocked.formatted())
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            Text("quảng cáo đã chặn")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.white.opacity(0.75))

            Text(String(format: "~%.1f MB tiết kiệm", entry.bandwidthSavedMB))
                .font(.system(size: 10))
                .foregroundColor(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            content
                .containerBackground(for: .widget) { gradient }
        } else {
            content
                .padding(14)
                .background(gradient)
        }
    }
}

// MARK: - Bundle

struct KBlockStatsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KBlockStatsWidget", provider: StatsProvider()) { entry in
            KBlockWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("KBlock — Thống kê chặn")
        .description("Số quảng cáo đã chặn và dữ liệu tiết kiệm trên Safari.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct KBlockWidgetBundle: WidgetBundle {
    var body: some Widget {
        KBlockStatsWidget()
    }
}
