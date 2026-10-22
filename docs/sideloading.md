# KBlock SideStore Sideloading Guide

This guide explains how to install KBlock on iOS using [SideStore](https://sidestore.io/) without a paid Apple Developer Account.

---

## 1. Prerequisites and Limits

- **Free Apple ID Account**:
  - Maximum of **3 active sideloaded apps** per device.
  - Maximum of **10 App IDs** created per 7-day rolling window.
  - Certificates expire every **7 days** and must be refreshed via SideStore's local VPN (WireGuard loopback).
- **KBlock App ID Consumption**:
  - KBlock consists of **1 Main iOS App** + **1 Safari Web Extension**.
  - This setup consumes **2 App IDs** from your 7-day quota:
    1. Main app: `dev.kblock.KBlock`
    2. Safari Extension: `dev.kblock.KBlock.Extension`
  - SideStore manages nested extensions automatically *if instructed properly*.

---

## 2. Installation Steps via SideStore

### Step 1: Transfer the IPA to your iPhone
Send the compiled `KBlock.ipa` to your iPhone (via AirDrop, iCloud Drive, or local file transfer).

### Step 2: Ensure SideStore WireGuard VPN is Connected
- Open the **WireGuard** app.
- Turn on the **SideStore** VPN tunnel (enables local loopback to refresh apps).

### Step 3: Install KBlock in SideStore
1. Open **SideStore**.
2. Tap the **`+`** icon in the top-left corner.
3. Select `KBlock.ipa`.
4. **CRITICAL STEP — Keep App Extension**:
   - SideStore will prompt: *"This app contains app extensions. Would you like to keep them?"*
   - **YOU MUST SELECT "Keep App Extension"**.
   - If you tap "Remove", the Safari Web Extension will be stripped and KBlock cannot block ads in Safari!
5. Wait for SideStore to sign and install the app.

---

## 3. Post-Installation Setup in iOS Settings

Once installed:
1. Open **Settings** on your iPhone.
2. Tap **Safari** > **Extensions**.
3. Under *ALLOW THESE EXTENSIONS*, tap **KBlock**.
4. Switch the toggle to **ON**.
5. Under *PERMISSIONS*, select **All Websites** > set to **Allow** (or *Always Allow*).

---

## 4. Troubleshooting Common Issues

### Issue A: "Maximum number of apps reached"
- A free Apple ID allows only 3 sideloaded apps active at the same time.
- Deactivate an unused app in SideStore before installing KBlock.

### Issue B: "App ID limit exceeded"
- Apple enforces a 10 App ID per week limit.
- If you have installed/uninstalled multiple apps recently, wait until older App IDs expire (viewable in SideStore > Settings > Active App IDs).

### Issue C: Extension does not appear in Safari Settings
- Check if you accidentally chose "Remove Extension" during installation in SideStore.
- Uninstall KBlock and reinstall, making sure to choose **"Keep App Extension"**.
