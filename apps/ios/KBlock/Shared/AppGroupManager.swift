// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Foundation
import SwiftUI

/// Single source of truth for KBlock configuration.
///
/// The app writes config here; the Safari Web Extension pulls it through
/// `SafariWebExtensionHandler` (native messaging) keyed by `configVersion`,
/// and pushes stats/activity back. Without the App Group entitlement this
/// class degrades to in-memory state and `hasAppGroup` stays false so the UI
/// can warn the user.
public final class AppGroupManager: ObservableObject {
    public static let shared = AppGroupManager()

    public static let appGroupIdentifier = "group.dev.kblock.shared"

    /// Real counts of the bundled static DNR rulesets (kept in sync with
    /// apps/safari-extension/src/rules/*.json).
    public static let bundledAbpvnRules = 25
    public static let bundledGamblingRules = 25
    public static let bundledEasylistRules = 37

    private let defaults: UserDefaults?
    private var isRestoring = false

    public var hasAppGroup: Bool { defaults != nil }

    // MARK: Config (app-owned; every change bumps configVersion)

    @Published public var isEnabled: Bool = true { didSet { persist() } }
    @Published public var whitelist: [String] = [] { didSet { persist() } }
    @Published public var filterAbpvn: Bool = true { didSet { persist() } }
    @Published public var filterGambling: Bool = true { didSet { persist() } }
    @Published public var filterEasylist: Bool = true { didSet { persist() } }
    @Published public var filterAnnoyances: Bool = true { didSet { persist() } }
    @Published public var filterTracking: Bool = true { didSet { persist() } }
    @Published public var antiPopupMode: String = "balanced" { didSet { persist() } }
    @Published public var antiTracking: Bool = true { didSet { persist() } }
    @Published public var cookieBanners: Bool = true { didSet { persist() } }
    @Published public var autoUpdate: Bool = true { didSet { persist() } }
    @Published public var customRules: [CustomFilterRule] = [] { didSet { persist() } }
    @Published public var elementRules: [ElementFilterRule] = [] { didSet { persist() } }

    // MARK: Data owned by the extension (read-only here)

    @Published public private(set) var stats: BlockStats = .empty
    @Published public private(set) var activity: [BlockedEvent] = []
    /// Total active rules reported by the extension (bundled + dynamic).
    @Published public private(set) var extensionRuleCount: Int = 0

    private enum Key {
        static let configVersion = "kblock_config_version"
        static let enabled = "kblock_enabled"
        static let whitelist = "kblock_whitelist"
        static let abpvn = "kblock_filter_abpvn"
        static let gambling = "kblock_filter_gambling"
        static let easylist = "kblock_filter_easylist"
        static let annoyances = "kblock_filter_annoyances"
        static let tracking = "kblock_filter_tracking"
        static let antiPopupMode = "kblock_antipopup_mode"
        static let antiTracking = "kblock_anti_tracking"
        static let cookieBanners = "kblock_cookie_banners"
        static let autoUpdate = "kblock_auto_update"
        static let customRules = "kblock_custom_rules"
        static let elementRules = "kblock_element_rules"
        static let stats = "kblock_stats"
        static let activity = "kblock_activity"
        static let ruleCount = "kblock_rule_count"
    }

    private init() {
        defaults = UserDefaults(suiteName: Self.appGroupIdentifier)
        _restore()
    }

    // MARK: Derived numbers

    /// Bundled static rules currently enabled.
    public var totalActiveRules: Int {
        guard isEnabled else { return 0 }
        var sum = 0
        if filterAbpvn { sum += Self.bundledAbpvnRules }
        if filterGambling { sum += Self.bundledGamblingRules }
        if filterEasylist { sum += Self.bundledEasylistRules }
        return sum
    }

    /// Dynamic rules: whitelist sites + enabled custom rules.
    public var dynamicRuleCount: Int {
        guard isEnabled else { return 0 }
        return whitelist.count + customRules.filter { $0.enabled }.count
    }

    // MARK: Whitelist

    public func addWhitelistDomain(_ domain: String) {
        let clean = domain
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "^https?://", with: "", options: .regularExpression)
            .replacingOccurrences(of: "^www\\.", with: "", options: .regularExpression)
            .replacingOccurrences(of: "/.*$", with: "", options: .regularExpression)
        guard !clean.isEmpty, clean.contains(".") else { return }
        guard !whitelist.contains(where: { $0 == clean || clean.hasSuffix(".\($0)") }) else { return }
        whitelist.append(clean)
    }

    public func removeWhitelistDomain(_ domain: String) {
        whitelist.removeAll { $0 == domain }
    }

    // MARK: Custom rules

    public static func isValidCustomPattern(_ pattern: String) -> Bool {
        let trimmed = pattern.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= 500 else { return false }
        return !trimmed.contains(where: { $0.isWhitespace })
    }

    public func addCustomRule(pattern: String, isAllow: Bool) -> Bool {
        guard Self.isValidCustomPattern(pattern) else { return false }
        let trimmed = pattern.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !customRules.contains(where: { $0.pattern == trimmed }) else { return false }
        let rule = CustomFilterRule(
            id: UUID().uuidString,
            pattern: trimmed,
            isAllow: isAllow,
            enabled: true,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        customRules.append(rule)
        return true
    }

    public func removeCustomRule(_ id: String) {
        customRules.removeAll { $0.id == id }
    }

    public func toggleCustomRule(_ id: String) {
        guard let index = customRules.firstIndex(where: { $0.id == id }) else { return }
        customRules[index].enabled.toggle()
    }

    public func removeElementRule(_ id: String) {
        elementRules.removeAll { $0.id == id }
    }

    // MARK: Persistence

    private func persist() {
        guard !isRestoring, let defaults = defaults else { return }
        defaults.set(defaults.integer(forKey: Key.configVersion) + 1, forKey: Key.configVersion)
        defaults.set(isEnabled, forKey: Key.enabled)
        defaults.set(whitelist, forKey: Key.whitelist)
        defaults.set(filterAbpvn, forKey: Key.abpvn)
        defaults.set(filterGambling, forKey: Key.gambling)
        defaults.set(filterEasylist, forKey: Key.easylist)
        defaults.set(filterAnnoyances, forKey: Key.annoyances)
        defaults.set(filterTracking, forKey: Key.tracking)
        defaults.set(antiPopupMode, forKey: Key.antiPopupMode)
        defaults.set(antiTracking, forKey: Key.antiTracking)
        defaults.set(cookieBanners, forKey: Key.cookieBanners)
        defaults.set(autoUpdate, forKey: Key.autoUpdate)
        if let data = try? JSONEncoder().encode(customRules) {
            defaults.set(String(data: data, encoding: .utf8) ?? "[]", forKey: Key.customRules)
        }
        if let data = try? JSONEncoder().encode(elementRules) {
            defaults.set(String(data: data, encoding: .utf8) ?? "[]", forKey: Key.elementRules)
        }
    }

    /// Re-read everything from the App Group (call when app becomes active).
    public func refresh() {
        _restore()
    }

    private func _restore() {
        isRestoring = true
        defer { isRestoring = false }

        isEnabled = defaults?.object(forKey: Key.enabled) as? Bool ?? true
        whitelist = defaults?.stringArray(forKey: Key.whitelist) ?? []
        filterAbpvn = defaults?.object(forKey: Key.abpvn) as? Bool ?? true
        filterGambling = defaults?.object(forKey: Key.gambling) as? Bool ?? true
        filterEasylist = defaults?.object(forKey: Key.easylist) as? Bool ?? true
        filterAnnoyances = defaults?.object(forKey: Key.annoyances) as? Bool ?? true
        filterTracking = defaults?.object(forKey: Key.tracking) as? Bool ?? true
        antiPopupMode = defaults?.string(forKey: Key.antiPopupMode) ?? "balanced"
        antiTracking = defaults?.object(forKey: Key.antiTracking) as? Bool ?? true
        cookieBanners = defaults?.object(forKey: Key.cookieBanners) as? Bool ?? true
        autoUpdate = defaults?.object(forKey: Key.autoUpdate) as? Bool ?? true

        if let json = defaults?.string(forKey: Key.customRules),
           let data = json.data(using: .utf8),
           let rules = try? JSONDecoder().decode([CustomFilterRule].self, from: data) {
            customRules = rules
        } else {
            customRules = []
        }

        if let json = defaults?.string(forKey: Key.elementRules),
           let data = json.data(using: .utf8),
           let rules = try? JSONDecoder().decode([ElementFilterRule].self, from: data) {
            elementRules = rules
        } else {
            elementRules = []
        }

        if let json = defaults?.string(forKey: Key.stats),
           let data = json.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(BlockStats.self, from: data) {
            stats = decoded
        } else {
            stats = .empty
        }

        if let json = defaults?.string(forKey: Key.activity),
           let data = json.data(using: .utf8),
           let events = try? JSONDecoder().decode([BlockedEvent].self, from: data) {
            activity = events
        } else {
            activity = []
        }

        extensionRuleCount = defaults?.object(forKey: Key.ruleCount) as? Int ?? 0
    }
}
