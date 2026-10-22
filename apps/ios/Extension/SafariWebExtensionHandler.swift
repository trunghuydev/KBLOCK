// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SafariServices
import os.log

let logger = Logger(subsystem: "dev.kblock.KBlock.Extension", category: "WebExtensionHandler")

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private let appGroupIdentifier = "group.dev.kblock.shared"

    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem,
              let userInfo = item.userInfo as? [String: Any],
              let message = userInfo[SFExtensionMessageKey] as? [String: Any] else {
            respond(with: ["status": "error", "message": "Invalid input"], context: context)
            return
        }

        logger.info("Received native message: \(String(describing: message))")

        let action = message["action"] as? String ?? ""

        switch action {
        case "ping":
            respond(with: ["status": "ok", "message": "pong"], context: context)

        case "getSharedState":
            let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier)
            let enabled = sharedDefaults?.bool(forKey: "kblock_enabled") ?? true
            let whitelist = sharedDefaults?.stringArray(forKey: "kblock_whitelist") ?? []
            respond(with: [
                "status": "ok",
                "enabled": enabled,
                "whitelist": whitelist
            ], context: context)

        case "syncWhitelist":
            if let domains = message["whitelist"] as? [String] {
                let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier)
                sharedDefaults?.set(domains, forKey: "kblock_whitelist")
                respond(with: ["status": "ok", "count": domains.count], context: context)
            } else {
                respond(with: ["status": "error", "message": "Missing domains payload"], context: context)
            }

        default:
            respond(with: ["status": "unknown_action", "action": action], context: context)
        }
    }

    private func respond(with data: [String: Any], context: NSExtensionContext) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: data]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
