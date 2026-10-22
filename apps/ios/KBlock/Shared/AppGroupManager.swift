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
        didSet {
            defaults?.set(isEnabled, forKey: "kblock_enabled")
        }
    }

    @Published public var whitelist: [String] {
        didSet {
            defaults?.set(whitelist, forKey: "kblock_whitelist")
        }
    }

    @Published public var blockedCount: Int {
        didSet {
            defaults?.set(blockedCount, forKey: "kblock_blocked_count")
        }
    }

    @Published public var activeFilterLists: [String] {
        didSet {
            defaults?.set(activeFilterLists, forKey: "kblock_active_filters")
        }
    }

    private init() {
        self.defaults = UserDefaults(suiteName: AppGroupManager.appGroupIdentifier)

        // Read initial values or fallback to defaults
        self.isEnabled = defaults?.object(forKey: "kblock_enabled") as? Bool ?? true
        self.whitelist = defaults?.stringArray(forKey: "kblock_whitelist") ?? []
        self.blockedCount = defaults?.integer(forKey: "kblock_blocked_count") ?? 0
        self.activeFilterLists = defaults?.stringArray(forKey: "kblock_active_filters") ?? [
            "abpvn",
            "easylist"
        ]
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
        self.blockedCount = defaults?.integer(forKey: "kblock_blocked_count") ?? 0
    }
}
