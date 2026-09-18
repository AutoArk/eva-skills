#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function loadCliProtocolDocuments(root = repositoryRoot) {
  const skillRoot = join(root, "skills", "eva-sdk");
  return {
    cli: readFileSync(join(skillRoot, "references", "cli.md"), "utf8"),
    integrate: readFileSync(join(skillRoot, "references", "integrate.md"), "utf8"),
    runDemo: readFileSync(join(skillRoot, "references", "run-demo.md"), "utf8"),
    skill: readFileSync(join(skillRoot, "SKILL.md"), "utf8"),
  };
}

export function validateCliProtocol(documents) {
  for (const [name, value] of Object.entries(documents)) {
    assert(typeof value === "string" && value.length > 0, `${name} document must be non-empty`);
  }

  const runtimeText = Object.values(documents).join("\n");
  assert(!runtimeText.includes("eva-cli ak"), "runtime skill files must not use obsolete eva-cli ak");
  assert(!runtimeText.includes("ak init"), "runtime skill files must not use obsolete ak init");
  assert(!runtimeText.includes("eva init"), "runtime skill files must not use obsolete eva init");
  assert(!runtimeText.includes("eva key path"), "runtime skill files must not use obsolete eva key path");
  assert(
    documents.skill.includes("[references/cli.md](references/cli.md)"),
    "SKILL.md must route CLI work to references/cli.md",
  );
  assert(documents.runDemo.includes("[cli.md](cli.md)"), "run-demo must load cli.md");
  assert(documents.integrate.includes("[cli.md](cli.md)"), "integrate must load cli.md");

  const cliInstallCommand = "npm install -g @autoark-ai/eva-cli@latest";
  assert(
    documents.cli.includes(cliInstallCommand),
    `CLI install command must be ${cliInstallCommand}`,
  );
  const exactCliFragments = [
    cliInstallCommand,
    "`eva whoami`",
    "`eva login`",
    "`eva key list`",
    "`eva key create",
    "`eva key save",
    "`eva key show`",
  ];
  for (const [name, text] of Object.entries(documents)) {
    if (name === "cli") continue;
    for (const fragment of exactCliFragments) {
      assert(
        !text.includes(fragment),
        `${name} must link to cli.md instead of duplicating exact CLI fragment: ${fragment}`,
      );
    }
  }
  assert(documents.cli.includes("全局 npm 环境"), "CLI install must disclose the global npm mutation");
  assert(documents.cli.includes("等待用户明确确认"), "CLI install must wait for explicit user confirmation");
  assert(documents.cli.includes("打开浏览器"), "eva login must disclose that it opens a browser");
  assert(documents.cli.includes("用户亲自完成"), "browser login must require human participation");
  assert(
    documents.cli.includes("首次在受限或沙箱上下文中得到的未登录结果")
      && documents.cli.includes("可访问本机用户 CLI 会话的获批上下文")
      && documents.cli.includes("仅重试一次相同的 `eva whoami`"),
    "CLI workflow must retry a sandbox unauthenticated result once with user-session access",
  );
  assert(
    documents.cli.includes("执行登录的同一获批上下文"),
    "CLI workflow must verify browser login in the login context",
  );
  assert(
    documents.cli.includes("用户完成后再次运行 `eva whoami`"),
    "whoami must verify browser login",
  );
  assert(documents.cli.includes("/private/tmp/cliTest"), "CLI reference must retain the owner-provided workspace example");
  assert(documents.cli.includes("`cd -- <绝对项目目录>`"), "CLI workflow must cd into the project directory first");
  assert(
    documents.cli.includes("`cd -- /private/tmp/cliTest`"),
    "CLI reference must include an explicit project-directory example",
  );
  assert(documents.cli.includes("`eva key list`"), "CLI workflow must list existing keys");
  assert(
    documents.cli.includes("禁止执行 `eva key show`"),
    "CLI workflow must forbid eva key show because it reveals the AK",
  );
  assert(documents.cli.match(/`eva key show`/g)?.length === 1, "eva key show must appear only as a prohibition");
  assert(
    documents.cli.includes("`eva key create <key_name> --no-show-key`"),
    "CLI key creation must include --no-show-key",
  );
  for (const command of documents.cli.match(/eva key create[^\n`]*/g) ?? []) {
    assert(command.includes("--no-show-key"), "every eva key create command must include --no-show-key");
  }
  for (const command of documents.cli.match(/eva key save[^\n`]*/g) ?? []) {
    assert(command.includes("--key-name"), "every eva key save command must include --key-name");
  }
  assert(
    documents.cli.match(/`eva key save --key-name <key_name>`/g)?.length === 2,
    "both key branches must save .env with --key-name",
  );
  assert(documents.cli.includes("YYYYMMDDHHmmss"), "CLI reference must define the workspace timestamp format");
  assert(
    documents.cli.includes("20260721110300_client_sdk_ts_browser"),
    "CLI reference must include a generated workspace name example",
  );
  assert(documents.runDemo.includes("任务专属临时目录"), "run-demo must offer a task temp directory");
  assert(documents.runDemo.includes("用户给出的明确目标目录"), "run-demo must offer a user-selected directory");
  assert(documents.runDemo.includes("不得覆盖非空自定义目录"), "run-demo must protect non-empty destinations");
  assert(
    documents.runDemo.includes("本任务创建、commit 一致且没有未知新增或修改内容")
      && documents.runDemo.includes("该受控快照即使非空也可复用")
      && documents.runDemo.includes("提出新的任务专属目录")
      && documents.runDemo.includes("不读取、不清理、不覆盖旧目录")
      && documents.runDemo.includes("不接受一句确认把它当成可信快照"),
    "run-demo must reuse only the verified task snapshot and protect unknown contents",
  );
  assert(
    documents.runDemo.includes("“Demo 依赖解析”")
      && !documents.runDemo.includes("“最新稳定 Demo 基线”"),
    "run-demo must route to the current Demo dependency-resolution section",
  );
  assert(
    documents.skill.includes("id + ref/commit + 绝对最终目录")
      && documents.skill.includes("直接继续，不再次请求候选或目录确认"),
    "SKILL.md must reuse an exact Demo authorization bound to the immutable snapshot and destination",
  );
  assert(
    documents.skill.includes("授权 gate 前只读取 catalog、README 候选简介、manifest/lock 中可确定的版本身份和目录状态")
      && documents.runDemo.includes("gate 前不读取完整执行文档、原生依赖或平台配置"),
    "Demo gate must limit pre-authorization reads to candidate identity and destination state",
  );
  assert(
    documents.skill.includes("远端 branch 后续移动不改变该身份")
      && documents.skill.includes("最终自定义目录必须重现冻结 commit，不重新追随 branch tip")
      && documents.runDemo.includes("tag 被移动")
      && documents.runDemo.includes("最终自定义目录 checkout 冻结 SHA"),
    "Demo snapshots must keep the frozen commit across branch movement and fail closed on moved tags",
  );
  assert(
    documents.skill.includes("全局安装 CLI 仍需要独立确认")
      && documents.skill.includes("浏览器中的登录必须由用户亲自完成")
      && documents.skill.includes("绝不读取、显示、复制、解析、搜索、转录、加载或编码 `.env` 内容"),
    "Demo authorization reuse must preserve CLI install, human login, and opaque .env boundaries",
  );
  assert(documents.cli.includes("保存 `.env` 不等于流程完成"), "CLI protocol must bind saved .env to its consumer");
  assert(documents.cli.includes("禁止 agent 读取"), "CLI protocol must explicitly forbid agent reads of .env");
  assert(documents.cli.includes("LLM 上下文"), "CLI protocol must explain the context-leak boundary");
  assert(documents.cli.includes("<绝对项目目录>/.env"), "CLI protocol must derive the absolute .env path");
  assert(
    documents.cli.includes("不得改用不携带该路径的普通启动入口"),
    "CLI protocol must forbid dropping the path before startup",
  );
  assert(
    documents.runDemo.includes("凭证路径启动入口") && documents.runDemo.includes("同一个不透明路径值"),
    "run-demo must bind the opaque path to the documented credential launcher",
  );
  assert(
    documents.runDemo.includes("其他入口启动的健康进程不能作为 L2"),
    "run-demo L2 must reject a healthy process started without the credential path",
  );
  assert(
    documents.skill.includes("本地真实启动必须完整执行 EVA CLI 凭证流程并选择凭证路径启动入口")
      && documents.skill.includes("不得创建或使用要求手工输入、粘贴或回显 AK"),
    "SKILL.md must require the CLI credential launcher for local real starts",
  );
  assert(
    documents.runDemo.includes("默认启动入口立即确定为凭证路径启动入口")
      && documents.runDemo.includes("不得切换为手工输入 AK"),
    "run-demo must choose the CLI credential launcher without a manual AK fallback",
  );
  assert(
    documents.runDemo.includes("不得自动改用不带 AK 的普通启动入口")
      && documents.runDemo.includes("不得改为等待用户在设备端手工输入 AK"),
    "run-demo must not silently downgrade when the EVA CLI credential path is blocked",
  );
  assert(
    documents.runDemo.includes("该凭证入口是否自行执行编译/构建")
      && documents.runDemo.includes("不得在此之前再运行普通 debug 或 release 构建")
      && documents.runDemo.includes("launcher 的构建结果作为本次构建证据"),
    "run-demo must not prebuild when the credential launcher already builds",
  );
  assert(
    documents.runDemo.includes("该入口此时完成的构建就是本次唯一构建"),
    "run-demo must count a build-capable credential launcher as the single build",
  );

  const demoCliAvailability = documents.runDemo.indexOf("先完整读取并执行 [cli.md](cli.md) 的“CLI 可用性与登录”小节");
  const demoDependencies = documents.runDemo.indexOf("使用该生态的 frozen/locked/reproducible 模式恢复依赖");
  const demoPreflight = documents.runDemo.indexOf("先运行当前生态适用的测试、静态检查");
  const demoKeyLifecycle = documents.runDemo.indexOf("再执行 [cli.md](cli.md) 的“在项目目录保存 `.env`”小节");
  const demoBind = documents.runDemo.indexOf("同一个不透明路径值", demoKeyLifecycle + 1);
  const demoStart = documents.runDemo.indexOf("按 example 的凭证路径启动入口启动目标", demoBind + 1);
  assert(demoCliAvailability >= 0, "run-demo must preflight CLI availability after the Demo gate");
  assert(demoDependencies > demoCliAvailability, "run-demo must preflight CLI availability before dependency restore");
  assert(demoPreflight > demoDependencies, "run-demo must run dependency restore before build and static checks");
  assert(demoKeyLifecycle > demoPreflight, "run-demo must defer the key lifecycle until pre-start checks pass");
  assert(demoBind > demoKeyLifecycle, "run-demo must bind the credential path immediately after key retrieval");
  assert(demoStart > demoBind, "run-demo must pass the bound credential path into startup");

  const firstWhoami = documents.cli.indexOf("`eva whoami`");
  const login = documents.cli.indexOf("`eva login`", firstWhoami + 1);
  const verifiedWhoami = documents.cli.indexOf("`eva whoami`", login + 1);
  const cd = documents.cli.indexOf("`cd -- <绝对项目目录>`", verifiedWhoami + 1);
  const keyList = documents.cli.indexOf("`eva key list`", cd + 1);
  const existingSave = documents.cli.indexOf("`eva key save --key-name <key_name>`", keyList + 1);
  const keyCreate = documents.cli.indexOf("`eva key create <key_name> --no-show-key`", existingSave + 1);
  const createdSave = documents.cli.indexOf("`eva key save --key-name <key_name>`", keyCreate + 1);
  assert(firstWhoami >= 0, "CLI workflow must begin with eva whoami");
  assert(login > firstWhoami, "eva login must follow the initial eva whoami check");
  assert(verifiedWhoami > login, "eva whoami must verify browser login before continuing");
  assert(cd > verifiedWhoami, "project-directory cd must happen only after verified login");
  assert(keyList > cd, "eva key list must happen after entering the project directory");
  assert(existingSave > keyList, "the existing-key branch must save after eva key list");
  assert(keyCreate > existingSave, "the missing-key branch must follow the existing-key branch");
  assert(createdSave > keyCreate, "a newly created key must be saved after creation");

  return { files: Object.keys(documents).length };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = validateCliProtocol(loadCliProtocolDocuments());
    console.log(`CLI protocol validation passed: ${result.files} runtime file(s)`);
  } catch (error) {
    console.error(`CLI protocol validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
