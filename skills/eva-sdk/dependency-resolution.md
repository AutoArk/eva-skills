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

示例：

```json
"resolution": {
  "mode": "version",
  "value": "1.4.0"
}
```

## 发布前

正式发布前必须恢复：

```text
examples.resolution.mode = latest-tag
sdk distribution.resolution.mode = latest-version
```

发布校验不接受 `tag`、`branch` 或 `version` 作为发布配置。测试 branch 不需要把 commit 写回 catalog；commit 只作为本次运行证据记录。
