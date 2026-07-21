#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultCatalogPath = resolve(repositoryRoot, "skills/eva-sdk/sdk-catalog.json");
const allowedPublicHosts = new Set(["www.npmjs.com"]);

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
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(resolved),
    `${sdk.id}: default channel must resolve to an exact version`,
  );
  return resolved;
}

export function queryLiveSdkMetadata(sdk) {
  if (sdk.distribution.ecosystem !== "npm") {
    throw new Error(`${sdk.id}: unsupported live distribution ${sdk.distribution.ecosystem}`);
  }
  const output = execFileSync(
    "npm",
    ["view", sdk.distribution.package, "name", "dist-tags", "--json"],
    { encoding: "utf8" },
  );
  return JSON.parse(output);
}

function validateDistribution(sdk) {
  const distribution = sdk.distribution;
  assertRecord(distribution, `${sdk.id}.distribution`);
  assertExactKeys(
    distribution,
    ["ecosystem", "package", "defaultChannel", "publicUrl"],
    `${sdk.id}.distribution`,
  );
  if (distribution.ecosystem !== "npm") {
    throw new Error(`${sdk.id}: unsupported distribution ecosystem ${distribution.ecosystem}`);
  }
  assert(
    /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(distribution.package),
    `${sdk.id}: invalid npm package`,
  );
  assert(distribution.defaultChannel === "latest", `${sdk.id}: default channel must be latest`);
  validatePublicUrl(distribution.publicUrl, `${sdk.id}.distribution.publicUrl`);
  const expectedUrl = `https://www.npmjs.com/package/${distribution.package}`;
  assert(distribution.publicUrl === expectedUrl, `${sdk.id}: npm public URL must be ${expectedUrl}`);
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
        const exact = validateNpmRegistryMetadata(sdk, queryLiveSdkMetadata(sdk));
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
