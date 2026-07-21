# EVA CLI 与本地凭证工作目录

只在用户已确认 Demo，或明确要求对目标项目执行本地真实运行时使用本流程。AK 文件由 CLI 管理；agent 只传递路径。

## CLI 可用性与登录

1. 在任何全局安装、登录或凭证初始化前，确认上游工作流要求的用户 gate 已通过。
2. 运行 `eva whoami`：
   - 命令存在且显示当前登录信息：把它作为已登录证据，继续；只报告必要状态，不复述无关身份信息。
   - `eva` 不存在：展示 owner 确认的安装命令 `npm install -g auteva-test-cli`，说明它会修改全局 npm 环境，并等待用户明确确认。确认后执行该命令，再运行 `eva whoami`；不要尝试其他包名或安装源。
   - 命令表明未登录：告诉用户下一步 `eva login` 会打开浏览器，必须由用户亲自完成登录。
3. 需要登录时运行 `eva login`，保持该操作可供用户完成，并明确等待用户反馈。不得代替用户操作浏览器登录，不得把浏览器打开、命令启动或命令退出视为登录成功。
4. 用户完成后再次运行 `eva whoami`。只有它确认已登录才继续；仍未登录或返回错误时报告 `BLOCKED`，保留原始非敏感错误。

## 初始化工作目录并取得 AK 路径

1. 选择目标实际运行的绝对工作目录。运行 Demo 时使用最终快照根下所选 example 的绝对目录；接入项目的本地真实运行使用已声明的目标项目目录。不要使用无关目录，也不要跨工作目录复用路径。
2. 生成 workspace name：使用本地时间到秒的 `YYYYMMDDHHmmss`，追加 `_` 和来源 slug。Demo 的 slug 来自 example id；接入项目来自目标目录 basename。把非字母数字连续字符归一为 `_`，转小写并去掉首尾 `_`；结果为空时使用 `eva`。例如 `20260721110300_client_sdk_ts_browser`。
3. 运行 `eva init --dir <绝对工作目录> --key-name <workspace-name>`。例如工作目录为 `/private/tmp/cliTest`、生成名称为 `20260721135900_client_sdk_ts_browser` 时，运行 `eva init --dir /private/tmp/cliTest --key-name 20260721135900_client_sdk_ts_browser`。这是写操作；只在目标目录已进入本轮声明范围时执行。
4. 把进程 cwd 设置为同一个工作目录，直接运行 `eva key path`。不要使用命令替换、shell tracing 或会把输出拼进日志的包装方式。
5. 只把 stdout 当作该工作目录对应的 AK 文件路径。不要读取、显示、复制、解析、搜索、编码、移动、删除或检查路径指向的文件及其元数据。
6. 按消费方公开入口把该路径作为不透明参数传入。若 `eva init` 或 `eva key path` 失败，报告失败阶段、工作目录、workspace name 和非敏感错误；不要换目录重试，不要向用户索要 AK 内容。
