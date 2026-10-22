// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SwiftUI

struct WhitelistView: View {
    @ObservedObject var state = AppGroupManager.shared
    @State private var newDomain: String = ""
    @State private var showingAddAlert = false

    var body: some View {
        List {
            Section(header: Text("Hướng dẫn")) {
                Text("Các tên miền trong danh sách này sẽ không bị chặn quảng cáo hoặc pop-up trong Safari.")
                    .font(.footnote)
                    .foregroundColor(KBlockTheme.textSecondary)
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
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showingAddAlert = true }) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(KBlockTheme.primary)
                }
            }
        }
        .alert("Thêm tên miền", isPresented: $showingAddAlert) {
            TextField("example.com", text: $newDomain)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
            Button("Thêm", action: {
                if !newDomain.isEmpty {
                    state.addWhitelistDomain(newDomain)
                    newDomain = ""
                }
            })
            Button("Hủy", role: .cancel) {
                newDomain = ""
            }
        } message: {
            Text("Nhập tên miền bạn muốn tắt chặn (ví dụ: dantri.com.vn)")
        }
    }
}
