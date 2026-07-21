#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function listTree(root) {
  const files = [];
  visit(root, root, files);
  return files.sort();
}

export function compareTrees(expectedRoot, actualRoot) {
  const expectedFiles = listTree(expectedRoot);
  const actualFiles = listTree(actualRoot);
  assert(
    JSON.stringify(actualFiles) === JSON.stringify(expectedFiles),
    `installed file list differs\nexpected: ${expectedFiles.join(", ")}\nactual: ${actualFiles.join(", ")}`,
  );

  for (const path of expectedFiles) {
    const expected = readFileSync(join(expectedRoot, path));
    const actual = readFileSync(join(actualRoot, path));
    assert(expected.equals(actual), `installed file content differs: ${path}`);
  }

  return { files: expectedFiles.length };
}

export function smokeInstallSkill({
  root = repositoryRoot,
  cliPackage = "skills@latest",
} = {}) {
  const temporaryProject = mkdtempSync(join(tmpdir(), "eva-skill-install-"));
  try {
    const result = spawnSync(
      "npx",
      [
        "--yes",
        cliPackage,
        "add",
        root,
        "--skill",
        "eva-sdk",
        "--agent",
        "codex",
        "--copy",
        "--yes",
      ],
      {
        cwd: temporaryProject,
        encoding: "utf8",
        env: { ...process.env, CI: "1", DISABLE_TELEMETRY: "1" },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120_000,
      },
    );
    if (result.error !== undefined) throw result.error;
    if (result.status !== 0) {
      const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      throw new Error(`skills CLI install failed with exit ${result.status}${detail ? `\n${detail}` : ""}`);
    }

    const installedRoot = join(temporaryProject, ".agents", "skills", "eva-sdk");
    return compareTrees(join(root, "skills", "eva-sdk"), installedRoot);
  } finally {
    rmSync(temporaryProject, { recursive: true, force: true });
  }
}

function visit(root, current, files) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      visit(root, absolute, files);
    } else if (entry.isFile()) {
      files.push(relative(root, absolute).split(sep).join("/"));
    } else {
      throw new Error(`unsupported entry in skill tree: ${absolute}`);
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = smokeInstallSkill();
    console.log(`Skill install smoke test passed: ${result.files} installed file(s) match source`);
  } catch (error) {
    console.error(`Skill install smoke test failed: ${error.message}`);
    process.exitCode = 1;
  }
}
