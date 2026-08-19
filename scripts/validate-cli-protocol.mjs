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
  assert(documents.runDemo.includes("不得覆盖非空目录"), "run-demo must protect non-empty destinations");
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
    documents.skill.includes("同时提供凭证路径启动入口和不带凭证的普通启动入口")
      && documents.skill.includes("默认必须完整执行 EVA CLI 凭证流程并选择凭证路径启动入口"),
    "SKILL.md must prefer the credential launcher when both Demo launch modes exist",
  );
  assert(
    documents.runDemo.includes("默认启动入口立即确定为凭证路径启动入口")
      && documents.runDemo.includes("只有用户明确要求在运行时手工输入 AK 时"),
    "run-demo must choose the credential launcher unless runtime AK input was explicitly requested",
  );
  assert(
    documents.runDemo.includes("不得自动改用不带 AK 的普通启动入口")
      && documents.runDemo.includes("不得擅自改为等待用户在设备端手工输入 AK"),
    "run-demo must not silently downgrade when the EVA CLI credential path is blocked",
  );

  const demoBuild = documents.runDemo.indexOf("依次运行当前生态适用的静态检查");
  const demoCli = documents.runDemo.indexOf("完整读取并执行 [cli.md](cli.md)", demoBuild + 1);
  const demoBind = documents.runDemo.indexOf("同一个不透明路径值", demoCli + 1);
  const demoStart = documents.runDemo.indexOf("按 example 的凭证路径启动入口启动目标", demoBind + 1);
  assert(demoBuild >= 0, "run-demo must complete build checks before retrieving the credential path");
  assert(demoCli > demoBuild, "run-demo must retrieve the credential path after build checks");
  assert(demoBind > demoCli, "run-demo must bind the credential path immediately after CLI retrieval");
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
