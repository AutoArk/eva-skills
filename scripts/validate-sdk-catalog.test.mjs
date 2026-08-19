import assert from "node:assert/strict";
import { test } from "node:test";

import {
  loadSdkCatalog,
  validateNpmRegistryMetadata,
  validatePubRegistryMetadata,
  validatePyPiRegistryMetadata,
  validateSdkCatalog,
} from "./validate-sdk-catalog.mjs";

test("accepts the repository SDK catalog without stored versions", () => {
  const sdks = validateSdkCatalog(loadSdkCatalog());
  assert.equal(sdks.length, 3);
  assert.equal(sdks[0].id, "client-sdk-typescript");
  assert.equal(sdks[0].distribution.defaultChannel, "latest");
  assert.deepEqual(sdks[0].distribution.resolution, { mode: "latest-version" });
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
  assert.equal(validateSdkCatalog(catalog).length, 3);
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
