// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SwiftUI
import UIKit

/// Design tokens for KBlock iOS application — adaptive for light/dark mode.
public enum KBlockTheme {
    public static let primary = Color(red: 0x2D / 255.0, green: 0x6A / 255.0, blue: 0x4F / 255.0)       // #2d6a4f (Forest Green)
    public static let primaryDark = Color(red: 0x1B / 255.0, green: 0x43 / 255.0, blue: 0x32 / 255.0)   // #1b4332
    public static let accent = Color(red: 0xC9 / 255.0, green: 0x71 / 255.0, blue: 0x4A / 255.0)        // #c9714a (Terracotta)
    public static let success = Color(red: 0x40 / 255.0, green: 0x91 / 255.0, blue: 0x6C / 255.0)

    public static let background = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x12 / 255.0, green: 0x14 / 255.0, blue: 0x13 / 255.0, alpha: 1)
            : UIColor(red: 0xFA / 255.0, green: 0xF9 / 255.0, blue: 0xF6 / 255.0, alpha: 1) // #faf9f6 Warm Ivory
    })

    public static let surface = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x1E / 255.0, green: 0x21 / 255.0, blue: 0x1F / 255.0, alpha: 1)
            : .white
    })

    public static let textPrimary = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0xEC / 255.0, green: 0xEF / 255.0, blue: 0xED / 255.0, alpha: 1)
            : UIColor(red: 0x1F / 255.0, green: 0x24 / 255.0, blue: 0x21 / 255.0, alpha: 1)
    })

    public static let textSecondary = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x9A / 255.0, green: 0xA2 / 255.0, blue: 0x9C / 255.0, alpha: 1)
            : UIColor(red: 0x6C / 255.0, green: 0x75 / 255.0, blue: 0x7D / 255.0, alpha: 1)
    })

    public static let border = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0x2C / 255.0, green: 0x30 / 255.0, blue: 0x2D / 255.0, alpha: 1)
            : UIColor(red: 0xE8 / 255.0, green: 0xE6 / 255.0, blue: 0xE1 / 255.0, alpha: 1)
    })
}
