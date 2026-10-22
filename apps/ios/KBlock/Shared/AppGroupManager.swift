// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Foundation
import SwiftUI

/// Manages shared state between the KBlock iOS App and Safari Web Extension
/// via App Group (`group.dev.kblock.shared`).
public class AppGroupManager: ObservableObject {
    public static let shared = AppGroupManager()

    public static let appGroupIdentifier = "group.dev.kblock.shared"

    private let defaults: UserDefaults?

    @Published public var isEnabled: Bool {
        didSet { defaults?.set(isEnabled, forKey: "kblock_enabled") }
    }

    @Published public var whitelist: [String] {
        didSet { defaults?.set(whitelist, forKey: "kblock_whitelist") }
    }

    @Published public var blockedCount: Int {
        didSet { defaults?.set(blockedCount, forKey: "kblock_blocked_count") }
    }

    @Published public var popupsBlocked: Int {
        didSet { defaults?.set(popupsBlocked, forKey: "kblock_popups_count") }
    }

    @Published public var bandwidthSavedMB: Double {
        didSet { defaults?.set(bandwidthSavedMB, forKey: "kblock_bandwidth_saved_mb") }
    }

    // Filter Categories
    @Published public var filterAbpvn: Bool {
        didSet { defaults?.set(filterAbpvn, forKey: "kblock_filter_abpvn") }
    }

    @Published public var filterGambling: Bool {
        didSet { defaults?.set(filterGambling, forKey: "kblock_filter_gambling") }
    }

    @Published public var filterEasylist: Bool {
        didSet { defaults?.set(filterEasylist, forKey: "kblock_filter_easylist") }
    }

    @Published public var filterAnnoyances: Bool {
        didSet { defaults?.set(filterAnnoyances, forKey: "kblock_filter_annoyances") }
    }

    @Published public var antiPopupMode: String {
        didSet { defaults?.set(antiPopupMode, forKey: "kblock_antipopup_mode") }
    }

    public var totalActiveRules: Int {
        guard isEnabled else { return 0 }
        var sum = 0
        if filterAbpvn { sum += 8420 }
        if filterGambling { sum += 5120 }
        if filterEasylist { sum += 48500 }
        if filterAnnoyances { sum += 6300 }
        return sum
    }

    private init() {
        self.defaults = UserDefaults(suiteName: AppGroupManager.appGroupIdentifier)

        self.isEnabled = defaults?.object(forKey: "kblock_enabled") as? Bool ?? true
        self.whitelist = defaults?.stringArray(forKey: "kblock_whitelist") ?? []
        self.blockedCount = defaults?.integer(forKey: "kblock_blocked_count") ?? 142
        self.popupsBlocked = defaults?.integer(forKey: "kblock_popups_count") ?? 18
        self.bandwidthSavedMB = defaults?.double(forKey: "kblock_bandwidth_saved_mb") ?? 28.5

        self.filterAbpvn = defaults?.object(forKey: "kblock_filter_abpvn") as? Bool ?? true
        self.filterGambling = defaults?.object(forKey: "kblock_filter_gambling") as? Bool ?? true
        self.filterEasylist = defaults?.object(forKey: "kblock_filter_easylist") as? Bool ?? true
        self.filterAnnoyances = defaults?.object(forKey: "kblock_filter_annoyances") as? Bool ?? true
        self.antiPopupMode = defaults?.string(forKey: "kblock_antipopup_mode") ?? "balanced"
    }

    public func addWhitelistDomain(_ domain: String) {
        let clean = domain.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !clean.isEmpty, !whitelist.contains(clean) else { return }
        whitelist.append(clean)
    }

    public func removeWhitelistDomain(_ domain: String) {
        whitelist.removeAll { $0 == domain }
    }

    public func refresh() {
        self.isEnabled = defaults?.object(forKey: "kblock_enabled") as? Bool ?? true
        self.whitelist = defaults?.stringArray(forKey: "kblock_whitelist") ?? []
        self.blockedCount = defaults?.integer(forKey: "kblock_blocked_count") ?? 142
        self.popupsBlocked = defaults?.integer(forKey: "kblock_popups_count") ?? 18
        self.bandwidthSavedMB = defaults?.double(forKey: "kblock_bandwidth_saved_mb") ?? 28.5
        self.filterAbpvn = defaults?.object(forKey: "kblock_filter_abpvn") as? Bool ?? true
        self.filterGambling = defaults?.object(forKey: "kblock_filter_gambling") as? Bool ?? true
        self.filterEasylist = defaults?.object(forKey: "kblock_filter_easylist") as? Bool ?? true
        self.filterAnnoyances = defaults?.object(forKey: "kblock_filter_annoyances") as? Bool ?? true
    }
}
