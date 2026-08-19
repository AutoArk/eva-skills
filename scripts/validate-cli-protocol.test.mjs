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

test("retrieves and binds the credential path only after build checks", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo
    .replace("依次运行当前生态适用的静态检查", "__BUILD_STEP__")
    .replace("完整读取并执行 [cli.md](cli.md)", "依次运行当前生态适用的静态检查")
    .replace("__BUILD_STEP__", "完整读取并执行 [cli.md](cli.md)");
  assert.throws(() => validateCliProtocol(documents), /retrieve the credential path after build checks/);
});

test("requires the skill entrypoint to prefer the credential launcher", () => {
  const documents = cloneDocuments();
  documents.skill = documents.skill.replace(
    "默认必须完整执行 EVA CLI 凭证流程并选择凭证路径启动入口",
    "可以任选启动入口",
  );
  assert.throws(() => validateCliProtocol(documents), /must prefer the credential launcher/);
});

test("requires run-demo to select the AK launcher before execution", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo.replace(
    "默认启动入口立即确定为凭证路径启动入口",
    "稍后决定启动入口",
  );
  assert.throws(
    () => validateCliProtocol(documents),
    /must choose the credential launcher unless runtime AK input was explicitly requested/,
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
