# 创建或接入消费方应用

## 目标

支持两种明确路径：直接从已发布 SDK 创建或接入消费方应用，或由用户主动选择官方 example 作为 executable oracle。不要把运行 Demo 设为接入 SDK 的前置条件。

## 选择依据

- 用户说“从零创建”“直接接入 SDK”“不要 Demo”、只指定 SDK family/语言/平台，或项目已经安装 EVA SDK：走直接 SDK 路径。
- 用户说“按这个 Demo 接入”“先跑通官方基线”，或明确选择某个 example：走 Demo 基线路径。
- 用户意图不清且两条路径会产生不同版本或工作量时，解释差异并请用户选择，不静默偏向 Demo。

## 直接 SDK 路径

1. 读取 `sdk-catalog.json`，按用户条件和目标项目依赖筛选。模糊或多候选时列出 `id`、描述、family、语言、平台、distribution identity 和公网文档，让用户选择；唯一命中时报告选择结果。
2. 读取目标目录的仓内指令、版本控制状态和已有内容，并声明本轮会触及的文件。目标目录为空时，按用户指定的语言、平台与运行形态创建能承载所选 SDK 的最小消费方项目；目标已有应用时，读取并保留其依赖真相源、框架、目录结构、入口与验证命令。不要预设某种工具链，也不要克隆 examples，除非用户随后选择 Demo 基线。
3. 检查目标项目是否已安装该 SDK：
   - 已安装：保留当前解析版本，从该版本的发布物读取公共契约；不自动升级。
   - 读取所选 SDK distribution 的 `resolution`：`latest-version` 查询 `defaultChannel`，取得精确版本；`version` 使用其 `value`，先验证官方 distribution 存在该版本，再安装并锁定；`local-package` 验证 artifact、release manifest、摘要、source commit、包名和包内版本后从绝对 `.tgz` 安装，不查询 registry。
   - Registry distribution 使用项目原生依赖管理器并保留 lock；`github-release` 只选择 catalog 声明的官方 repository 和目标平台资产，下载归档及 `.sha256`，验证摘要后解压。读取随包 `manifest.json` 核对版本、平台与 ABI，通过包内 CMake config 使用 `find_package(... EXACT CONFIG REQUIRED)`；不要使用 latest URL、Source code 归档或本地 SDK 源码替代发布物。
4. 先完整阅读所选发布物的 package README、project description、导出声明/类型和目标配置项的 JSDoc/源码注释，再结合 catalog 官方文档建立职责映射。涉及模型参数时同时执行 [model-parameters.md](model-parameters.md)：根据 SDK 当前公开能力和限制判断调用组合，再按模型列表重新核对配套参数；不要要求 SDK 明确列出每个模型。至少覆盖 SDK 创建与公开配置、生命周期与资源释放、输入输出与观察面、平台权限/资产/宿主集成，以及凭证边界。
5. 先使用当前生态的编译器、静态检查、schema、lint 或配置 validator，再做最小代码与配置修改。已有应用不得替换脚手架或修改无关文件；新建应用只创建当前场景需要的最小结构；两者都不得从 SDK internal 补实现。
6. 把构建与运行时凭证分开：缺少运行时凭证时仍应完成包含所需 SDK 功能与运行资产的构建；不得用构建期常量按凭证是否存在裁剪功能。只有用户明确要求真实启动时才执行 [cli.md](cli.md)，并按目标生态与所选发布物的公共契约建立接收凭证文件绝对路径的启动入口；禁止生成手工输入 AK 的界面或参数。
7. 按目标项目原有工具链执行由便宜到昂贵的验证，并报告 SDK 来源、请求 channel/版本、最终解析的精确版本与实际完成层级。`local-package` 还要报告 artifact 路径、SHA-256、payload digest 和 source commit，明确依赖只在该路径存在的机器上可复现。

## Demo 基线路径

1. 执行 `SKILL.md` 的“Demo 依赖解析”和“Demo 选择确认”。未确认 example 前不调用 CLI、不恢复依赖、不构建、不启动。
2. 用户确认后读取 example 的执行文档、依赖解析、公共 SDK 用法和平台配置，建立 example-to-target 职责映射，而不是文件复制。
3. 目标项目未安装 SDK 时，采用已解析 example 快照中的精确版本；目标项目已安装不同版本时，报告公共契约与解析差异并请用户选择，不能静默升级或降级。
4. 保留目标项目原有语言生态、框架、依赖管理、目录结构和无关行为；不要整包复制 demo、移植 example 的解析文件或替换脚手架。
5. example 通过而目标失败时优先比较职责映射；两者都失败时优先检查发布物、CLI、网络、工具链或目标环境。

## 凭证边界

需要本地真实运行时，完整读取并执行 [cli.md](cli.md)，先进入实际运行目录，让 CLI 在当前目录保存 `.env`，再把该文件的绝对路径作为不透明参数传给目标消费方或 example 明确声明的启动入口。已有项目没有凭证路径入口时报告缺口；新建项目由 agent 按目标生态与发布物公共契约建立该入口。不要在本文件复制或改写 CLI 的精确命令；agent 不得读取 `.env`，也不要提交、复制或转换该凭证文件，不要把本地方式描述成生产 secret 保密方案。

目标应用的生产凭证方案属于产品架构选择。若用户未提供既有机制或明确要求，不自行新增代理服务、共享 AK 或权限系统。
