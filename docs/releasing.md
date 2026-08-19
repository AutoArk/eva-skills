# Skill 发布规范

本文定义本仓库所有公开 skill 的正式发布顺序。目标是让每个发布节点可复现、可验证、可追溯，并避免用覆盖历史的方式修复已公开版本。

## 发布模型

- **安装与发现单位是单个 skill**：用户通过 `--skill <name>` 选择要安装的 skill。
- **版本单位是整个仓库**：`vMAJOR.MINOR.PATCH` tag 固定仓库某个 commit，而不是只给某个 skill 编号。
- **默认更新通道是 `main`**：未固定 ref 的安装会从默认分支获取 skill。对 `skills/<name>/**` 的修改一旦进入 `main`，用户之后执行 `npx skills update` 就可能取得该修改。
- **正式发布节点由 tag 和 GitHub Release 共同记录**：tag 提供不可变代码快照，Release 面向用户说明变化、迁移要求与已知问题。skills.sh 是基于公开来源与安装数据形成的发现入口，不是版本注册表，也没有替代 tag 的独立发布命令。

因此，只允许将已经达到发布质量的 skill 内容合入 `main`。tag 负责标记正式节点，但不负责阻止 `main` 上尚未打 tag 的内容被更新到。

## 版本规则

tag 统一使用带 `v` 前缀的 SemVer：

```text
vMAJOR.MINOR.PATCH
```

- `PATCH`：修复现有 skill 的错误、歧义或兼容性问题，不引入新的使用前提。
- `MINOR`：新增 skill，或为现有 skill 增加向后兼容的能力、工作流或平台覆盖。
- `MAJOR`：发布 `v1.0.0` 以后，出现需要用户迁移的破坏性变化。
- `v0.x` 阶段的破坏性变化至少提升 `MINOR`，并在 Release Notes 顶部明确标注迁移要求。
- 只有根目录文档、CI 或维护脚本变化，且安装后的 skill 内容和行为不变时，可以不发布新版本。
- 每次正式发布必须使用新 tag。已经公开的 tag 不得移动、删除后重建或覆盖。

首个正式版本从 `v0.1.0` 开始。

## 权限边界

以下操作必须由仓库维护者本人执行，除非维护者针对某一次操作重新明确授权：

- 创建 tag；
- 推送 `main` 或 tag；
- 创建、编辑或发布 GitHub Release；
- 任何其他远端发布操作。

agent 可以在本地修改、验证、整理证据和准备命令；是否提交本地 commit 仍以当次用户授权为准。agent 不得把“已准备好发布”表述成“已发布”。

## 标准发布顺序

### 1. 定义发布候选

在执行命令前先写清：

- 候选版本号；
- 本次变化涉及的 skill；
- 用户可观察到的变化；
- 必须保留的既有行为；
- 不可接受的失败；
- 是否存在迁移、凭证、网络或人工交互风险。

如果无法明确这些内容，先继续完善修改，不进入发布流程。

### 2. 审查变更范围

确认当前分支、工作区和相对上一 tag 的差异：

```bash
git status --short --branch
git diff --check
git diff <previous-tag>..HEAD -- skills/ evals/ scripts/ README.md docs/
```

首次发布没有 `<previous-tag>`，改为检查目标 commit 的完整 diff。检查结果至少满足：

- 没有凭证、AK 内容、私有地址、个人绝对路径或临时文件；
- `SKILL.md` frontmatter、目录名和 UI metadata 一致；
- 外部依赖使用公开入口；动态选择稳定 tag 的位置必须在单次验证中解析并记录 tag 和 commit，且不得使用 branch 或 prerelease；
- skill 文档只包含运行时真正需要的内容，维护说明留在仓库根目录或 `docs/`；
- 所有展示性文字遵守 EVA 品牌写法，代码标识符和资源名保留真实大小写。

### 3. 运行确定性检查

```bash
node --test scripts/*.test.mjs
node scripts/validate-evals.mjs
node scripts/validate-brand-style.mjs
node scripts/validate-cli-protocol.mjs
node scripts/validate-sdk-catalog.mjs
```

任一命令失败都不得继续。修复后从变更审查重新开始，不能只重跑最后一个失败项。

### 4. 运行联网与真实来源检查

```bash
node scripts/validate-sdk-catalog.mjs --live
node scripts/validate-release.mjs
```

`validate-release.mjs` 的正式发布检查不使用 `--skip-build`，需要解析官方 examples 最新稳定 tag、记录 commit、恢复依赖并完成构建。

当稳定 examples catalog 包含 Flutter mobile Demo 时，完整检查还需要与 example `pubspec.yaml` 匹配的 Flutter/Dart、Java 17、Android SDK，以及 macOS 上的 Xcode 与 CocoaPods。检查会执行 Android release 构建，并在 macOS 上执行不签名的 iOS release 构建；后者只证明 iOS 工程可编译，不替代开发者签名、安装和目标真机验收。`--skip-build` 只校验公开来源、catalog、manifest、lockfile 与公共 import，不得作为平台构建完成证据。

如果本次修改影响 Demo 选择、SDK 接入、EVA CLI、登录、AK 传递或真实运行行为，还必须在全新临时目录进行对应场景验收。`eva login` 会打开浏览器，只有维护者本人参与时才执行；不得把无法自动完成的登录步骤伪装成已验证。

### 5. 形成候选 commit

仅提交本次发布范围内的文件。commit 完成后重新确认：

```bash
git status --short
git rev-parse HEAD
```

工作区必须为空，并记录候选 commit SHA。任何后续代码修订都会产生新的候选 SHA，并使此前针对旧 SHA 的发布结论失效。

### 6. 推送 `main` 并验证远端 CI

维护者本人执行：

```bash
git push origin main
```

等待该候选 SHA 的 GitHub Actions 全部成功。必须核对 CI 对应的 commit SHA，不能用其他 commit 的绿色结果代替。失败时修复并重新执行第 2 至第 6 步。

### 7. 创建并核对 annotated tag

只有候选 SHA 的远端 CI 成功后，维护者本人创建 tag：

```bash
git tag -a vX.Y.Z <candidate-sha> -m "vX.Y.Z"
git rev-parse vX.Y.Z^{}
git show --no-patch --decorate vX.Y.Z
```

解析出的 SHA 必须与候选 SHA 完全一致。若 tag 尚未推送且目标错误，可以只在本地删除后重建；一旦公开，就按不可变版本处理。

### 8. 推送 tag

维护者本人执行：

```bash
git push origin vX.Y.Z
```

随后在远端再次核对 tag 指向的 commit。不要使用强制推送移动 tag。

### 9. 创建 GitHub Release

维护者本人基于同名 tag 创建 Release。Release Notes 至少包含：

```markdown
## 摘要

## 变化的 skills

## 用户可观察变化

## 兼容性与迁移

## 已知问题
```

Release Notes 只保留用户需要据此理解和使用新版本的信息，不写测试数量、commit SHA、CI job、构建日志或发布操作过程。没有迁移或已知问题时明确写“无”。

### 10. 保存发布验证记录

发布验证证据与 Release Notes 分开保存。至少保留候选 commit SHA、对应 GitHub Actions 结果、tag 指向检查、公开发现结果，以及适用的人工验收结论。

证据可以留在发布任务、issue 或团队检查记录中；GitHub Actions、commit 和 tag 本身继续作为机器可核对的事实来源。本仓库不强制为每个版本新增 worklog 文件，也不把这些内容复制到面向用户的 Release Notes。

### 11. 发布后验证

通过公开发现入口确认目标 skill 可被检索：

```bash
npx skills find eva-sdk
```

再检查：

- 查询结果包含目标 skill 及其公开来源；
- GitHub tag 和 Release 指向同一候选 SHA；
- skills.sh 后续能够发现该公开来源。公开索引可能异步更新，不把即时展示作为 tag 是否成功的唯一判定，也不把第三方安装服务的复制行为纳入本仓库发布判定。

完成以上检查后，才可以宣告正式发布完成。

## 发布异常处理

### tag 推送前发现问题

停止发布，修复并生成新的候选 commit，然后重新验证。未公开的本地 tag 可以删除后重建。

### 已推送 `main`、尚未打 tag 时发现问题

未固定 ref 的用户已经可能取得问题内容。优先修复并推送新的 commit，验证通过后只给修复后的 commit 打 tag；不要为已知错误的 commit 补做正式发布。

### tag 或 Release 公开后发现问题

不得覆盖原 tag。按影响程度发布新的补丁或后续版本，例如：

```text
v0.1.0  已公开但发现问题
v0.1.1  修复该问题
```

同时在旧 Release Notes 顶部标注已知问题并指向修复版本。旧 Release 的代码快照保持不变。

若涉及凭证泄漏、恶意内容或其他安全事件，先撤销凭证和阻断风险，再按安全事件流程处理；此时安全处置优先于一般历史保留规则。

## 发布完成判定

只有同时满足以下条件，发布才算完成：

- 发布范围、版本号和验收目标明确；
- 本地确定性检查、联网检查和适用的人工验收均有证据；
- 工作区干净；
- `main` 上候选 SHA 的 CI 全部成功；
- 新 annotated tag 已公开且准确指向候选 SHA；
- 同名 GitHub Release 已公开，Release Notes 面向用户说明版本变化、迁移要求和已知问题；
- 发布验证证据已在 Release Notes 之外保留并可追溯；
- 通过公开发现入口检索到目标 skill；
- 没有被隐瞒的已知阻断问题。

## 依据

- [skills CLI](https://github.com/vercel-labs/skills)
- [skills.sh 文档](https://skills.sh/docs)
