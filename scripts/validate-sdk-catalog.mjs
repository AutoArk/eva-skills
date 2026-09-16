#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultCatalogPath = resolve(repositoryRoot, "skills/eva-sdk/sdk-catalog.json");
const allowedPublicHosts = new Set(["www.npmjs.com", "pub.dev", "pypi.org", "github.com"]);
const officialCppRepository = "AutoArk/eva-cpp-sdk-release";
const exactVersionPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function loadSdkCatalog(path = defaultCatalogPath) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`SDK catalog is not valid JSON: ${error.message}`);
  }
}

export function validateSdkCatalog(catalog) {
  assertRecord(catalog, "SDK catalog");
  assertExactKeys(catalog, ["schemaVersion", "sdks"], "SDK catalog");
  assert(catalog.schemaVersion === 1, "SDK catalog schemaVersion must be 1");
  assert(Array.isArray(catalog.sdks) && catalog.sdks.length > 0, "SDK catalog must contain SDKs");

  const ids = new Set();
  const distributions = new Set();
  for (const sdk of catalog.sdks) {
    assertNoVersionFields(sdk, sdk.id ?? "SDK entry");
    assertRecord(sdk, "SDK entry");
    assertExactKeys(
      sdk,
      [
        "id",
        "sdkFamily",
        "language",
        "platforms",
        "status",
        "description",
        "distribution",
        "documentation",
      ],
      `SDK ${sdk.id ?? "<unknown>"}`,
    );
    assertIdentifier(sdk.id, "SDK id");
    assertIdentifier(sdk.sdkFamily, `${sdk.id}.sdkFamily`);
    assertIdentifier(sdk.language, `${sdk.id}.language`);
    assert(!ids.has(sdk.id), `duplicate SDK id: ${sdk.id}`);
    ids.add(sdk.id);
    assert(
      Array.isArray(sdk.platforms) && sdk.platforms.length > 0,
      `${sdk.id}.platforms must be non-empty`,
    );
    assert(new Set(sdk.platforms).size === sdk.platforms.length, `${sdk.id}.platforms must be unique`);
    sdk.platforms.forEach((platform) => assertIdentifier(platform, `${sdk.id}.platform`));
    assert(sdk.status === "published", `${sdk.id}.status must be published`);
    assertNonEmptyString(sdk.description, `${sdk.id}.description`);

    validateDistribution(sdk);
    const distributionKey = `${sdk.distribution.ecosystem}:${sdk.distribution.package}`;
    assert(!distributions.has(distributionKey), `duplicate SDK distribution: ${distributionKey}`);
    distributions.add(distributionKey);

    assert(
      Array.isArray(sdk.documentation) && sdk.documentation.length > 0,
      `${sdk.id}.documentation must be non-empty`,
    );
    for (const document of sdk.documentation) {
      assertRecord(document, `${sdk.id}.documentation item`);
      assertExactKeys(document, ["kind", "url"], `${sdk.id}.documentation item`);
      assertIdentifier(document.kind, `${sdk.id}.documentation.kind`);
      validatePublicUrl(document.url, `${sdk.id}.documentation.url`);
    }
  }

  return catalog.sdks;
}

export function validateNpmRegistryMetadata(sdk, metadata) {
  assert(sdk.distribution.ecosystem === "npm", `${sdk.id}: SDK is not npm-distributed`);
  assertRecord(metadata, `${sdk.id} registry metadata`);
  assert(metadata.name === sdk.distribution.package, `${sdk.id}: registry package name drifted`);
  assertRecord(metadata["dist-tags"], `${sdk.id} dist-tags`);
  const resolved = metadata["dist-tags"][sdk.distribution.defaultChannel];
  assertNonEmptyString(resolved, `${sdk.id}: default channel must resolve`);
  assert(
    exactVersionPattern.test(resolved),
    `${sdk.id}: default channel must resolve to an exact version`,
  );
  return resolved;
}

export function validatePyPiRegistryMetadata(sdk, metadata) {
  assert(sdk.distribution.ecosystem === "pypi", `${sdk.id}: SDK is not PyPI-distributed`);
  assertRecord(metadata, `${sdk.id} registry metadata`);
  assert(metadata.info?.name === sdk.distribution.package, `${sdk.id}: registry package name drifted`);
  const resolved = metadata.info?.version;
  assertNonEmptyString(resolved, `${sdk.id}: default channel must resolve`);
  assert(exactVersionPattern.test(resolved), `${sdk.id}: default channel must resolve to an exact version`);
  return resolved;
}

export function validatePubRegistryMetadata(sdk, metadata) {
  assert(sdk.distribution.ecosystem === "pub", `${sdk.id}: SDK is not pub-distributed`);
  assertRecord(metadata, `${sdk.id} registry metadata`);
  assert(metadata.name === sdk.distribution.package, `${sdk.id}: registry package name drifted`);
  assertRecord(metadata.latest, `${sdk.id} latest release`);
  assert(
    metadata.latest.pubspec?.name === sdk.distribution.package,
    `${sdk.id}: latest pubspec package name drifted`,
  );
  const resolved = metadata.latest.version;
  assertNonEmptyString(resolved, `${sdk.id}: default channel must resolve`);
  assert(exactVersionPattern.test(resolved), `${sdk.id}: default channel must resolve to an exact version`);
  return resolved;
}

export function validateGitHubReleaseMetadata(sdk, metadata) {
  assert(sdk.distribution.ecosystem === "github-release", `${sdk.id}: SDK is not GitHub Release-distributed`);
  assertRecord(metadata, `${sdk.id} release metadata`);
  assert(metadata.draft === false, `${sdk.id}: latest release must not be a draft`);
  assert(metadata.prerelease === false, `${sdk.id}: latest release must be stable`);
  const resolved = metadata.tag_name;
  assertNonEmptyString(resolved, `${sdk.id}: latest release tag must resolve`);
  assert(exactVersionPattern.test(resolved), `${sdk.id}: latest release tag must be an exact version without v`);
  assert(Array.isArray(metadata.assets), `${sdk.id}: release assets must be an array`);
  const assetNames = new Set(metadata.assets.map((asset) => asset?.name));
  for (const platform of sdk.platforms) {
    const archive = sdk.distribution.assetPattern
      .replace("{version}", resolved)
      .replace("{platform}", platform);
    assert(assetNames.has(archive), `${sdk.id}: release asset missing: ${archive}`);
    assert(
      assetNames.has(`${archive}${sdk.distribution.checksumSuffix}`),
      `${sdk.id}: release checksum missing: ${archive}${sdk.distribution.checksumSuffix}`,
    );
  }
  return resolved;
}

export function queryLiveSdkMetadata(sdk) {
  if (sdk.distribution.ecosystem === "pypi") {
    const output = execFileSync("curl", ["-fsSL", `https://pypi.org/pypi/${sdk.distribution.package}/json`], { encoding: "utf8" });
    return JSON.parse(output);
  }
  if (sdk.distribution.ecosystem === "pub") {
    const output = execFileSync(
      "curl",
      ["-fsSL", `https://pub.dev/api/packages/${sdk.distribution.package}`],
      { encoding: "utf8" },
    );
    return JSON.parse(output);
  }
  if (sdk.distribution.ecosystem === "github-release") {
    const output = execFileSync(
      "curl",
      [
        "-fsSL",
        "-H",
        "Accept: application/vnd.github+json",
        `https://api.github.com/repos/${sdk.distribution.repository}/releases/latest`,
      ],
      { encoding: "utf8" },
    );
    return JSON.parse(output);
  }
  if (sdk.distribution.ecosystem !== "npm") {
    throw new Error(`${sdk.id}: unsupported live distribution ${sdk.distribution.ecosystem}`);
  }
  const output = execFileSync(
    "npm",
    ["view", sdk.distribution.package, "name", "dist-tags", "--json"],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

function validateDistribution(sdk) {
  const distribution = sdk.distribution;
  assertRecord(distribution, `${sdk.id}.distribution`);
  const distributionFields = distribution.ecosystem === "github-release"
    ? [
        "ecosystem",
        "package",
        "repository",
        "resolution",
        "defaultChannel",
        "publicUrl",
        "assetPattern",
        "checksumSuffix",
      ]
    : ["ecosystem", "package", "resolution", "defaultChannel", "publicUrl"];
  assertExactKeys(distribution, distributionFields, `${sdk.id}.distribution`);
  if (!["npm", "pub", "pypi", "github-release"].includes(distribution.ecosystem)) {
    throw new Error(`${sdk.id}: unsupported distribution ecosystem ${distribution.ecosystem}`);
  }
  const packagePatterns = {
    npm: /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/,
    pub: /^[a-z][a-z0-9_]*$/,
    pypi: /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    "github-release": /^[A-Za-z][A-Za-z0-9]*$/,
  };
  const packagePattern = packagePatterns[distribution.ecosystem];
  assert(packagePattern.test(distribution.package), `${sdk.id}: invalid ${distribution.ecosystem} package`);
  assert(distribution.defaultChannel === "latest", `${sdk.id}: default channel must be latest`);
  validateResolution(distribution.resolution, `${sdk.id}.distribution.resolution`);
  validatePublicUrl(distribution.publicUrl, `${sdk.id}.distribution.publicUrl`);
  if (distribution.ecosystem === "github-release") {
    assert(distribution.repository === officialCppRepository, `${sdk.id}: GitHub repository must be ${officialCppRepository}`);
    assert(
      distribution.publicUrl === `https://github.com/${officialCppRepository}/releases`,
      `${sdk.id}: GitHub Release public URL must match the official repository`,
    );
    assert(
      distribution.assetPattern === "eva-cpp-sdk-{version}-{platform}.tar.gz",
      `${sdk.id}: unsupported GitHub Release asset pattern`,
    );
    assert(distribution.checksumSuffix === ".sha256", `${sdk.id}: checksum suffix must be .sha256`);
    return;
  }
  const expectedUrls = {
    npm: `https://www.npmjs.com/package/${distribution.package}`,
    pub: `https://pub.dev/packages/${distribution.package}`,
    pypi: `https://pypi.org/project/${distribution.package}/`,
  };
  const expectedUrl = expectedUrls[distribution.ecosystem];
  assert(
    distribution.publicUrl === expectedUrl,
    `${sdk.id}: ${distribution.ecosystem} public URL must be ${expectedUrl}`,
  );
}

function validateResolution(resolution, label) {
  assertRecord(resolution, label);
  const keys = Object.keys(resolution).sort();
  assert(keys.length === 1 || (keys.length === 2 && keys.includes("value")), `${label} has invalid fields`);
  assert(["latest-version", "version"].includes(resolution.mode), `${label}: unsupported mode`);
  if (resolution.mode === "latest-version") {
    assert(resolution.value === undefined, `${label}: latest mode must not define value`);
  } else {
    assert(typeof resolution.value === "string" && resolution.value.trim().length > 0, `${label}: value is required`);
  }
}

function validatePublicUrl(value, label) {
  assertNonEmptyString(value, label);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  assert(url.protocol === "https:", `${label} must use HTTPS`);
  assert(allowedPublicHosts.has(url.hostname), `${label} host is not in the official allowlist`);
}

function assertNoVersionFields(value, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoVersionFields(item, `${label}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    assert(!/version/i.test(key), `${label}: version fields are forbidden in SDK catalog (${key})`);
    assertNoVersionFields(child, `${label}.${key}`);
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

function assertIdentifier(value, label) {
  assert(typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), `${label} must be kebab-case`);
}

function assertNonEmptyString(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} must be a non-empty string`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const options = { live: false, path: defaultCatalogPath };
  for (const argument of argv) {
    if (argument === "--live") options.live = true;
    else if (options.path === defaultCatalogPath) options.path = resolve(argument);
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const sdks = validateSdkCatalog(loadSdkCatalog(options.path));
    const resolved = [];
    if (options.live) {
      for (const sdk of sdks) {
        const metadata = queryLiveSdkMetadata(sdk);
        const validators = {
          npm: validateNpmRegistryMetadata,
          pub: validatePubRegistryMetadata,
          pypi: validatePyPiRegistryMetadata,
          "github-release": validateGitHubReleaseMetadata,
        };
        const exact = validators[sdk.distribution.ecosystem](sdk, metadata);
        resolved.push(`${sdk.id}:${sdk.distribution.defaultChannel}->${exact}`);
      }
    }
    const suffix = resolved.length === 0 ? "" : ` (${resolved.join(", ")})`;
    console.log(`SDK catalog validation passed: ${sdks.length} SDK(s)${suffix}`);
  } catch (error) {
    console.error(`SDK catalog validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
