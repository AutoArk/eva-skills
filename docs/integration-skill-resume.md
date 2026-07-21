# Eva SDK 接入 skill 续跑入口

> 状态：历史设计快照；首版 skill 已形成，当前运行时真相源转为 `skills/eva-sdk/`。
> 更新日期：2026-07-20。
> 当前阶段：已固定 `AutoArk/eva-sdk-examples@0.0.1`（commit `ced3604d7ac1d694a4dda9d4b3da8124357f1439`），待实现 release validator、结构化 eval 与发布流程。
> 维护方式：本文不再维护；后续协议修改直接更新 `skills/eva-sdk/`，进度与续跑入口更新仓库根 `HANDOFF.md`。
> 阅读警告：下文的 TypeScript/npm/browser/URL 等表述记录的是当时唯一 example 的具体形态，不是当前 skill 的通用协议，不得据此约束未来 catalog 路由。

## 1. 当前结论

### 1.1 产品定位

目标是一个面向外部接入方的 **Eva SDK integration skill**，不是 SDK 维护 skill，也不属于单一 SDK family、语言或平台。

- skill 统一覆盖 Eva Cloud SDK、Client SDK，以及未来进入官方 examples catalog 的其他 SDK family、语言和平台。
- skill 不在自身内部维护“有哪些 SDK / 语言 / 平台 / demo”的静态矩阵；当前 skill release 固定的 examples tag 下 `examples.json` 是该快照可用能力的唯一目录。
- 当前 catalog 只有 TypeScript Client SDK demo 时，skill 只能启用该路由；Cloud SDK、Flutter、ESP32 等未出现在 catalog 前，不得根据其他实现猜测其 API 或流程。
- skill 只操作已发布 SDK 的公共接口、公共类型、公共配置和正式扩展点。
- skill 不读取或修改 SDK internal 模块，不指导接入方绕过 public facade，也不承载 OpenSpec / C4 / ADR / SDK 源码施工流程。

一句话定位：

> 从与当前 skill release 配套的官方 Eva SDK examples 快照中选择任意已收录 SDK family、语言和平台的 demo，帮助接入方启动并看到真实效果，再以该 demo 为可执行基线指导现有应用接入和修改。

### 1.2 Demo 的角色

Demo 是 skill 的首要产品入口和已知正确基线。

- 新用户可在安装 skill 后，用一句自然语言请求选择并启动当前官方 examples 快照中的可用 demo。
- demo 用于证明 package、浏览器、Gateway 和设备环境可用，并作为接入现有项目时的对照源。
- 已有可工作基线的用户可以跳过首次启动，直接以配套 demo 为参考进入现有项目接入或修改。
- 简单 API 问答不应强制生成 demo。

目标使用路径：

```text
Run Official Demo
  -> See Real Effect
  -> Integrate into Existing App
  -> Modify Public Configuration / Controls / UI / Extensions
  -> Verify and Troubleshoot
```

### 1.3 Skill 的任务范围

skill 聚焦三类外部任务：

1. `run-demo`：读取配套 examples 快照的 catalog，选择用户需要的 SDK family、语言 / 平台 demo，取得 CLI 提供的 AK 文件路径，构建、启动并帮助用户看到真实效果。
2. `integrate`：检查用户项目，以配套官方 example 为 executable oracle 建立 source-to-target 职责映射，再做最小接入修改。
3. `customize`：基于 example 和已发布公共面指导用户修改模型、prompt、greeting、VAD、history、控制、事件展示、UI 与正式扩展点，并在过程中处理构建和运行故障。

### 1.4 明确边界

允许使用：

- 正式发布 package 的 `exports`、`.d.ts`、README 和公共 API 文档。
- 当前 skill release 固定的官方 examples tag，以及该快照中的 catalog、原生 manifest / lockfile、接入文档和验证材料。
- public facade、公开事件 / 消息 / 错误、公开配置和正式 SPI。
- 面向消费者的 typecheck、build、browser runtime 和真实设备验证。

禁止使用：

- SDK `src/**`、internal subpath、DialogueRuntime、frame、stage provider、Gateway transport 等内部实现。
- 未公开的 `baseUrl`、endpoint、fetch、headers、provider 注入或测试 seam。
- 修改 SDK 源码来满足普通接入需求。
- 用源码仓测试通过代替正式 package 的消费者验证。
- 根据训练数据、自由网页搜索或其他语言实现臆造当前 package API。
- 绕过当前 skill 固定的 examples tag 改用 `main`、registry `latest` 或自由搜索所得代码。
- 读取、显示、复制、解析或转录 CLI 生成的 AK 文件内容，或要求用户把 AK 粘贴进对话。

## 2. 代码与文档的归属

skill 内不保存 demo 工程、框架模板或成套接入代码。skill 只固定一个官方 examples Git tag，并保持为启动、接入和修改流程的轻量控制面。

```text
Integration skill
  固定一个 examplesRef；负责选择、启动、接入、修改、guardrails 和验证
        |
        v
Official examples repository @ immutable tag
  examples.json 发现本快照的 example；各 example 携带代码、文档和原生 manifest / lockfile
        |
        v
Published SDK packages
  由各 example 的 manifest / lockfile 固定实际版本；提供 public runtime、exports、类型声明和运行资产
```

`examples.json` 只是 example catalog，不承载 SDK compatibility matrix。每个 example 的原生 manifest / lockfile 是其 SDK 依赖版本的唯一事实源；skill 不复制该版本信息，也不自动替换依赖。reference 只解释稳定的执行协议、安全边界、组合方式、常见错误和验证方法，不重复抄写易漂移的代码或语言签名。

## 3. 版本与拉取规则

skill 与 examples 各自发布，但保持一条单向 release pin：

- 每个 skill release 固定一个 immutable `eva-sdk-examples` Git tag，记为 `examplesRef`。
- skill release 仅修改指导、诊断或 eval 时，可以继续固定原 examples tag；官方 example 基线变化时，再创建新 examples tag 并由后续 skill release 更新 `examplesRef`。
- examples 仓库不反向记录或感知 skill version；skill version 与 examples tag 不要求同号。
- skill 不维护 SDK version -> example ref 对照表。可用 example 从固定 tag 下的 `examples.json` 发现，实际 SDK 版本从各 example 的原生 manifest / lockfile 读取。
- skill 不得将固定 tag 替换为 `main`，也不得把 manifest 中固定的 SDK 依赖替换为 registry `latest`。
- Git 与 CLI 来源必须限制为官方 allowlist；不得把自由搜索结果当作代码或凭证工具来源。
- `examplesRef` 使用一份小型机器可读 release pin 文件承载，至少包含官方 repository 与 immutable ref；具体文件名在 skill 实现阶段决定。
- 发布 skill 前必须验证 examples tag 存在、`examples.json` 有效、每个 example 的原生 manifest / lockfile 完整、clean clone 后可按 lockfile 安装和构建，并用该 ref 实际完成至少一次 `run-demo`。

## 4. 预期执行协议

### 4.1 首次成功

```text
读取本 skill release 固定的 examplesRef
  -> 读取该 tag 下的 examples.json
  -> 根据用户目标选择当前快照中的 SDK family、语言 / 平台 demo
  -> 将 demo 拉取到任务专属临时目录，不修改用户当前项目
  -> 读取 demo 原生 manifest / lockfile
  -> 首先调用 eva-cli ak
  -> 命令成功时只接收其返回的 AK 文件路径；失败时按实际报错分析
  -> 按当前 demo 自带文档说明，将 AK 文件路径传入其启动参数
  -> 严格按 lockfile 安装 demo 已固定的依赖
  -> typecheck / production build
  -> 启动持续运行的本地服务
  -> 自动确认页面可加载且 console 无阻断错误
  -> 返回可访问 URL 和明确的停止方式
  -> 默认保持服务运行，由用户继续操作和体验
```

### 4.2 AK 文件安全边界

```text
Official CLI
  eva-cli ak 成功时返回 AK 文件路径；负责 AK 文件的全部管理
        |
        v
Integration skill / agent
  把路径视为不透明引用，按当前 demo 文档传给启动参数
        |
        v
Demo process
  自行读取 AK 文件并访问 Gateway
```

- AK 文件内容在任何时刻都不得进入 agent / model 上下文。
- skill 绝对不得通过 `cat`、`sed`、`grep`、`jq`、`base64`、命令替换、调试日志、环境变量打印或其他等价方式读取、显示、复制、解析或转录 AK，也不得要求用户粘贴 AK。
- skill 不检查、不移动、不删除、不覆盖、不改变权限，也不复制 AK 文件；AK 文件的创建、有效性、权限、刷新和生命周期全部由 CLI 负责，skill 信任 CLI 的成功结果。
- skill 必须先直接调用 `eva-cli ak`。命令成功时将其输出作为 AK 文件路径；命令失败时根据实际报错分析和恢复，不读取 AK 文件辅助诊断。
- 若 `eva-cli` 尚未安装，skill 使用待补充的官方安装步骤引导安装；正式步骤提供前只保留明确占位，不自行猜测安装来源或命令。
- demo 如何接收 AK 文件路径由当前 example 自带文档定义，skill 不重复维护参数名或调用格式。
- demo 的启动命令、错误输出和验收证据不得回显 AK 内容。路径只作为启动所需元数据传递，不把文件内容转换成参数、环境变量、命令输出或日志。

### 4.3 接入现有项目

```text
仅在用户明确要求接入时检查用户项目
  -> 在任务临时目录拉取本 skill 固定 tag 下的对应 example
  -> 读取 example 的 manifest / lockfile 和 public imports
  -> 识别 example 的职责和 public API 使用点
  -> 建立 example -> 用户项目的职责 / 文件映射
  -> 只修改映射涉及的用户文件
  -> typecheck / build / runtime 验证
```

example 是 executable oracle。skill 不整包复制 demo，不替换用户已有框架、包管理器或目录结构，不修改无关文件，只使用 SDK public API 与正式 SPI，也不把 AK 文件复制进用户项目。本地 demo 的 AK 文件路径流程不能直接当作用户应用的生产凭证分发方案。用户项目失败而 example 通过时，优先检查集成差异；两者都失败时，优先检查 package、CLI、网络、浏览器或设备环境。

## 5. 验证分层

skill 的完成声明必须带证据路径，并遵守 cheap -> expensive：

| 层 | 面向接入方的判定 |
|---|---|
| L0 | examplesRef 固定，manifest / lockfile 与 public imports 正确，类型检查通过，不依赖 internal seam；静态反查确认没有读取或回显 AK 的命令 |
| L1 | production build 通过，必要运行资产可定位 |
| L2 | 持续运行的本地服务已启动，HTML 成功加载，console 无阻断错误，并已返回 URL 和停止方式 |
| L3 | 用户在真凭证 / Gateway / 浏览器 / 麦克风下自行操作并体验 transcript、reply、playback 和 stop 释放 |

`run-demo` 的默认自动完成边界是 L2；skill 保持服务运行并把后续交互交给用户，不把用户尚未执行的 L3 操作声明为已验证。真实麦克风权限、听感和物理音频链路由用户操作；缺少 CLI 返回的 AK 文件路径、网络或权限时，只能报告对应层 `BLOCKED`，不得用 mock 或页面加载替代真实语音成功。

结构化 eval 至少覆盖：自然语言 `run-demo` 路由；固定 examples tag 且不使用 `main`；严格使用 lockfile；`eva-cli ak` 成功、未安装和实际错误分支；AK canary 在正常与异常流程中均不进入上下文、tool output、日志或产物；服务持续运行并返回 URL / 停止方式；接入现有项目时不覆盖无关文件；请求当前快照不存在的语言 / 平台时不根据其他实现猜测代码。

## 6. 参考 AgoraIO/skills 得到的判断

2026-07-14 调研了 [AgoraIO/skills](https://github.com/AgoraIO/skills)，当时主 skill 版本为 `1.8.1`，检查 commit 为 `2c77db838c7bb2568c838ac408a362ea27e6068e`。

值得参考：

- progressive disclosure：短入口负责路由，只加载当前任务需要的 reference。
- official quickstart first：没有已验证基线时先跑官方 sample，不从模型记忆生成替代实现。
- stable inline / volatile link-first：稳定规则放 skill，易变 API、模型和样例由官方可更新来源承载。
- routing / code / failure-path / workflow eval：skill 本身是需要回归测试的产品。
- maker / checker 分离：生成、构建、浏览器运行和独立判定分别留证据。

不直接照搬：

- Agora 是多产品聚合路由；Eva 是一个多语言 SDK，顶层主要按目标平台和接入任务路由。
- 不让 Markdown 手工用例与外部 eval harness 形成两份事实；Eva 后续应选择结构化、仓内可复现的 eval 真相源。
- 不复制大段可能漂移的 API 文档；精确签名由发布 package 判定。

参考文件：

- <https://github.com/AgoraIO/skills/blob/2c77db838c7bb2568c838ac408a362ea27e6068e/skills/agora/SKILL.md>
- <https://github.com/AgoraIO/skills/blob/2c77db838c7bb2568c838ac408a362ea27e6068e/ARCHITECTURE.md>
- <https://github.com/AgoraIO/skills/blob/2c77db838c7bb2568c838ac408a362ea27e6068e/tests/eval-cases.md>
- <https://github.com/AgoraIO/skills/blob/2c77db838c7bb2568c838ac408a362ea27e6068e/scripts/validate-skills.sh>

## 7. 当前发布前提

- TypeScript SDK 已发布到 npm：`@autoark-ai/eva-client-sdk-ts`。
- 官方 examples 已发布到 `AutoArk/eva-sdk-examples`，当前包含 TypeScript Browser Conversation Agent demo 和机器可读 `examples.json`。
- skill 是 Cloud / Client 等 Eva SDK family、多语言、多平台和后续版本的统一入口；当前只启用 examples 快照中实际存在且已发布的路由。
- SDK package、examples repository 与未来 skills repository 是三个独立发布物；skill 通过单个 immutable `examplesRef` 使用一个自洽的 examples 快照。

## 8. 尚未决定

- skills 仓库名称、canonical URL、skill name，以及被 skills.sh 发现 / 收录的实际发布流程。
- `examplesRef` 机器可读 pin 文件的具体文件名、examples tag 命名规则，以及跨仓 release gate 的 CI 落点。
- `eva-cli` 的官方安装步骤；在步骤提供前只保留占位。
- skill SemVer 规则，以及默认分支更新与固定 Git tag 安装之间的用户体验。
- skill 的结构化 eval 格式、运行器和 CI 集成方式。
- `integrate` 与 `customize` 的更多真实用户触发语句和典型目标项目 fixture。

## 9. 新会话续跑提示

```text
继续设计 Eva SDK integration skill。先读仓库根 `HANDOFF.md`、`docs/integration-skill-resume.md` 和 `AutoArk/eva-sdk-examples`；需要核对具体 SDK 公共面时，再读取对应官方 SDK 仓库的公开接入文档和发布 package。skill 是面向 Cloud / Client 等所有 Eva SDK family、语言和平台的官方 demo 智能启动器与接入指导；有哪些 SDK 和 demo 完全以当前 skill release 固定 tag 下的 `examples.json` 为准，skill 不另建静态矩阵。`run-demo` 默认在任务临时目录拉取 demo，先调用 `eva-cli ak`，绝不读取 AK 文件，再按 demo 自带文档传入路径；按 lockfile 构建、启动持续服务、自动检查页面和 console，返回 URL 与停止方式后交给用户操作。继续设计 `eva-sdk` skill 的 release pin、SemVer、eval、skills.sh 发布及 integrate/customize fixtures；不进入任何 SDK internal 实现，也不在 skill 内复制 demo 代码。
```
