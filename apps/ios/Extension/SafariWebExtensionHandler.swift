// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SafariServices
import os.log

let logger = Logger(subsystem: "dev.kblock.KBlock.Extension", category: "WebExtensionHandler")

/// Native messaging bridge between the Safari Web Extension and the app.
///
/// Protocol (message["action"]):
/// - `ping`                       → {status:"ok", message:"pong"}
/// - `getSharedState`             → full config + stats/activity + version
/// - `setSharedState` {payload}   → partial config patch; bumps version
/// - `updateStats` {payload}      → stats/activity JSON strings from extension
///
/// The extension owns stats/activity; the app owns config. `configVersion`
/// is bumped on every config write so the extension can detect changes.
@objc(SafariWebExtensionHandler)
public class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private static let appGroupIdentifier = "group.dev.kblock.shared"

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

    /// Falls back to the extension's own defaults when the App Group is not
    /// entitled — the extension stays functional standalone.
    private var sharedDefaults: UserDefaults {
        UserDefaults(suiteName: Self.appGroupIdentifier) ?? .standard
    }

    public func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem,
              let userInfo = item.userInfo as? [String: Any],
              let message = userInfo[SFExtensionMessageKey] as? [String: Any] else {
            respond(with: ["status": "error", "message": "Invalid input"], context: context)
            return
        }

        let action = message["action"] as? String ?? ""

        switch action {
        case "ping":
            respond(with: ["status": "ok", "message": "pong"], context: context)

        case "getSharedState":
            respond(with: buildSharedState(), context: context)

        case "setSharedState":
            applyConfigPatch(message["payload"] as? [String: Any])
            respond(with: [
                "status": "ok",
                "version": sharedDefaults.integer(forKey: Key.configVersion),
            ], context: context)

        case "updateStats":
            if let payload = message["payload"] as? [String: Any] {
                if let stats = payload["stats"] as? String {
                    sharedDefaults.set(stats, forKey: Key.stats)
                }
                if let activity = payload["activity"] as? String {
                    sharedDefaults.set(activity, forKey: Key.activity)
                }
                if let ruleCount = payload["ruleCount"] as? Int {
                    sharedDefaults.set(ruleCount, forKey: Key.ruleCount)
                }
            }
            respond(with: ["status": "ok"], context: context)

        default:
            respond(with: ["status": "unknown_action", "action": action], context: context)
        }
    }

    // MARK: - State building

    private func buildSharedState() -> [String: Any] {
        let d = sharedDefaults

        let categories: [String: Bool] = [
            "abpvn": d.object(forKey: Key.abpvn) as? Bool ?? true,
            "gambling": d.object(forKey: Key.gambling) as? Bool ?? true,
            "easylist": d.object(forKey: Key.easylist) as? Bool ?? true,
            "annoyances": d.object(forKey: Key.annoyances) as? Bool ?? true,
            "tracking": d.object(forKey: Key.tracking) as? Bool ?? true,
        ]

        var response: [String: Any] = [
            "status": "ok",
            "version": d.integer(forKey: Key.configVersion),
            "enabled": d.object(forKey: Key.enabled) as? Bool ?? true,
            "whitelist": d.stringArray(forKey: Key.whitelist) ?? [],
            "categories": categories,
            "antiPopupMode": d.string(forKey: Key.antiPopupMode) ?? "balanced",
            "antiTracking": d.object(forKey: Key.antiTracking) as? Bool ?? true,
            "cookieBanners": d.object(forKey: Key.cookieBanners) as? Bool ?? true,
            "autoUpdate": d.object(forKey: Key.autoUpdate) as? Bool ?? true,
        ]

        if let raw = d.string(forKey: Key.customRules),
           let data = raw.data(using: .utf8),
           let rules = try? JSONSerialization.jsonObject(with: data),
           JSONSerialization.isValidJSONObject(rules) {
            response["customRules"] = rules
        } else {
            response["customRules"] = [] as [[String: Any]]
        }

        if let raw = d.string(forKey: Key.elementRules),
           let data = raw.data(using: .utf8),
           let rules = try? JSONSerialization.jsonObject(with: data),
           JSONSerialization.isValidJSONObject(rules) {
            response["elementRules"] = rules
        } else {
            response["elementRules"] = [] as [[String: Any]]
        }

        if let raw = d.string(forKey: Key.stats),
           let data = raw.data(using: .utf8),
           let stats = try? JSONSerialization.jsonObject(with: data),
           JSONSerialization.isValidJSONObject(stats) {
            response["stats"] = stats
        }

        if let raw = d.string(forKey: Key.activity),
           let data = raw.data(using: .utf8),
           let activity = try? JSONSerialization.jsonObject(with: data),
           JSONSerialization.isValidJSONObject(activity) {
            response["activity"] = activity
        }

        return response
    }

    private func applyConfigPatch(_ payload: [String: Any]?) {
        guard let payload = payload else { return }
        let d = sharedDefaults

        if let enabled = payload["enabled"] as? Bool {
            d.set(enabled, forKey: Key.enabled)
        }
        if let whitelist = payload["whitelist"] as? [String] {
            d.set(whitelist, forKey: Key.whitelist)
        }
        if let categories = payload["categories"] as? [String: Any] {
            // Only overwrite the keys present in the patch.
            if let v = categories["abpvn"] as? Bool { d.set(v, forKey: Key.abpvn) }
            if let v = categories["gambling"] as? Bool { d.set(v, forKey: Key.gambling) }
            if let v = categories["easylist"] as? Bool { d.set(v, forKey: Key.easylist) }
            if let v = categories["annoyances"] as? Bool { d.set(v, forKey: Key.annoyances) }
            if let v = categories["tracking"] as? Bool { d.set(v, forKey: Key.tracking) }
        }
        if let mode = payload["antiPopupMode"] as? String {
            d.set(mode, forKey: Key.antiPopupMode)
        }
        if let antiTracking = payload["antiTracking"] as? Bool {
            d.set(antiTracking, forKey: Key.antiTracking)
        }
        if let cookieBanners = payload["cookieBanners"] as? Bool {
            d.set(cookieBanners, forKey: Key.cookieBanners)
        }
        if let autoUpdate = payload["autoUpdate"] as? Bool {
            d.set(autoUpdate, forKey: Key.autoUpdate)
        }
        if let rules = payload["customRules"] as? [[String: Any]],
           JSONSerialization.isValidJSONObject(rules),
           let data = try? JSONSerialization.data(withJSONObject: rules) {
            d.set(String(data: data, encoding: .utf8) ?? "[]", forKey: Key.customRules)
        }
        if let rules = payload["elementRules"] as? [[String: Any]],
           JSONSerialization.isValidJSONObject(rules),
           let data = try? JSONSerialization.data(withJSONObject: rules) {
            d.set(String(data: data, encoding: .utf8) ?? "[]", forKey: Key.elementRules)
        }

        let nextVersion = d.integer(forKey: Key.configVersion) + 1
        d.set(nextVersion, forKey: Key.configVersion)
        logger.info("Config patched, version -> \(nextVersion)")
    }

    // MARK: - Response helper

    private func respond(with data: [String: Any], context: NSExtensionContext) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: data]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
