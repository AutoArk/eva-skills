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
  assert(
    documents.skill.includes("[references/cli.md](references/cli.md)"),
    "SKILL.md must route CLI work to references/cli.md",
  );
  assert(documents.runDemo.includes("[cli.md](cli.md)"), "run-demo must load cli.md");
  assert(documents.integrate.includes("[cli.md](cli.md)"), "integrate must load cli.md");

  assert(
    documents.cli.includes("npm install -g auteva-test-cli"),
    "CLI install command must be npm install -g auteva-test-cli",
  );
  const exactCliFragments = [
    "npm install -g auteva-test-cli",
    "`eva whoami`",
    "`eva login`",
    "`eva init --dir",
    "`eva key path`",
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
  assert(documents.cli.includes("同一个工作目录"), "eva init and eva key path must share a working directory");
  assert(
    documents.cli.includes("eva init --dir /private/tmp/cliTest --key-name 20260721135900_client_sdk_ts_browser"),
    "CLI reference must use eva init --dir path --key-name name",
  );
  assert(documents.cli.includes("YYYYMMDDHHmmss"), "CLI reference must define the workspace timestamp format");
  assert(
    documents.cli.includes("20260721110300_client_sdk_ts_browser"),
    "CLI reference must include a generated workspace name example",
  );
  assert(documents.runDemo.includes("任务专属临时目录"), "run-demo must offer a task temp directory");
  assert(documents.runDemo.includes("用户给出的明确目标目录"), "run-demo must offer a user-selected directory");
  assert(documents.runDemo.includes("不得覆盖非空目录"), "run-demo must protect non-empty destinations");

  const firstWhoami = documents.cli.indexOf("`eva whoami`");
  const login = documents.cli.indexOf("`eva login`", firstWhoami + 1);
  const verifiedWhoami = documents.cli.indexOf("`eva whoami`", login + 1);
  const init = documents.cli.indexOf("`eva init --dir", verifiedWhoami + 1);
  const keyPath = documents.cli.indexOf("`eva key path`", init + 1);
  assert(firstWhoami >= 0, "CLI workflow must begin with eva whoami");
  assert(login > firstWhoami, "eva login must follow the initial eva whoami check");
  assert(verifiedWhoami > login, "eva whoami must verify browser login before continuing");
  assert(init > verifiedWhoami, "eva init --dir ... --key-name ... must happen only after verified login");
  assert(keyPath > init, "eva key path must happen after eva init");

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
