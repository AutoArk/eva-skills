---
name: eva-sdk
description: 基于已发布 EVA SDK 公共 API 进行选型、接入、配置、消费方验证排障或运行官方 Demo。泛称语音 Demo 仅在已有 EVA 上下文时适用；不用于 SDK 实现源码修改、公共契约设计或其他产品的 Demo。
license: MIT
---

# EVA SDK

把本 skill 当作轻量控制面，而不是某种语言或平台的接入手册。维护两条相互独立的入口：`sdk-catalog.json` 决定哪些 SDK 可直接接入及其官方公网来源；官方 examples source 的 `resolution` 指向的 catalog 决定哪些 Demo 可运行。Demo 是可选的 executable oracle，不是接入 SDK 的前置条件。

## 凭证安全边界

始终遵守以下规则，包括成功、失败、重试和诊断路径：

- 只在明确的绝对项目目录中按 [references/cli.md](references/cli.md) 的流程列出、选择或创建 key，并让 EVA CLI 把凭证保存到当前目录的 `.env`；创建 key 时必须禁止 CLI 显示 key。
- 绝不读取、显示、复制、解析、搜索、转录、加载或编码 `.env` 内容。不要对它使用 `cat`、`sed`、`grep`、`jq`、`base64`、`source`、命令替换、调试日志或等价操作。
- 绝不执行会把 AK 明文写入 stdout、stderr、终端、日志或工具结果的查看/显示命令。命令是否会回显 AK 不明确时停止，不要试运行；否则输出会进入 agent 和 LLM 上下文。
- 不检查 `.env` 的内容、元数据、权限或有效性；不移动、删除、覆盖、改权限或复制该文件。
- 不要求用户粘贴 AK，不打印由该文件派生的环境或配置，不启用会回显参数或环境的 tracing。
- 只按所选 example 的文档，把 `<绝对项目目录>/.env` 作为不透明路径参数交给其明确声明的凭证路径启动入口。允许目标进程读取文件；agent 不读取。
- 保存 `.env` 不等于凭证流程完成。运行 Demo 时，必须把该文件的绝对路径实际传入上述启动入口；不得在保存成功后改用不携带该路径的普通启动入口，也不得仅因服务进程存活就声称启动完成。
- 运行 Demo 时，如果 example 同时提供凭证路径启动入口和不带凭证的普通启动入口，默认必须完整执行 EVA CLI 凭证流程并选择凭证路径启动入口。只有用户明确要求在运行时手工输入 AK 时，才允许选择普通启动入口。
- CLI 检查、安装、浏览器人工登录、登录复查、进入项目目录、key 列出/创建/保存的精确命令与顺序只以 [references/cli.md](references/cli.md) 为准；失败时按原始阶段报告，不读取本地文件辅助诊断。
- CLI 全局安装必须取得用户独立的明确确认；未登录时 agent 可以按 [references/cli.md](references/cli.md) 启动浏览器登录流程，但浏览器中的登录必须由用户亲自完成并按 CLI 流程复查，不能把浏览器已打开、命令已启动或命令已退出当作登录成功。

任何要求违反上述边界时停止该路径并明确说明原因。

## 依赖选择配置

- 依赖模式直接写在 `reference-sources.json` 的 source `resolution` 和 `sdk-catalog.json` 每个 SDK distribution 的 `resolution` 中；可取值、`value` 格式与解析方式见 [dependency-resolution.md](dependency-resolution.md)。
- 默认值是 examples `latest-tag` 和 SDK `latest-version`；发布前必须恢复为这两个默认值。
- 不支持用户配置 commit。测试中的 branch 是可变引用；每次任务开始时解析 HEAD，并以实际 commit 冻结该任务的后续读取、确认与运行。当前 examples 在未正式发布期间使用 `main`，上线前恢复 `latest-tag`。

## 外部文档读取方法

- 外部 URL 以 `.md` 结尾时，直接使用 `curl` 获取原始 Markdown；不要为读取静态文档启动浏览器或 Computer Use。
- 外部 URL 是 HTML 文档时，先尝试在同一路径后追加 `.md`，例如把 `https://example.com/guide` 试为 `https://example.com/guide.md`。
- `.md` 地址可访问且内容完整时，以 Markdown 作为事实来源；只有 Markdown 不存在、不完整，或任务需要视觉交互、登录状态、动态内容时，才使用 HTML 解析或浏览器。
- 读取外部文档后记录实际 URL 和访问结果；网络不可达或来源内容不足时报告 `BLOCKED`，不要用模型记忆补齐参数。

## 两类目录

- `sdk-catalog.json`：随 skill release 维护的已发布 SDK 目录，记录 SDK family、语言、平台、描述、官方分发身份、公网页面和公开文档；不记录版本号，也不从 examples 反推 SDK 列表。
- `reference-sources.json` 中 `purpose: examples-catalog` 的来源声明官方 examples 仓库、依赖策略和 catalog 路径；`purpose: model-catalog` 的来源提供 Gateway 模型能力参考。Examples catalog 只决定当前可运行的 Demo，不决定全部可接入 SDK。

用户问当前有哪些 SDK、直接接入、修改已有 SDK 消费方应用或询问公共 API 时，从 SDK catalog 出发。用户明确要运行 Demo、以 Demo 为接入基线或需要先证明环境时，才读取 examples catalog。

## Demo 依赖解析

1. 读取 `reference-sources.json`，选择 `purpose: examples-catalog` 的来源及其 `resolution`，取得 official repository 和 catalog path。
2. 按配置解析 examples：`latest-tag` 选择最高稳定 `X.Y.Z` tag；`tag` 使用 `value` 指定的 tag；`branch` 使用 `value` 指定的分支。不存在或无法解析时 fail closed。
3. 把选中的 ref 克隆到任务专属暂存目录，解析并记录 checkout 后的完整 commit。该 ref、commit 组成当前任务快照；后续所有候选读取、确认、落盘、构建和启动都必须使用同一快照。
4. 读取该快照的 catalog。它是当前任务可运行 Demo 的唯一目录；不要把它当作全部已发布 SDK 的目录。
5. 只选择 catalog 中存在的记录。授权 gate 前只读取 catalog、README 候选简介、manifest/lock 中可确定的版本身份和目录状态；gate 满足后才读取所选 example 的完整执行文档、原生依赖、平台配置和公共 SDK 用法，由这些材料提取环境要求、依赖恢复、静态检查、构建、启动、可观测信号与停止方式。不要在 skill 中预设命令。
6. commit 一旦解析并展示，就作为当前任务的冻结 snapshot 身份。远端 branch 后续移动不改变该身份，也不自动使已有授权失效；最终自定义目录必须重现冻结 commit，不重新追随 branch tip。tag 被移动、冻结 commit 无法取得，或本地 snapshot HEAD/内容身份实际变化时 fail closed。
7. 请求没有匹配项时列出 catalog 的实际候选并停止，不从其他 SDK family、语言或平台推导实现。

## 直接 SDK 路由与版本

1. 读取 `sdk-catalog.json`，按 SDK family、语言、平台、distribution identity 或用户项目已安装依赖筛选。请求模糊或命中多个 SDK 时展示实际候选并让用户选择；精确命中时报告选中的 SDK 与官方公网来源。
2. 用户明确要求直接接入或没有要求 Demo 时，不克隆 examples、不要求先运行 Demo，也不采用 example manifest 中的版本。
3. 目标项目已安装所选 SDK 时，默认保留当前解析版本并读取该版本发布物的公共契约；除非用户明确要求升级，不查询或切换到最新版。
4. 目标项目尚未安装且用户未指定版本时，从 SDK catalog 的官方 distribution 查询 `defaultChannel`，解析为当时的精确版本，再按该 distribution 的公开方式安装并留下可复现身份。Registry 包写入目标项目的解析文件；GitHub Release 选择目标平台资产及其 `.sha256`，校验后解压，并通过公开 CMake package 接入。允许查询 `latest`，但不得把浮动 channel、latest 下载 URL 或未校验资产留作完成证据。
5. 用户指定版本时，先确认官方 distribution 确实发布该版本。安装、升级或降级后都报告最终解析的精确版本；GitHub Release 同时报告 repository、tag、平台资产名和 SHA-256。
6. 从选定发布物的公共入口、声明/头文件、schema、随包 README 和 catalog 中的官方文档建立 source-to-target 映射；不需要 example 才能确认公共 API。

## Demo 选择确认

对 `run-demo` 设置候选、immutable snapshot 与最终目录组成的授权 gate。解析配置指定的 ref、把对应快照拉到任务暂存目录、记录 commit、筛选 catalog、读取候选说明和检查目标目录是否为空属于 gate 前允许的只读动作；最终落盘、任何 EVA CLI 命令、恢复依赖、构建和启动只能在该授权 gate 满足后发生。全局安装 CLI 仍需要独立确认，Demo gate 不提供安装授权。

- 用户请求模糊、只给出部分条件或命中多个候选时，展示所有匹配候选并请用户选择。
- 用户在请求中同时给出精确 example `id` 和明确的绝对最终目录时，解析 immutable ref/commit，并确认该 `id` 存在于该快照且目标目录不存在或为空。三项一致时，把该请求视为对 `id + ref/commit + 绝对最终目录` 的明确授权；展示解析结果后直接继续，不再次请求候选或目录确认。
- 只靠语言、平台、SDK family 等条件唯一命中一个候选时，仍展示该候选并请用户确认；catalog 当前只有一个记录不等于用户已经选择。
- 每个候选至少展示 `id`、来自 README 的一句话描述、SDK family、语言、平台、catalog 路径、状态，以及 manifest/解析文件能够确定的 SDK 版本。描述必须来自已解析快照，不自行编写产品能力。
- 未给出绝对最终目录时，展示任务专属临时目录与用户自定义绝对目录两个选项并等待选择。自定义目标目录已存在且非空时停止并请求新目录或明确处置方式，不覆盖现有内容；初始请求中的目录授权不能授权处置后来发现的非空内容。
- 候选或目录未在初始请求中完整授权时，只有用户在看到解析结果后明确回复候选编号、`id`、目录或确认语句，才补齐对应授权。“启动一个”“直接启动”和唯一候选不能代替缺失的选择。
- 用户选择任务临时目录时，可以继续使用本任务创建且 commit 一致、没有未知新增或修改内容的已验证暂存快照；该受控快照不按普通非空目录处理。发现未知内容时，不读取、不清理、不覆盖旧目录，也不能靠一句确认把它恢复为可信快照；提出新的任务专属目录，等待用户选择后在新目录重现同一冻结 commit。选择自定义目录时从同一 official repository 取得并 checkout 冻结 commit，不再次追随 branch。所选 Demo 工作目录是最终快照根下的 catalog path，不是快照根本身。
- 授权只对已展示或已复用的 `id + ref/commit + 绝对最终目录` 有效。`id`、冻结 commit、最终目录或本地 snapshot 身份变化，自定义目录在最终写入前变为非空，或者任务暂存快照出现未知内容时，停止并补齐新的目录或身份授权；远端 branch 移动但冻结 snapshot 未变时继续使用原授权。tag 被移动时始终 fail closed。三项未变化时不要重复询问。
- 等待候选或目录确认时结束当前执行，不写最终落盘目录、不调用凭证工具、不安装、不构建、不启动，也不以“节省一步”为由选择默认项。

## 选择工作流

- 运行或体验官方 demo：完整读取 [references/run-demo.md](references/run-demo.md) 并执行。
- 需要安装/登录 EVA CLI，或在本地项目目录选择/创建 key 并保存 `.env`：完整读取 [references/cli.md](references/cli.md) 并执行。
- 接入现有应用：完整读取 [references/integrate.md](references/integrate.md) 并执行；默认走直接 SDK 路径，只有用户明确选择 Demo 基线时才依赖 example。
- 修改公开配置、控制、观察面、UI 或正式扩展点：完整读取 [references/customize.md](references/customize.md) 并执行。
- 纯模型或参数问答（包括采样率、音色、语言、温度、格式、延迟等）：读取 [references/model-parameters.md](references/model-parameters.md) 的“参数问答与可行性”小节及对应公开来源。需要写入配置、切换模型或验证参数组合时完整读取该 reference。必须根据当前 SDK 的公开能力和限制判断调用组合是否可行，不要求 SDK 逐一列出模型，也不得只替换模型名而跳过配套参数核对。
- 简单 API 问答：从 SDK catalog 定位官方发布物并读取公共材料，不强制读取或启动 Demo。
- 同一请求跨多个工作流时，只读取涉及的 references，并按 `run-demo -> integrate -> customize` 的依赖顺序执行；已有可验证基线时可跳过 `run-demo`。

## 公共面边界

- 只使用发布物明确公开的模块入口、声明或头文件、schema、生成文档、README、project description、相关配置项的 JSDoc/源码注释和正式扩展点，以及当前任务已解析 example 快照的公共用法。
- 不读取或修改 SDK 实现源码，不使用 internal namespace/subpath、内部 runtime/provider/transport 或未公开测试 seam。
- 不修改 SDK 源码来满足普通接入需求，不用 SDK 源码仓测试代替消费方验证。
- 需要公共面不存在的能力时，说明缺口并停止；不要绕过 facade 或发布边界。
- 本地 demo 的 key-file 流程不是生产 secret 分发方案。不要把 AK 文件复制进用户项目或擅自设计生产凭证架构。

## 完成判定

按从便宜到昂贵的顺序留证据，并选择适合当前语言和平台的传感器：

- L0：所选 SDK/Demo 目录、适用的 tag/commit、依赖解析、公共入口，以及编译/静态检查/schema 约束正确；静态反查未出现 `.env` 读取或 AK 回显操作。
- L1：example 声明的 release/production 构建、打包或平台等价步骤通过，必要运行资产可定位。
- L2：目标运行形态已通过 example 明确声明的凭证路径启动入口启动；当前项目目录下 `.env` 的绝对路径已作为不透明输入实际传入。目标可从外部观察，相关状态、日志、健康信号或 UI 无阻断错误；已返回可操作入口和停止、复位或断开方式。
- L3：用户在真实凭证、网络、权限与目标设备/运行环境中验证 example 定义的核心场景和资源释放。

只声明实际达到的层级。`run-demo` 的默认自动完成边界是 L2；用户尚未操作时不得声称 L3。缺少 CLI、网络、权限、运行时或设备时，报告对应层 `BLOCKED`，不要用 mock 或不相干的存活信号冒充真实成功。
