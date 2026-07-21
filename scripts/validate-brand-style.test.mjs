import assert from "node:assert/strict";
import { test } from "node:test";

import { loadBrandDocuments, validateBrandStyle } from "./validate-brand-style.mjs";

test("accepts the repository brand style", () => {
  assert.deepEqual(validateBrandStyle(loadBrandDocuments()), { files: 10 });
});

test("rejects mixed-case product spelling in prose", () => {
  const documents = cloneDocuments();
  documents["README.md"] += ["\nE", "va SDK\n"].join("");
  assert.throws(() => validateBrandStyle(documents), /mixed-case product spelling/);
});

test("requires the broader EVA ecosystem positioning", () => {
  const documents = cloneDocuments();
  documents["README.md"] = documents["README.md"].replace(
    "EVA 生态相关 agent skills",
    "EVA SDK 使用者",
  );
  assert.throws(() => validateBrandStyle(documents), /broader EVA ecosystem/);
});

test("protects lowercase identifiers", () => {
  const documents = cloneDocuments();
  documents["skills/eva-sdk/SKILL.md"] = documents["skills/eva-sdk/SKILL.md"].replace(
    "name: eva-sdk",
    "name: EVA-SDK",
  );
  assert.throws(() => validateBrandStyle(documents), /identifier must remain lowercase/);
});

function cloneDocuments() {
  return structuredClone(loadBrandDocuments());
}
