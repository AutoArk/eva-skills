import assert from "node:assert/strict";
import { test } from "node:test";

import { loadCliProtocolDocuments, validateCliProtocol } from "./validate-cli-protocol.mjs";

test("accepts the repository CLI protocol", () => {
  assert.deepEqual(validateCliProtocol(loadCliProtocolDocuments()), { files: 4 });
});

test("rejects a drifted CLI package name", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace("@autoark-ai/eva-cli", "unconfirmed-cli-package");
  assert.throws(() => validateCliProtocol(documents), /install command must be/);
});

test("rejects a CLI install command without the latest tag", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace("@autoark-ai/eva-cli@latest", "@autoark-ai/eva-cli");
  assert.throws(() => validateCliProtocol(documents), /install command must be/);
});

test("requires whoami verification after browser login", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace(
    "用户完成后再次运行 `eva whoami`",
    "用户完成后继续",
  );
  assert.throws(() => validateCliProtocol(documents), /whoami must verify browser login/);
});

test("retries a sandbox unauthenticated result once before opening browser login", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace(
    "仅重试一次相同的 `eva whoami`",
    "重试登录状态",
  );
  assert.throws(() => validateCliProtocol(documents), /must retry a sandbox unauthenticated result once/);
});

test("verifies browser login in the same user-session context", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace("执行登录的同一获批上下文", "普通上下文");
  assert.throws(() => validateCliProtocol(documents), /must verify browser login in the login context/);
});

test("rejects eva key create without --no-show-key", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace(
    "eva key create <key_name> --no-show-key",
    "eva key create <key_name>",
  );
  assert.throws(() => validateCliProtocol(documents), /must include --no-show-key/);
});

test("rejects eva key save without --key-name", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace(
    "eva key save --key-name <key_name>",
    "eva key save <key_name>",
  );
  assert.throws(() => validateCliProtocol(documents), /must include --key-name/);
});

test("rejects key listing before entering the project directory", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli
    .replace("`cd -- <绝对项目目录>`", "__PROJECT_CD__")
    .replace("`eva key list`", "`cd -- <绝对项目目录>`")
    .replace("__PROJECT_CD__", "`eva key list`");
  assert.throws(() => validateCliProtocol(documents), /must happen after entering the project directory/);
});

test("requires both Demo destination choices", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo.replace("用户给出的明确目标目录", "默认目录");
  assert.throws(() => validateCliProtocol(documents), /user-selected directory/);
});

test("requires the saved .env path to reach the documented Demo launcher", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace("保存 `.env` 不等于流程完成", "保存后继续");
  assert.throws(() => validateCliProtocol(documents), /must bind saved .env to its consumer/);
});

test("requires an explicit prohibition on reading .env", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace("禁止 agent 读取", "agent 不处理");
  assert.throws(() => validateCliProtocol(documents), /must explicitly forbid agent reads of .env/);
});

test("forbids eva key show from exposing AK plaintext", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace("禁止执行 `eva key show`", "可以执行 `eva key show`");
  assert.throws(() => validateCliProtocol(documents), /must forbid eva key show/);
});

test("preflights CLI availability before dependency restore", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo
    .replace("先完整读取并执行 [cli.md](cli.md) 的“CLI 可用性与登录”小节", "__CLI_AVAILABILITY__")
    .replace("使用该生态的 frozen/locked/reproducible 模式恢复依赖", "先完整读取并执行 [cli.md](cli.md) 的“CLI 可用性与登录”小节")
    .replace("__CLI_AVAILABILITY__", "使用该生态的 frozen/locked/reproducible 模式恢复依赖");
  assert.throws(() => validateCliProtocol(documents), /preflight CLI availability before dependency restore/);
});

test("defers key lifecycle until pre-start checks pass", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo
    .replace("先运行当前生态适用的测试、静态检查", "__PREFLIGHT_STEP__")
    .replace("再执行 [cli.md](cli.md) 的“在项目目录保存 `.env`”小节", "先运行当前生态适用的测试、静态检查")
    .replace("__PREFLIGHT_STEP__", "再执行 [cli.md](cli.md) 的“在项目目录保存 `.env`”小节");
  assert.throws(() => validateCliProtocol(documents), /defer the key lifecycle until pre-start checks pass/);
});

test("forbids a separate prebuild when the credential launcher already builds", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo.replace(
    "不得在此之前再运行普通 debug 或 release 构建",
    "先运行普通 debug 和 release 构建",
  );
  assert.throws(() => validateCliProtocol(documents), /must not prebuild when the credential launcher already builds/);
});

test("counts the credential launcher build as the single build", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo.replace(
    "该入口此时完成的构建就是本次唯一构建",
    "启动后继续追加构建",
  );
  assert.throws(() => validateCliProtocol(documents), /as the single build/);
});

test("requires the skill entrypoint to use the CLI credential launcher for local real starts", () => {
  const documents = cloneDocuments();
  documents.skill = documents.skill.replace(
    "本地真实启动必须完整执行 EVA CLI 凭证流程并选择凭证路径启动入口",
    "可以任选启动入口",
  );
  assert.throws(() => validateCliProtocol(documents), /must require the CLI credential launcher/);
});

test("requires run-demo to select the CLI credential launcher before execution", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo.replace(
    "默认启动入口立即确定为凭证路径启动入口",
    "稍后决定启动入口",
  );
  assert.throws(
    () => validateCliProtocol(documents),
    /must choose the CLI credential launcher without a manual AK fallback/,
  );
});

test("forbids silently falling back when the credential path is blocked", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo.replace(
    "不得自动改用不带 AK 的普通启动入口",
    "可以自动改用普通启动入口",
  );
  assert.throws(() => validateCliProtocol(documents), /must not silently downgrade/);
});

test("rejects exact CLI command duplication outside cli.md", () => {
  const documents = cloneDocuments();
  documents.runDemo += "\nRun `eva whoami` before continuing.\n";
  assert.throws(() => validateCliProtocol(documents), /must link to cli.md instead of duplicating/);
});

function cloneDocuments() {
  return structuredClone(loadCliProtocolDocuments());
}
