// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SwiftUI

struct WhitelistView: View {
    @ObservedObject var state = AppGroupManager.shared
    @State private var newDomain: String = ""

    var body: some View {
        List {
            Section(header: Text("Hướng dẫn")) {
                Text("Các tên miền trong danh sách này sẽ KHÔNG bị chặn quảng cáo hoặc pop-up trong Safari (bao gồm cả sub-domain).")
                    .font(.footnote)
                    .foregroundColor(KBlockTheme.textSecondary)
            }

            // Inline add row — alert với TextField chỉ hoạt động trên iOS 16+.
            Section(header: Text("Thêm tên miền")) {
                HStack(spacing: 10) {
                    TextField("example.com", text: $newDomain)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                        .keyboardType(.URL)
                        .font(.body)

                    Button(action: addDomain) {
                        Text("Thêm")
                            .font(.body.weight(.semibold))
                            .foregroundColor(newDomain.isEmpty ? .gray : KBlockTheme.primary)
                    }
                    .disabled(newDomain.isEmpty)
                }
            }

            Section(header: Text("Tên miền được bỏ qua (\(state.whitelist.count))")) {
                if state.whitelist.isEmpty {
                    Text("Chưa có tên miền nào trong danh sách trắng")
                        .foregroundColor(KBlockTheme.textSecondary)
                        .italic()
                } else {
                    ForEach(state.whitelist, id: \.self) { domain in
                        HStack {
                            Image(systemName: "globe")
                                .foregroundColor(KBlockTheme.primary)
                            Text(domain)
                                .font(.body)
                        }
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            let domain = state.whitelist[index]
                            state.removeWhitelistDomain(domain)
                        }
                    }
                }
            }
        }
        .navigationTitle("Danh sách trắng")
    }

    private func addDomain() {
        state.addWhitelistDomain(newDomain)
        newDomain = ""
    }
}
