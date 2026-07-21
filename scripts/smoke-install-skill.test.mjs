import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { compareTrees, listTree } from "./smoke-install-skill.mjs";

test("lists a skill tree in stable relative-path order", () => {
  withFixture((expected) => {
    assert.deepEqual(listTree(expected), ["SKILL.md", "references/cli.md"]);
  });
});

test("accepts byte-identical installed skill trees", () => {
  withFixture((expected, actual) => {
    assert.deepEqual(compareTrees(expected, actual), { files: 2 });
  });
});

test("rejects an installed skill with changed content", () => {
  withFixture((expected, actual) => {
    writeFileSync(join(actual, "SKILL.md"), "changed\n");
    assert.throws(() => compareTrees(expected, actual), /content differs: SKILL.md/);
  });
});

test("rejects an installed skill with a changed file list", () => {
  withFixture((expected, actual) => {
    writeFileSync(join(actual, "unexpected.txt"), "unexpected\n");
    assert.throws(() => compareTrees(expected, actual), /installed file list differs/);
  });
});

function withFixture(callback) {
  const root = mkdtempSync(join(tmpdir(), "eva-skill-tree-test-"));
  const expected = join(root, "expected");
  const actual = join(root, "actual");
  for (const directory of [expected, actual]) {
    mkdirSync(join(directory, "references"), { recursive: true });
    writeFileSync(join(directory, "SKILL.md"), "---\nname: eva-sdk\n---\n");
    writeFileSync(join(directory, "references", "cli.md"), "# CLI\n");
  }
  try {
    callback(expected, actual);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
