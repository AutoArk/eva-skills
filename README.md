# Eva Skills

面向 Eva SDK 使用者的 agent skill 仓库。当前提供 `eva-sdk`：既能从已发布 SDK 直接接入现有应用，也能在用户确认后定位并运行与本 skill release 固定的官方 Demo。

## 核心设计

- **SDK catalog 与 Demo catalog 分离**：`sdk-catalog.json` 描述当前可直接接入的公开 SDK；`reference-sources.json` 固定外部 Demo catalog 的 immutable ref/commit。Demo 不是 SDK 接入的前置条件。
- **先选后执行**：Demo 请求无论只命中一个还是多个候选，都先展示描述和路径，并让用户确认候选及最终目录，避免未来 catalog 扩大后启动错误目标。
- **语言与工具链无关**：skill 维护路由、边界和完成判定；具体依赖恢复、构建、启动与运行观测由所选发布物、example 和目标平台决定。
- **AK 路径不透明**：agent 只把 Eva CLI 返回的路径交给公开启动入口，不读取、显示、复制或解析 AK 文件内容。

## 安装

仓库公开后，可用 [skills CLI](https://github.com/vercel-labs/skills) 安装到当前项目：

```bash
npx skills@latest add AutoArk/eva-skills --skill eva-sdk --agent codex
```

更新已安装 skill：

```bash
npx skills@latest update eva-sdk
```

CI 或其他非交互环境可在安装命令后追加 `--copy --yes`。仓库当前尚未关联远端或发布 release，以上公网安装命令需在发布后验证。

## 当前 SDK 覆盖

| SDK | 语言 / 平台 | 官方分发 |
| --- | --- | --- |
| Client SDK | TypeScript / Browser | [`@autoark-ai/eva-client-sdk-ts`](https://www.npmjs.com/package/@autoark-ai/eva-client-sdk-ts) |

SDK catalog 不保存版本号。新接入默认从官方 distribution 的 `latest` channel 解析当时的精确版本并锁定；已有项目默认保留当前解析版本。

## 仓库结构

```text
skills/eva-sdk/              可安装的 runtime skill
  SKILL.md                   轻量控制面、安全边界与工作流路由
  sdk-catalog.json           已发布 SDK 的公开入口目录
  reference-sources.json     immutable 外部依据 registry
  references/               按需加载的执行协议
evals/eva-sdk.json           结构化行为案例
scripts/                     catalog、协议、release 与安装校验
```

`references/cli.md` 是 Eva CLI 精确命令和顺序的唯一权威来源；其他运行时文档只链接并执行它，避免同一协议出现多个会漂移的副本。

## 本地验证

不联网的确定性检查：

```bash
node --test scripts/*.test.mjs
node scripts/validate-evals.mjs
node scripts/validate-cli-protocol.mjs
node scripts/validate-sdk-catalog.mjs
```

需要联网的兼容性检查：

```bash
node scripts/smoke-install-skill.mjs
node scripts/validate-sdk-catalog.mjs --live
node scripts/validate-release.mjs --skip-build
```

安装 smoke test 会在临时项目中通过 skills CLI 安装本地仓库，并逐文件比较安装结果；不会调用 Eva CLI、读取 AK 或启动 Demo。
