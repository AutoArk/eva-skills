import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  loadSdkCatalog,
  validateGitHubReleaseMetadata,
  validateLocalNpmPackage,
  validateNpmRegistryMetadata,
  validatePubRegistryMetadata,
  validatePyPiRegistryMetadata,
  validateSdkCatalog,
} from "./validate-sdk-catalog.mjs";

test("accepts the repository SDK catalog without stored versions", () => {
  const sdks = validateSdkCatalog(loadSdkCatalog());
  assert.equal(sdks.length, 4);
  assert.equal(sdks[0].id, "client-sdk-typescript");
  assert.equal(sdks[0].distribution.defaultChannel, "latest");
  assert.equal(sdks[0].distribution.resolution.mode, "local-package");
  assert.match(sdks[0].distribution.resolution.value, /eva-client-sdk-ts-1\.0\.7-dev\.0\.tgz$/);
});

test("accepts the PyPI SDK distribution", () => {
  const sdk = validateSdkCatalog(loadSdkCatalog()).find((item) => item.id === "client-sdk-python");
  assert.equal(validatePyPiRegistryMetadata(sdk, {
    info: { name: "autoark-eva-client-sdk", version: "1.0.0" },
  }), "1.0.0");
});

test("rejects version fields anywhere in an SDK entry", () => {
  const catalog = structuredClone(loadSdkCatalog());
  catalog.sdks[0].distribution.version = "1.2.3-test.1";
  assert.throws(() => validateSdkCatalog(catalog), /version fields are forbidden/);
});

test("accepts an exact test version resolution", () => {
  const catalog = structuredClone(loadSdkCatalog());
  catalog.sdks[0].distribution.resolution = { mode: "version", value: "1.2.3" };
  assert.equal(validateSdkCatalog(catalog).length, 4);
});

test("rejects non-official public URLs", () => {
  const catalog = structuredClone(loadSdkCatalog());
  catalog.sdks[0].distribution.publicUrl = "https://example.com/eva-sdk";
  assert.throws(() => validateSdkCatalog(catalog), /official allowlist|npm public URL/);
});

test("resolves the default channel to an exact registry version", () => {
  const sdk = validateSdkCatalog(loadSdkCatalog())[0];
  const resolvedVersion = "1.2.3-test.1";
  assert.equal(validateNpmRegistryMetadata(sdk, {
    name: "@autoark-ai/eva-client-sdk-ts",
    "dist-tags": { latest: resolvedVersion },
  }), resolvedVersion);
  assert.throws(
    () => validateNpmRegistryMetadata(sdk, { name: sdk.distribution.package, "dist-tags": {} }),
    /default channel must resolve/,
  );
});

test("validates the configured local npm package identity and release evidence", () => {
  const sdk = structuredClone(validateSdkCatalog(loadSdkCatalog())[0]);
  const artifact = Buffer.from("local npm artifact");
  sdk.distribution.resolution.sha256 = createHash("sha256").update(artifact).digest("hex");
  const releaseManifest = {
    artifact: {
      sha256: sdk.distribution.resolution.sha256,
      payloadDigest: sdk.distribution.resolution.payloadDigest,
    },
    buildSourceSha: sdk.distribution.resolution.sourceCommit,
    package: { name: sdk.distribution.package, version: "1.0.7-dev.0" },
    source: { commit: sdk.distribution.resolution.sourceCommit, dirty: false },
  };
  const packageManifest = { name: sdk.distribution.package, version: "1.0.7-dev.0" };
  assert.equal(
    validateLocalNpmPackage(sdk, {
      artifact,
      releaseManifest,
      packageManifest,
      archiveEntries: ["package/", "package/package.json", "package/dist/index.js"],
    }),
    "1.0.7-dev.0",
  );
  assert.throws(
    () => validateLocalNpmPackage(sdk, {
      artifact: Buffer.from("changed"),
      releaseManifest,
      packageManifest,
      archiveEntries: ["package/package.json"],
    }),
    /SHA-256 mismatch/,
  );
  assert.throws(
    () => validateLocalNpmPackage(sdk, {
      artifact,
      releaseManifest,
      packageManifest,
      archiveEntries: ["package/package.json", "package/../escape"],
    }),
    /unsafe path/,
  );
});

test("rejects incomplete local package resolution metadata", () => {
  const catalog = structuredClone(loadSdkCatalog());
  delete catalog.sdks[0].distribution.resolution.payloadDigest;
  assert.throws(() => validateSdkCatalog(catalog), /fields must be/);
});

test("accepts the Pub SDK distribution and resolves its latest release", () => {
  const sdk = validateSdkCatalog(loadSdkCatalog()).find((item) => item.id === "client-sdk-flutter");
  assert.equal(validatePubRegistryMetadata(sdk, {
    name: "autoark_eva_client_sdk",
    latest: {
      version: "0.1.0",
      pubspec: { name: "autoark_eva_client_sdk" },
    },
  }), "0.1.0");
});

test("rejects drifted Pub package metadata and non-exact versions", () => {
  const sdk = validateSdkCatalog(loadSdkCatalog()).find((item) => item.id === "client-sdk-flutter");
  assert.throws(
    () => validatePubRegistryMetadata(sdk, {
      name: "another_package",
      latest: { version: "0.1.0", pubspec: { name: "another_package" } },
    }),
    /registry package name drifted/,
  );
  assert.throws(
    () => validatePubRegistryMetadata(sdk, {
      name: sdk.distribution.package,
      latest: { version: "latest", pubspec: { name: sdk.distribution.package } },
    }),
    /exact version/,
  );
});

test("accepts the official C++ GitHub Release and requires all platform assets", () => {
  const sdk = validateSdkCatalog(loadSdkCatalog()).find((item) => item.id === "client-sdk-cpp");
  const metadata = {
    tag_name: "0.1.0",
    draft: false,
    prerelease: false,
    assets: [
      { name: "eva-cpp-sdk-0.1.0-macos-arm64.tar.gz" },
      { name: "eva-cpp-sdk-0.1.0-macos-arm64.tar.gz.sha256" },
      { name: "eva-cpp-sdk-0.1.0-linux-arm64.tar.gz" },
      { name: "eva-cpp-sdk-0.1.0-linux-arm64.tar.gz.sha256" },
    ],
  };
  assert.equal(validateGitHubReleaseMetadata(sdk, metadata), "0.1.0");

  metadata.assets.pop();
  assert.throws(() => validateGitHubReleaseMetadata(sdk, metadata), /release checksum missing/);
});

test("rejects a non-official C++ Release repository", () => {
  const catalog = structuredClone(loadSdkCatalog());
  const cpp = catalog.sdks.find((item) => item.id === "client-sdk-cpp");
  cpp.distribution.repository = "someone/eva-cpp-sdk-release";
  assert.throws(() => validateSdkCatalog(catalog), /GitHub repository must be/);
});
