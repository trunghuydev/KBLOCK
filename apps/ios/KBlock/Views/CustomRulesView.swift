// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import SwiftUI

/// User-authored blocking/allowing rules — the AdGuard-style "My filters".
/// Rules become dynamic DNR rules in the extension via the App Group sync.
struct CustomRulesView: View {
    @ObservedObject var state = AppGroupManager.shared
    @State private var newPattern: String = ""
    @State private var newRuleIsAllow: Bool = false
    @State private var invalidInput: Bool = false

    var body: some View {
        List {
            Section(header: Text("Cú pháp hỗ trợ"), footer: syntaxFooter) {
                exampleRow(pattern: "sunwin.vip", meaning: "Chặn toàn bộ tên miền sunwin.vip")
                exampleRow(pattern: "||ads.example.com^", meaning: "Chặn theo cú pháp EasyList")
                exampleRow(pattern: "@@||cdn.site.com^", meaning: "Cho phép (không chặn) tên miền")
                exampleRow(pattern: "/banner-[0-9]+/", meaning: "Chặn theo biểu thức chính quy")
            }

            Section(header: Text("Thêm quy tắc")) {
                TextField("sunwin.vip hoặc ||ads.example.com^", text: $newPattern)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                    .font(.body)

                Toggle(isOn: $newRuleIsAllow) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Quy tắc cho phép")
                            .font(.subheadline)
                        Text("Bật = ngoại lệ (không chặn), Tắt = chặn")
                            .font(.caption)
                            .foregroundColor(KBlockTheme.textSecondary)
                    }
                }
                .toggleStyle(SwitchToggleStyle(tint: KBlockTheme.primary))

                Button(action: addRule) {
                    Label("Thêm quy tắc", systemImage: "plus.circle.fill")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .disabled(newPattern.trimmingCharacters(in: .whitespaces).isEmpty)
                .alert("Quy tắc không hợp lệ", isPresented: $invalidInput) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text("Quy tắc không được chứa khoảng trắng hoặc quá 500 ký tự.")
                }
            }

            Section(header: Text("Quy tắc ẩn phần tử (element picker)"), footer: elementFooter) {
                if state.elementRules.isEmpty {
                    Text("Chưa có quy tắc nào. Dùng nút \"Chặn phần tử trên trang này\" trong popup Safari để tạo.")
                        .foregroundColor(KBlockTheme.textSecondary)
                        .italic()
                } else {
                    ForEach(state.elementRules) { rule in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rule.selector)
                                .font(.system(.footnote, design: .monospaced))
                                .lineLimit(1)
                            Text(rule.host)
                                .font(.caption)
                                .foregroundColor(KBlockTheme.textSecondary)
                        }
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            state.removeElementRule(state.elementRules[index].id)
                        }
                    }
                }
            }

            Section(header: Text("Quy tắc của bạn (\(state.customRules.count))")) {
                if state.customRules.isEmpty {
                    Text("Chưa có quy tắc tùy chỉnh nào")
                        .foregroundColor(KBlockTheme.textSecondary)
                        .italic()
                } else {
                    ForEach(state.customRules) { rule in
                        HStack(spacing: 12) {
                            Image(systemName: rule.isAllow ? "hand.thumbsup.circle.fill" : "hand.thumbsdown.circle.fill")
                                .foregroundColor(rule.isAllow ? KBlockTheme.success : KBlockTheme.accent)
                                .font(.system(size: 20))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(rule.pattern)
                                    .font(.system(.body, design: .monospaced))
                                    .lineLimit(1)
                                Text(rule.isAllow ? "Cho phép" : "Chặn")
                                    .font(.caption)
                                    .foregroundColor(KBlockTheme.textSecondary)
                            }

                            Spacer()

                            Toggle("", isOn: Binding(
                                get: { rule.enabled },
                                set: { _ in state.toggleCustomRule(rule.id) }
                            ))
                            .labelsHidden()
                            .toggleStyle(SwitchToggleStyle(tint: KBlockTheme.primary))
                        }
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            state.removeCustomRule(state.customRules[index].id)
                        }
                    }
                }
            }
        }
        .navigationTitle("Bộ lọc tùy chỉnh")
    }

    private var syntaxFooter: some View {
        Text("Quy tắc được đồng bộ sang tiện ích Safari và áp dụng ngay cho mọi trang.")
    }

    private var elementFooter: some View {
        Text("Được tạo khi bạn chọn phần tử trực tiếp trên trang trong Safari.")
    }

    private func exampleRow(pattern: String, meaning: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(pattern)
                .font(.system(.footnote, design: .monospaced))
                .foregroundColor(KBlockTheme.primary)
            Text(meaning)
                .font(.caption)
                .foregroundColor(KBlockTheme.textSecondary)
        }
    }

    private func addRule() {
        let added = state.addCustomRule(pattern: newPattern, isAllow: newRuleIsAllow)
        if added {
            newPattern = ""
            newRuleIsAllow = false
        } else {
            invalidInput = true
        }
    }
}
