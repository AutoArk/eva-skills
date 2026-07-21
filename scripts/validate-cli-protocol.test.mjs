import assert from "node:assert/strict";
import { test } from "node:test";

import { loadCliProtocolDocuments, validateCliProtocol } from "./validate-cli-protocol.mjs";

test("accepts the repository CLI protocol", () => {
  assert.deepEqual(validateCliProtocol(loadCliProtocolDocuments()), { files: 4 });
});

test("rejects a drifted CLI package name", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace("auteva-test-cli", "unconfirmed-cli-package");
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

test("rejects eva init without the key-name option", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace(
    "eva init --dir /private/tmp/cliTest --key-name 20260721135900_client_sdk_ts_browser",
    "eva init --dir /private/tmp/cliTest 20260721135900_client_sdk_ts_browser",
  );
  assert.throws(() => validateCliProtocol(documents), /must use eva init --dir path --key-name name/);
});

test("requires both Demo destination choices", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo.replace("用户给出的明确目标目录", "默认目录");
  assert.throws(() => validateCliProtocol(documents), /user-selected directory/);
});

test("requires the retrieved AK path to reach the documented Demo launcher", () => {
  const documents = cloneDocuments();
  documents.cli = documents.cli.replace("取得路径不等于流程完成", "取得路径后继续");
  assert.throws(() => validateCliProtocol(documents), /must bind a successful path to its consumer/);
});

test("retrieves and binds the credential path only after build checks", () => {
  const documents = cloneDocuments();
  documents.runDemo = documents.runDemo
    .replace("依次运行当前生态适用的静态检查", "__BUILD_STEP__")
    .replace("完整读取并执行 [cli.md](cli.md)", "依次运行当前生态适用的静态检查")
    .replace("__BUILD_STEP__", "完整读取并执行 [cli.md](cli.md)");
  assert.throws(() => validateCliProtocol(documents), /retrieve the credential path after build checks/);
});

test("rejects exact CLI command duplication outside cli.md", () => {
  const documents = cloneDocuments();
  documents.runDemo += "\nRun `eva whoami` before continuing.\n";
  assert.throws(() => validateCliProtocol(documents), /must link to cli.md instead of duplicating/);
});

function cloneDocuments() {
  return structuredClone(loadCliProtocolDocuments());
}
