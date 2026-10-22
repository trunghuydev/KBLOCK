# KBlock iOS Native App & Safari Extension Setup

This document provides instructions for generating, configuring, and building the KBlock iOS app and Safari Web Extension using Xcode on macOS.

---

## 1. Project Specifications

| Target | Value |
| :--- | :--- |
| **Project Name** | `KBlock` |
| **Minimum iOS Version** | iOS 15.0 (Deployment Target) |
| **Swift Version** | Swift 5.9+ |
| **Main App Bundle ID** | `dev.kblock.KBlock` |
| **Extension Bundle ID** | `dev.kblock.KBlock.Extension` |
| **App Group Identifier** | `group.dev.kblock.shared` |
| **Signing / Team** | Personal Team (Free Apple ID) or Developer Account |

---

## 2. Generating the Xcode Project on macOS

You can generate the complete `.xcodeproj` automatically using **XcodeGen**:

```bash
# 1. Install xcodegen if not already present
brew install xcodegen

# 2. Build the Safari extension JS bundle first
cd ../safari-extension
npm install
npm run build
cd ../ios

# 3. Generate Xcode project
xcodegen generate
```

This creates `KBlock.xcodeproj` with both the iOS host app and Safari Web Extension targets already wired up.

---

## 3. Alternative: Manual Xcode Project Creation

If configuring manually in Xcode GUI:

1. Open Xcode > **File** > **New** > **Project...**
2. Choose **iOS** > **App** (Swift, SwiftUI, Bundle ID `dev.kblock.KBlock`).
3. Add Target: **File** > **New** > **Target...** > **Safari Web Extension**.
   - Target Name: `Extension`
   - Bundle Identifier: `dev.kblock.KBlock.Extension`
4. Add **App Group** capability to both targets:
   - Target `KBlock` > Signing & Capabilities > `+ Capability` > **App Groups** > `group.dev.kblock.shared`.
   - Target `Extension` > Signing & Capabilities > `+ Capability` > **App Groups** > `group.dev.kblock.shared`.
5. Link Extension Resources:
   - In target `Extension` > Build Phases > **Run Script Phase**:
     ```bash
     rsync -av --delete "$PROJECT_DIR/../safari-extension/dist/" "$BUILT_PRODUCTS_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/Resources/"
     ```

---

## 4. Exporting IPA for SideStore

1. Select **Any iOS Device (arm64)** as destination.
2. Menu: **Product** > **Archive**.
3. In Organizer: **Distribute App** > **Development** or **Ad Hoc**.
4. Export options:
   - Include extension: **YES** (`dev.kblock.KBlock.Extension`).
5. Save the resulting `KBlock.ipa`.
6. Follow [sideloading.md](../docs/sideloading.md) to install via SideStore on your device.
