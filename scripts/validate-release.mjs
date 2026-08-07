#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  posix,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OFFICIAL_EXAMPLES_REPOSITORY = "https://github.com/AutoArk/eva-sdk-examples.git";
const allowedGitRepositories = new Set([OFFICIAL_EXAMPLES_REPOSITORY]);
const allowedWebHosts = new Set(["eva.autoarkai.com"]);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const referenceSourcesPath = join(repositoryRoot, "skills/eva-sdk/reference-sources.json");
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const ignoredSourceDirectories = new Set([".git", "dist", "node_modules"]);

export function loadJson(path, label = path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

export function validateReferenceSources(config) {
  assertRecord(config, "reference sources");
  assertExactKeys(config, ["schemaVersion", "sources"], "reference sources");
  assert(config.schemaVersion === 1, "reference sources schemaVersion must be 1");
  assert(Array.isArray(config.sources) && config.sources.length > 0, "reference sources must be non-empty");

  const ids = new Set();
  for (const source of config.sources) {
    assertRecord(source, "reference source");
    if (source.kind === "git") {
      assertExactKeys(source, ["id", "purpose", "kind", "repository", "resolution", "paths"], `reference source ${source.id ?? "<unknown>"}`);
    } else if (source.kind === "web") {
      assertExactKeys(source, ["id", "purpose", "kind", "url", "format"], `reference source ${source.id ?? "<unknown>"}`);
      validatePublicSourceUrl(source.url, `${source.id}.url`);
      assert(source.format === "markdown", `${source.id}: unsupported web source format`);
    } else {
      throw new Error(`reference source ${source.id ?? "<unknown>"}: unsupported kind ${source.kind}`);
    }
    assertIdentifier(source.id, "reference source id");
    assertIdentifier(source.purpose, `${source.id}.purpose`);
    assert(!ids.has(source.id), `duplicate reference source id: ${source.id}`);
    ids.add(source.id);
    if (source.kind === "git") {
      assert(allowedGitRepositories.has(source.repository), `${source.id}: repository is not in the official allowlist: ${source.repository}`);
      validateResolution(source.resolution, `${source.id}.resolution`, new Set(["latest-tag", "tag", "branch"]));
      assertRecord(source.paths, `${source.id}.paths`);
      assert(Object.keys(source.paths).length > 0, `${source.id}.paths must be non-empty`);
      for (const [name, path] of Object.entries(source.paths)) {
        assertIdentifier(name, `${source.id}.paths key`);
        assertSafeRelativePath(path, `${source.id}.paths.${name}`);
      }
    }
  }
  return config;
}

export function selectReferenceSource(config, purpose) {
  const matches = config.sources.filter((source) => source.purpose === purpose);
  assert(matches.length === 1, `expected exactly one reference source for purpose ${purpose}, found ${matches.length}`);
  return matches[0];
}

export function selectLatestStableTag(tags) {
  assert(Array.isArray(tags), "tags must be an array");
  const candidates = [];
  for (const tag of new Set(tags)) {
    if (typeof tag !== "string") continue;
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag);
    if (match === null) continue;
    candidates.push({ tag, version: match.slice(1).map(Number) });
  }
  assert(candidates.length > 0, "official examples repository has no stable X.Y.Z tag");
  candidates.sort((left, right) => {
    for (let index = 0; index < 3; index += 1) {
      if (left.version[index] !== right.version[index]) return left.version[index] - right.version[index];
    }
    return 0;
  });
  return candidates.at(-1).tag;
}

function validateResolution(resolution, label, modes) {
  assertRecord(resolution, label);
  const keys = Object.keys(resolution).sort();
  assert(keys.length === 1 || (keys.length === 2 && keys.includes("value")), `${label} has invalid fields`);
  assert(typeof resolution.mode === "string" && modes.has(resolution.mode), `${label}: unsupported mode`);
  if (resolution.mode === "latest-tag" || resolution.mode === "latest-version") {
    assert(resolution.value === undefined, `${label}: latest mode must not define value`);
  } else {
    assert(typeof resolution.value === "string" && resolution.value.trim().length > 0, `${label}: value is required`);
  }
}

function validatePublicSourceUrl(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} must be a non-empty URL`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  assert(url.protocol === "https:", `${label} must use HTTPS`);
  assert(allowedWebHosts.has(url.hostname), `${label} host is not in the official allowlist`);
}

export function resolveLatestStableTag(repository) {
  const output = capture("git", ["ls-remote", "--tags", "--refs", repository]);
  const tags = output
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trim().split(/\s+/)[1])
    .filter((ref) => ref?.startsWith("refs/tags/"))
    .map((ref) => ref.slice("refs/tags/".length));
  return selectLatestStableTag(tags);
}

export function validateCatalog(examplesRoot, catalogPath = "examples.json") {
  const catalogFile = resolveWithin(examplesRoot, catalogPath, "catalogPath");
  assertFile(catalogFile, "catalog");
  const catalog = loadJson(catalogFile, "examples catalog");
  assertRecord(catalog, "examples catalog");
  assert(catalog.schemaVersion === 1, "examples catalog schemaVersion must be 1");
  assert(Array.isArray(catalog.examples) && catalog.examples.length > 0, "examples catalog must be non-empty");

  const ids = new Set();
  const paths = new Set();
  const validated = [];

  for (const example of catalog.examples) {
    assertRecord(example, "catalog example");
    for (const field of ["id", "sdkFamily", "language", "platform", "path", "status"]) {
      assertNonEmptyString(example[field], `${example.id ?? "catalog example"}.${field}`);
    }
    assert(!ids.has(example.id), `duplicate example id: ${example.id}`);
    ids.add(example.id);

    const normalizedPath = posix.normalize(example.path);
    const expectedPrefix = `${example.sdkFamily}/${example.language}/`;
    assert(
      normalizedPath === example.path
        && !posix.isAbsolute(normalizedPath)
        && !normalizedPath.startsWith("../")
        && normalizedPath.startsWith(expectedPrefix),
      `${example.id}: path must be normalized under <sdk-family>/<language>/`,
    );
    assert(!paths.has(normalizedPath), `duplicate example path: ${normalizedPath}`);
    paths.add(normalizedPath);

    const exampleRoot = resolveWithin(examplesRoot, normalizedPath, `${example.id}.path`);
    assertDirectory(exampleRoot, `${example.id} directory`);
    assertFile(join(exampleRoot, "README.md"), `${example.id} README`);
    assertRecord(example.sdk, `${example.id}.sdk`);
    assertNonEmptyString(example.sdk.ecosystem, `${example.id}.sdk.ecosystem`);

    if (example.sdk.ecosystem !== "npm") {
      throw new Error(`${example.id}: unsupported SDK ecosystem ${example.sdk.ecosystem}`);
    }
    validated.push(validateNpmExample(exampleRoot, example));
  }

  return validated;
}

export function validateNpmExample(exampleRoot, example) {
  assertNonEmptyString(example.sdk.package, `${example.id}.sdk.package`);
  const manifestPath = join(exampleRoot, "package.json");
  const lockPath = join(exampleRoot, "package-lock.json");
  assertFile(manifestPath, `${example.id} package.json`);
  assertFile(lockPath, `${example.id} package-lock.json`);

  const manifest = loadJson(manifestPath, `${example.id} package.json`);
  const lockText = readFileSync(lockPath, "utf8");
  const lock = loadJson(lockPath, `${example.id} package-lock.json`);
  const sdkPackage = example.sdk.package;
  const sdkVersion = manifest.dependencies?.[sdkPackage];

  assert(manifest.private === true, `${example.id}: demo package must be private`);
  assertNonEmptyString(manifest.scripts?.typecheck, `${example.id}: typecheck script`);
  assertNonEmptyString(manifest.scripts?.build, `${example.id}: build script`);
  assertNonEmptyString(manifest.scripts?.["dev:key-file"], `${example.id}: dev:key-file script`);
  assert(
    typeof sdkVersion === "string" && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(sdkVersion),
    `${example.id}: SDK dependency must use an exact registry version`,
  );
  assert(
    lock.packages?.[""]?.dependencies?.[sdkPackage] === sdkVersion,
    `${example.id}: lock root SDK dependency drifted`,
  );
  const installed = lock.packages?.[`node_modules/${sdkPackage}`];
  assert(installed?.version === sdkVersion, `${example.id}: locked SDK version drifted`);
  assert(
    typeof installed?.resolved === "string" && installed.resolved.startsWith("https://registry.npmjs.org/"),
    `${example.id}: SDK package must resolve from the public npm registry`,
  );
  assert(
    !/(?:file:|link:|workspace:|\/Users\/|[A-Za-z]:\\\\)/.test(lockText),
    `${example.id}: lockfile contains a local dependency source`,
  );

  return {
    ecosystem: "npm",
    example,
    exampleRoot,
    sdkPackage,
    sdkVersion,
  };
}

export function validateInstalledPublicImports(exampleRoot, sdkPackage) {
  const packageRoot = join(exampleRoot, "node_modules", ...sdkPackage.split("/"));
  const packageManifestPath = join(packageRoot, "package.json");
  assertFile(packageManifestPath, `${sdkPackage} installed package.json`);
  const packageManifest = loadJson(packageManifestPath, `${sdkPackage} installed package.json`);
  const exportedSubpaths = collectExportedSubpaths(packageManifest.exports);
  const imports = collectSourceImports(exampleRoot)
    .filter((specifier) => specifier === sdkPackage || specifier.startsWith(`${sdkPackage}/`));

  assert(imports.length > 0, `example does not import ${sdkPackage}`);
  for (const specifier of imports) {
    const subpath = specifier === sdkPackage ? "." : `./${specifier.slice(sdkPackage.length + 1)}`;
    assert(
      isExportedSubpath(subpath, exportedSubpaths),
      `forbidden non-exported SDK import: ${specifier}`,
    );
  }
  return [...new Set(imports)].sort();
}

export function collectExportedSubpaths(exportsField) {
  if (exportsField === undefined) return ["."];
  if (typeof exportsField === "string" || Array.isArray(exportsField)) return ["."];
  assertRecord(exportsField, "installed package exports");
  const keys = Object.keys(exportsField);
  if (keys.some((key) => key.startsWith("."))) return keys;
  return ["."];
}

export function collectSourceImports(root) {
  const imports = [];
  for (const file of walkSourceFiles(root)) {
    const source = readFileSync(file, "utf8");
    const patterns = [
      /\bfrom\s+["']([^"']+)["']/g,
      /\bimport\s*(?:\(\s*)?["']([^"']+)["']/g,
      /\brequire\s*\(\s*["']([^"']+)["']/g,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) imports.push(match[1]);
    }
  }
  return imports;
}

export function runReleaseValidation({ sourceDir, skipBuild = false, keepTemp = false } = {}) {
  const registry = validateReferenceSources(loadJson(referenceSourcesPath, "reference sources"));
  const config = selectReferenceSource(registry, "examples-catalog");
  assert(config.repository === OFFICIAL_EXAMPLES_REPOSITORY, "examples catalog repository is not official");
  assert(config.resolution.mode === "latest-tag", "release validation requires latest-tag examples resolution");
  assert(config.paths.catalog === "examples.json", "examples catalog path must be examples.json");
  let temporaryRoot;
  let examplesRoot;
  let ref;

  try {
    if (sourceDir === undefined) {
      temporaryRoot = mkdtempSync(join(tmpdir(), "eva-sdk-release-"));
      examplesRoot = join(temporaryRoot, "examples");
      ref = resolveLatestStableTag(config.repository);
      run("git", ["clone", "--branch", ref, "--depth", "1", config.repository, examplesRoot]);
    } else {
      examplesRoot = resolve(sourceDir);
      assertDirectory(examplesRoot, "source directory");
      ref = capture("git", ["-C", examplesRoot, "describe", "--tags", "--exact-match", "HEAD"]);
      selectLatestStableTag([ref]);
    }

    const head = capture("git", ["-C", examplesRoot, "rev-parse", "HEAD"]);
    const tagCommit = capture("git", ["-C", examplesRoot, "rev-list", "-n", "1", ref]);
    assert(head === tagCommit, `checked-out commit ${head} does not match resolved tag ${ref} @ ${tagCommit}`);
    const repositoryValidator = join(examplesRoot, "scripts", "verify-catalog.mjs");
    assertFile(repositoryValidator, "repository catalog validator");
    run(process.execPath, [repositoryValidator], { cwd: examplesRoot });

    const examples = validateCatalog(examplesRoot, config.paths.catalog);
    if (!skipBuild) {
      for (const item of examples) {
        run("npm", ["ci"], { cwd: item.exampleRoot });
        validateInstalledPublicImports(item.exampleRoot, item.sdkPackage);
        run("npm", ["run", "build"], { cwd: item.exampleRoot });
      }
    }

    const dirty = capture("git", ["-C", examplesRoot, "status", "--porcelain"]);
    assert(dirty.length === 0, `release validation modified tracked files:\n${dirty}`);
    return {
      commit: head,
      examples: examples.map((item) => ({
        id: item.example.id,
        sdkPackage: item.sdkPackage,
        sdkVersion: item.sdkVersion,
      })),
      ref,
    };
  } finally {
    if (temporaryRoot !== undefined && !keepTemp) rmSync(temporaryRoot, { force: true, recursive: true });
    if (temporaryRoot !== undefined && keepTemp) console.log(`kept temporary clone: ${temporaryRoot}`);
  }
}

function walkSourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredSourceDirectories.has(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkSourceFiles(path));
    if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function isExportedSubpath(subpath, exportedSubpaths) {
  return exportedSubpaths.some((pattern) => {
    if (pattern === subpath) return true;
    const star = pattern.indexOf("*");
    if (star === -1) return false;
    return subpath.startsWith(pattern.slice(0, star)) && subpath.endsWith(pattern.slice(star + 1));
  });
}

function resolveWithin(root, relativePath, label) {
  assertNonEmptyString(relativePath, label);
  assert(!isAbsolute(relativePath), `${label} must be relative`);
  const resolvedRoot = resolve(root);
  const resolved = resolve(resolvedRoot, relativePath);
  assert(resolved.startsWith(`${resolvedRoot}${sep}`), `${label} escapes repository root`);
  return resolved;
}

function assertFile(path, label) {
  try {
    assert(statSync(path).isFile(), `${label} must be a file`);
  } catch (error) {
    if (error.message === `${label} must be a file`) throw error;
    throw new Error(`${label} is missing: ${path}`);
  }
}

function assertDirectory(path, label) {
  try {
    assert(statSync(path).isDirectory(), `${label} must be a directory`);
  } catch (error) {
    if (error.message === `${label} must be a directory`) throw error;
    throw new Error(`${label} is missing: ${path}`);
  }
}

function assertRecord(value, label) {
  assert(typeof value === "object" && value !== null && !Array.isArray(value), `${label} must be an object`);
}

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} fields must be ${expected.join(", ")}`);
}

function assertNonEmptyString(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} must be a non-empty string`);
}

function assertIdentifier(value, label) {
  assert(
    typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    `${label} must be kebab-case`,
  );
}

function assertSafeRelativePath(value, label) {
  assertNonEmptyString(value, label);
  const normalized = posix.normalize(value);
  assert(
    normalized === value && !posix.isAbsolute(value) && value !== ".." && !value.startsWith("../"),
    `${label} must be a normalized relative path`,
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

function capture(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function parseArgs(argv) {
  const options = { keepTemp: false, skipBuild: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--skip-build") options.skipBuild = true;
    else if (argument === "--keep-temp") options.keepTemp = true;
    else if (argument === "--source-dir") {
      index += 1;
      assert(argv[index] !== undefined, "--source-dir requires a path");
      options.sourceDir = argv[index];
    } else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = runReleaseValidation(parseArgs(process.argv.slice(2)));
    console.log(`release validation passed: ${result.ref} @ ${result.commit}, ${result.examples.length} example(s)`);
  } catch (error) {
    console.error(`release validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
