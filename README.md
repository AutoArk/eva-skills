# EVA Skills

用于沉淀 EVA 生态相关 agent skills 的公共仓库。每个 skill 聚焦一类可复用能力，并独立维护触发条件、执行协议、参考资料和验证案例；仓库统一提供发现、安装、质量校验与发布流程。

## 项目原则

- **单个 skill 自包含**：运行时需要的指令和资源放在对应的 `skills/<skill-name>/`，避免依赖仓库级说明才能使用。
- **总览与细节分层**：本 README 只维护项目定位、skill 目录和仓库级流程；某个 skill 的能力边界与实现细节在其目录项中按需展开。
- **安装单位独立**：仓库可以同时维护多个 skill，用户先查看目录，再通过 `--skill <skill-name>` 安装所需能力。
- **判定尽量自动化**：通用格式、catalog、协议和安装完整性由脚本与 CI 检查；真实登录、凭证授权和产品体验保留人工确认。
- **发布快照可追溯**：正式版本采用仓库级 SemVer tag，公开 tag 不覆盖、不移动。

## Skills 目录

先查看仓库中可安装的 skills：

```bash
npx skills add AutoArk/eva-skills --list
```

安装选定的 skill：

```bash
npx skills add AutoArk/eva-skills --skill <skill-name>
```

更新已经安装的 skill：

```bash
npx skills update <skill-name>
```

当前目录：

| Skill | 能力概览 |
| --- | --- |
| `eva-sdk` | 定位 EVA SDK 与官方 Demo，支持 SDK 接入、Demo 运行、EVA CLI 凭证流程、定制与验证排障。 |

<details>
<summary><code>eva-sdk</code> 详细说明</summary>

### 使用方式

```bash
npx skills add AutoArk/eva-skills --skill eva-sdk
```

CI 或其他非交互环境可在安装命令后追加 `--copy --yes`。

### 能力边界

- 直接从已发布 SDK 接入现有应用，不要求先运行 Demo。
- 根据用户提供的 SDK、语言和平台条件定位候选 Demo，并在用户确认候选及工作目录后执行。
- 通过 EVA CLI 完成登录状态检查、工作目录初始化和 AK 路径获取；AK 文件内容始终作为不透明凭证处理。
- 根据目标发布物、example 和平台选择依赖恢复、构建、运行与验证方式，不把 TypeScript 工具链泛化为所有 SDK 的固定流程。

### 当前 SDK 覆盖

| SDK | 语言 / 平台 | 官方分发 |
| --- | --- | --- |
| Client SDK | TypeScript / Browser | [`@autoark-ai/eva-client-sdk-ts`](https://www.npmjs.com/package/@autoark-ai/eva-client-sdk-ts) |

SDK catalog 不保存版本号。新接入默认从官方 distribution 的 `latest` channel 解析当时的精确版本并锁定；已有项目默认保留当前解析版本。

### 设计说明

- `sdk-catalog.json` 描述当前可直接接入的公开 SDK；`reference-sources.json` 维护外部参考来源，其中官方 Demo catalog 固定 immutable ref 和 commit。
- Demo 请求无论只命中一个还是多个候选，都先展示描述和路径，让用户确认候选及最终目录。
- `references/cli.md` 是 EVA CLI 精确命令和顺序的唯一权威来源，其他运行时文档只负责链接和路由。

</details>

## 仓库结构

```text
skills/<skill-name>/         可安装的 runtime skill
  SKILL.md                   触发条件与核心工作流
  agents/openai.yaml         UI metadata
  references/               按需加载的执行协议与参考资料
evals/<skill-name>.json      结构化行为案例
scripts/                     仓库级校验与安装 smoke test
docs/                        维护与发布规范
```

具体 skill 可以按需增加 catalog、reference registry、scripts 或 assets，不要求所有 skill 使用相同的内部文件结构。

## 本地验证

不联网的确定性检查：

```bash
node --test scripts/*.test.mjs
node scripts/validate-evals.mjs
node scripts/validate-brand-style.mjs
node scripts/validate-cli-protocol.mjs
node scripts/validate-sdk-catalog.mjs
```

需要联网的兼容性检查：

```bash
node scripts/smoke-install-skill.mjs
node scripts/validate-sdk-catalog.mjs --live
node scripts/validate-release.mjs --skip-build
```

现有校验脚本会根据其职责检查对应 skill；新增 skill 时，应同步增加适用的 eval 和确定性校验，而不是默认复用 `eva-sdk` 的领域规则。

## 维护与发布

正式发布采用仓库级 SemVer tag，并将公开 tag 视为不可变快照。完整的发布门槛、人工权限边界、命令顺序和异常处理见 [Skill 发布规范](docs/releasing.md)。

## License

本仓库中的 skills、catalog、文档与校验工具采用 [MIT License](LICENSE)。EVA SDK、EVA CLI、外部 Demo 和其他被引用或分发的软件分别受其自身许可证约束；本仓库的 MIT License 不替代或扩大这些软件授予的权利。
