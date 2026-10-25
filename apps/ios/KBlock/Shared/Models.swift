// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Foundation

// MARK: - BlockStats

/// Blocking statistics owned by the Safari extension and mirrored into the
/// App Group so the app can display them. Mirrors the TS `BlockStats` shape.
public struct BlockStats: Codable, Equatable {
    public var totalBlocked: Int
    public var sessionBlocked: Int
    public var adsBlocked: Int
    public var trackersBlocked: Int
    public var popupsBlocked: Int
    public var bandwidthSavedMB: Double
    public var lastResetDate: String?

    public static let empty = BlockStats(
        totalBlocked: 0,
        sessionBlocked: 0,
        adsBlocked: 0,
        trackersBlocked: 0,
        popupsBlocked: 0,
        bandwidthSavedMB: 0,
        lastResetDate: nil
    )

    public init(
        totalBlocked: Int,
        sessionBlocked: Int,
        adsBlocked: Int,
        trackersBlocked: Int,
        popupsBlocked: Int,
        bandwidthSavedMB: Double,
        lastResetDate: String?
    ) {
        self.totalBlocked = totalBlocked
        self.sessionBlocked = sessionBlocked
        self.adsBlocked = adsBlocked
        self.trackersBlocked = trackersBlocked
        self.popupsBlocked = popupsBlocked
        self.bandwidthSavedMB = bandwidthSavedMB
        self.lastResetDate = lastResetDate
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        totalBlocked = try container.decodeIfPresent(Int.self, forKey: .totalBlocked) ?? 0
        sessionBlocked = try container.decodeIfPresent(Int.self, forKey: .sessionBlocked) ?? 0
        adsBlocked = try container.decodeIfPresent(Int.self, forKey: .adsBlocked) ?? 0
        trackersBlocked = try container.decodeIfPresent(Int.self, forKey: .trackersBlocked) ?? 0
        popupsBlocked = try container.decodeIfPresent(Int.self, forKey: .popupsBlocked) ?? 0
        bandwidthSavedMB = try container.decodeIfPresent(Double.self, forKey: .bandwidthSavedMB) ?? 0
        lastResetDate = try container.decodeIfPresent(String.self, forKey: .lastResetDate)
    }
}

// MARK: - CustomFilterRule

/// A user-authored rule. Mirrors the TS `CustomRule` shape exactly so the
/// JSON stored in the App Group round-trips between Swift and TypeScript.
public struct CustomFilterRule: Codable, Equatable, Identifiable {
    public var id: String
    public var pattern: String
    public var isAllow: Bool
    public var enabled: Bool
    public var createdAt: String

    public init(id: String, pattern: String, isAllow: Bool, enabled: Bool, createdAt: String) {
        self.id = id
        self.pattern = pattern
        self.isAllow = isAllow
        self.enabled = enabled
        self.createdAt = createdAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        pattern = try container.decodeIfPresent(String.self, forKey: .pattern) ?? ""
        isAllow = try container.decodeIfPresent(Bool.self, forKey: .isAllow) ?? false
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
    }
}

// MARK: - ElementFilterRule

/// A cosmetic rule produced by the element picker, scoped to one host.
/// Mirrors the TS `ElementRule` shape.
public struct ElementFilterRule: Codable, Equatable, Identifiable {
    public var id: String
    public var host: String
    public var selector: String
    public var createdAt: String
    public var enabled: Bool

    public init(id: String, host: String, selector: String, createdAt: String, enabled: Bool) {
        self.id = id
        self.host = host
        self.selector = selector
        self.createdAt = createdAt
        self.enabled = enabled
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        host = try container.decodeIfPresent(String.self, forKey: .host) ?? ""
        selector = try container.decodeIfPresent(String.self, forKey: .selector) ?? ""
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
    }
}

// MARK: - BlockedEvent

/// One intercepted popup/redirect/clickjack event from the activity log.
public struct BlockedEvent: Codable, Equatable, Identifiable {
    public var type: String
    public var host: String
    public var url: String
    public var at: String

    public var id: String { "\(at)|\(type)|\(url)" }

    public init(type: String, host: String, url: String, at: String) {
        self.type = type
        self.host = host
        self.url = url
        self.at = at
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decodeIfPresent(String.self, forKey: .type) ?? "popup"
        host = try container.decodeIfPresent(String.self, forKey: .host) ?? ""
        url = try container.decodeIfPresent(String.self, forKey: .url) ?? ""
        at = try container.decodeIfPresent(String.self, forKey: .at) ?? ""
    }
}
