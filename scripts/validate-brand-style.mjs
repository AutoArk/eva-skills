#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const humanFacingExtensions = new Set([".json", ".md", ".yaml", ".yml"]);
const mixedCaseProductPattern = new RegExp("\\bE" + "va\\b", "u");

export function loadBrandDocuments(root = repositoryRoot) {
  const paths = [
    join(root, "README.md"),
    join(root, "evals", "eva-sdk.json"),
    ...walkHumanFacingFiles(join(root, "skills", "eva-sdk")),
  ];
  return Object.fromEntries(
    paths.sort().map((path) => [relative(root, path), readFileSync(path, "utf8")]),
  );
}

export function validateBrandStyle(documents) {
  for (const [path, content] of Object.entries(documents)) {
    assert(typeof content === "string" && content.length > 0, `${path} must be non-empty`);
    assert(
      !mixedCaseProductPattern.test(content),
      `${path} contains mixed-case product spelling; use EVA in prose`,
    );
  }

  const readme = documents["README.md"];
  const skill = documents["skills/eva-sdk/SKILL.md"];
  const cli = documents["skills/eva-sdk/references/cli.md"];
  assert(readme.startsWith("# EVA Skills\n"), "README title must use EVA");
  assert(readme.includes("EVA 生态相关 agent skills"), "README must describe the broader EVA ecosystem");
  assert(!readme.includes("面向 EVA SDK 使用者"), "README must not narrow the repository to SDK users");
  assert(skill.includes("name: eva-sdk"), "skill identifier must remain lowercase eva-sdk");
  assert(cli.includes("`eva whoami`"), "CLI executable identifier must remain lowercase eva");

  return { files: Object.keys(documents).length };
}

function walkHumanFacingFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkHumanFacingFiles(path));
    if (entry.isFile() && humanFacingExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = validateBrandStyle(loadBrandDocuments());
    console.log(`Brand style validation passed: ${result.files} human-facing file(s)`);
  } catch (error) {
    console.error(`Brand style validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
