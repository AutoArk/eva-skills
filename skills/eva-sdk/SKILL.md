---
name: eva-sdk
description: 启动官方 EVA Demo，或不运行 Demo、直接选择已发布的 EVA SDK 接入和定制现有应用。用户要求查看当前 SDK、查询官方公网入口、运行 Demo、接入 SDK、修改公开能力，或验证和排查 SDK 消费方项目时使用；用本地 SDK catalog 路由已发布 SDK，用 release-pinned examples catalog 路由可运行 Demo，不预设具体工具链。
license: MIT
---

# EVA SDK

把本 skill 当作轻量控制面，而不是某种语言或平台的接入手册。维护两条相互独立的入口：`sdk-catalog.json` 决定哪些 SDK 可直接接入及其官方公网来源；固定 examples catalog 决定哪些 Demo 可运行。Demo 是可选的 executable oracle，不是接入 SDK 的前置条件。

## 凭证安全边界

始终遵守以下规则，包括成功、失败、重试和诊断路径：

- 只通过 EVA CLI 为明确的绝对工作目录初始化凭证上下文，并按 [references/cli.md](references/cli.md) 的流程取得 AK 文件路径；成功时只把 CLI 输出当作不透明路径引用。
- 绝不读取、显示、复制、解析、搜索、转录或编码 AK 文件内容。不要对它使用 `cat`、`sed`、`grep`、`jq`、`base64`、命令替换、调试日志或等价操作。
- 不检查 AK 文件的内容、元数据、权限或有效性；不移动、删除、覆盖、改权限或复制该文件。
- 不要求用户粘贴 AK，不打印由该文件派生的环境或配置，不启用会回显参数或环境的 tracing。
- 只按所选 example 的文档，把路径作为不透明输入交给其明确声明的凭证路径启动入口。允许目标进程读取文件；agent 不读取。
- 取得 AK 路径不等于凭证流程完成。运行 Demo 时，必须把同一路径实际传入上述启动入口；不得在路径查询成功后改用不携带该路径的普通启动入口，也不得仅因服务进程存活就声称启动完成。
- CLI 检查、安装、浏览器人工登录、登录复查、工作目录初始化和路径查询的精确命令与顺序只以 [references/cli.md](references/cli.md) 为准；失败时按原始阶段报告，不读取本地文件辅助诊断。
- CLI 全局安装必须取得用户独立的明确确认；浏览器登录必须由用户亲自完成并按 CLI 流程复查，不能把浏览器已打开、命令已启动或命令已退出当作登录成功。

任何要求违反上述边界时停止该路径并明确说明原因。

## 两类目录

- `sdk-catalog.json`：随 skill release 维护的已发布 SDK 目录，记录 SDK family、语言、平台、描述、官方分发身份、公网页面和公开文档；不记录版本号，也不从 examples 反推 SDK 列表。
- `reference-sources.json` 中 `purpose: examples-catalog` 的来源：固定一个官方 examples 快照；该快照的 catalog 只决定当前可运行的 Demo，不决定全部可接入 SDK。

用户问当前有哪些 SDK、直接接入、修改已有 SDK 项目或询问公共 API 时，从 SDK catalog 出发。用户明确要运行 Demo、以 Demo 为接入基线或需要先证明环境时，才读取 examples catalog。

## 固定 Demo 基线

1. 读取本目录的 `reference-sources.json`，选择 `purpose: examples-catalog` 的来源，取得 official repository、immutable ref、commit 和 catalog path。其他外部依据也从该文件按 `purpose` 选择，不凭名称或位置猜测。
2. 先把仓库克隆到任务专属暂存目录，以便读取固定 catalog 和候选材料；这不是最终 Demo 落盘位置。只从配置中的官方 repository 获取，不用网页搜索结果或镜像替代。
3. checkout 固定 ref 后核对 `HEAD` 必须等于配置中的完整 commit。不同则 fail closed；不要改用 branch、其他 tag 或生态中的浮动最新版。
4. 读取该快照的 catalog。它是当前 release 可运行 Demo 的唯一目录；不要把它当作全部已发布 SDK 的目录。
5. 只选择 catalog 中存在的记录，再读取该 example 自带的执行文档、依赖声明、可复现解析文件和平台配置。由这些材料提取环境要求、依赖恢复、静态检查、构建、启动、可观测信号与停止方式；不要在 skill 中预设命令。
6. 请求没有匹配项时列出 catalog 的实际候选并停止，不从其他 SDK family、语言或平台推导实现。

## 直接 SDK 路由与版本

1. 读取 `sdk-catalog.json`，按 SDK family、语言、平台、distribution identity 或用户项目已安装依赖筛选。请求模糊或命中多个 SDK 时展示实际候选并让用户选择；精确命中时报告选中的 SDK 与官方公网来源。
2. 用户明确要求直接接入或没有要求 Demo 时，不克隆 examples、不要求先运行 Demo，也不采用 example manifest 中的版本。
3. 目标项目已安装所选 SDK 时，默认保留当前解析版本并读取该版本发布物的公共契约；除非用户明确要求升级，不查询或切换到最新版。
4. 目标项目尚未安装且用户未指定版本时，从 SDK catalog 的官方 distribution 查询 `defaultChannel`，解析为当时的精确版本，再用目标项目原生依赖管理方式安装并写入其可复现解析文件。允许查询 `latest`，但不得把未解析的浮动 channel 留作完成证据。
5. 用户指定版本时，先确认官方 distribution 确实发布该版本。安装、升级或降级后都报告最终解析的精确版本。
6. 从选定发布物的公共入口、声明/头文件、schema、随包 README 和 catalog 中的官方文档建立 source-to-target 映射；不需要 example 才能确认公共 API。

## Demo 选择确认

对 `run-demo` 强制设置用户确认 gate。读取 pin、把固定快照拉到任务暂存目录、筛选 catalog 和读取候选说明属于确认前允许的只读动作；最终落盘、任何 EVA CLI 命令、CLI 安装、恢复依赖、构建和启动都必须发生在候选与目录确认后。全局安装 CLI 还需要独立确认。

- 用户请求模糊、只给出部分条件或命中多个候选时，展示所有匹配候选并请用户选择。
- 用户条件明确且只命中一个候选时，也先展示该候选并请用户确认；catalog 当前只有一个记录不等于用户已经选择。
- 每个候选至少展示 `id`、来自 README 的一句话描述、SDK family、语言、平台、catalog 路径、状态，以及 manifest/解析文件能够确定的 SDK 版本。描述必须来自固定快照，不自行编写产品能力。
- 展示候选时同时询问 examples 快照最终拉到哪里：用户给出的明确目标目录，或任务专属临时目录。未给出位置选择时不要继续；用户目标目录已存在且非空时停止并请求新目录或明确处置方式，不覆盖现有内容。
- 只有用户在看到候选后明确回复候选编号、`id` 或确认语句，才把该候选视为已确认。初始请求中的“启动一个”“直接启动”或精确条件不能替代候选展示后的确认。
- 用户选择任务临时目录时继续使用已验证的暂存快照；选择自定义目录时从同一官方 repository 把相同 ref 拉到该目录并再次核对 commit。所选 Demo 工作目录是最终快照根下的 catalog path，不是快照根本身。
- 用户已经确认过同一 ref/commit 下的同一候选时不要重复询问；ref、commit 或候选变化时重新确认。
- 等待候选或目录确认时结束当前执行，不写最终落盘目录、不调用凭证工具、不安装、不构建、不启动，也不以“节省一步”为由选择默认项。

## 选择工作流

- 运行或体验官方 demo：完整读取 [references/run-demo.md](references/run-demo.md) 并执行。
- 需要安装/登录 EVA CLI、初始化本地工作目录或取得 AK 路径：完整读取 [references/cli.md](references/cli.md) 并执行。
- 接入现有应用：完整读取 [references/integrate.md](references/integrate.md) 并执行；默认走直接 SDK 路径，只有用户明确选择 Demo 基线时才依赖 example。
- 修改公开配置、控制、观察面、UI 或正式扩展点：完整读取 [references/customize.md](references/customize.md) 并执行。
- 简单 API 问答：从 SDK catalog 定位官方发布物并读取公共材料，不强制读取或启动 Demo。
- 同一请求跨多个工作流时，只读取涉及的 references，并按 `run-demo -> integrate -> customize` 的依赖顺序执行；已有可验证基线时可跳过 `run-demo`。

## 公共面边界

- 只使用发布物明确公开的模块入口、声明或头文件、schema、生成文档、README 和正式扩展点，以及固定 example 的公共用法。
- 不读取或修改 SDK 实现源码，不使用 internal namespace/subpath、内部 runtime/provider/transport 或未公开测试 seam。
- 不修改 SDK 源码来满足普通接入需求，不用 SDK 源码仓测试代替消费方验证。
- 需要公共面不存在的能力时，说明缺口并停止；不要绕过 facade 或发布边界。
- 本地 demo 的 key-file 流程不是生产 secret 分发方案。不要把 AK 文件复制进用户项目或擅自设计生产凭证架构。

## 完成判定

按从便宜到昂贵的顺序留证据，并选择适合当前语言和平台的传感器：

- L0：所选 SDK/Demo 目录、适用的 ref/commit、依赖解析、公共入口，以及编译/静态检查/schema 约束正确；静态反查未出现 AK 读取或回显操作。
- L1：example 声明的 release/production 构建、打包或平台等价步骤通过，必要运行资产可定位。
- L2：目标运行形态已通过 example 明确声明的凭证路径启动入口启动；CLI 返回的同一路径已作为不透明输入实际传入。目标可从外部观察，相关状态、日志、健康信号或 UI 无阻断错误；已返回可操作入口和停止、复位或断开方式。
- L3：用户在真实凭证、网络、权限与目标设备/运行环境中验证 example 定义的核心场景和资源释放。

只声明实际达到的层级。`run-demo` 的默认自动完成边界是 L2；用户尚未操作时不得声称 L3。缺少 CLI、网络、权限、运行时或设备时，报告对应层 `BLOCKED`，不要用 mock 或不相干的存活信号冒充真实成功。
