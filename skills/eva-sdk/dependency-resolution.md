# 依赖选择说明

依赖选择直接写在两个 catalog 中：

- Examples：`reference-sources.json` 中 `purpose: examples-catalog` source 的 `resolution`。
- SDK：`sdk-catalog.json` 中所选 SDK `distribution` 的 `resolution`。

`resolution` 是一个对象。固定模式不需要 `value`；带参数的模式必须填写非空字符串 `value`。

## Examples

| `mode` | 是否需要 `value` | `value` 示例 | 解析方式 |
| --- | --- | --- | --- |
| `latest-tag` | 否 | 无 | 列出官方 Git 仓库 tags，只接受严格 `X.Y.Z` 稳定 SemVer，选择数值最高的 tag。 |
| `tag` | 是 | `1.4.0` | 使用指定 tag；tag 不存在时停止，不回退到其他 tag 或 branch。 |
| `branch` | 是 | `feature/new-api` | 使用指定 branch 的 HEAD；branch 不存在时停止。运行时同时记录实际 commit，便于追溯。 |

示例：

```json
"resolution": {
  "mode": "branch",
  "value": "feature/new-api"
}
```

## SDK

| `mode` | 是否需要 `value` | `value` 示例 | 解析方式 |
| --- | --- | --- | --- |
| `latest-version` | 否 | 无 | 查询该 SDK distribution 的 `defaultChannel`，取得并锁定当时的精确包版本。 |
| `version` | 是 | `1.4.0` | 先确认官方 distribution 发布了该精确版本，再安装并锁定；不存在时停止。 |
| `local-package` | 是 | `/absolute/sdk.tgz` | 仅用于本机测试；验证本地包与 release manifest 的完整身份，不查询 registry。 |

示例：

```json
"resolution": {
  "mode": "version",
  "value": "1.4.0"
}
```

Registry distribution 把解析出的精确版本写入目标项目的 manifest/lock。`github-release` distribution 从官方 repository 的稳定 Release 解析无 `v` 的精确 SemVer tag，再把 catalog 中的 `{version}` 和 `{platform}` 展开为资产名；必须同时取得归档和对应 `.sha256`，校验通过后才能解压。记录 repository、tag、平台、资产名和 SHA-256，不使用 `/latest/download/` 或 GitHub 自动生成的 Source code 归档。

`local-package` 只支持 npm `.tgz`，并额外要求绝对 `manifest` 路径、`sha256`、`payloadDigest` 和完整 `sourceCommit`。使用前逐项核对 artifact bytes、release manifest、包内 `package.json` 的 package identity 与精确版本，并确认归档只有安全的 `package/` 根；路径不存在、摘要漂移、source dirty、manifest 与包内容不一致时停止，不回退到 npm。直接接入时保留本地 artifact 依赖并说明不可移植。运行 npm example 时先按 lock 恢复公开依赖，核对本地包声明的每个 dependency 都能从当前安装树解析到相同精确版本；在任务临时 staging 中组合本地包与匹配的既有依赖树，再仅替换 `node_modules` 中目标 SDK 包，确认 tracked manifest/lock 未变化。依赖缺失或版本不同就停止，不调用 npm install 重算依赖树或访问 registry。

直接接入 C++ SDK 时使用包内公开的 CMake config，并以 Release 版本做 EXACT 匹配。运行 example 时沿用 example 已声明的精确版本和自带准备入口，不在 skill 中另行选择另一个 Release。

## 发布前

正式发布前必须恢复：

```text
examples.resolution.mode = latest-tag
sdk distribution.resolution.mode = latest-version
```

发布校验不接受 `tag`、`branch`、`version` 或 `local-package` 作为发布配置。测试 branch 不需要把 commit 写回 catalog；commit 只作为本次运行证据记录。当前未发布 examples 使用 `branch: main`，TypeScript SDK 使用本地包，因此完整发布校验应失败；上线前分别恢复 `latest-tag` 和 `latest-version` 后再执行发布验收。
