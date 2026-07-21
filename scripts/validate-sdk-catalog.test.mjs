import assert from "node:assert/strict";
import { test } from "node:test";

import {
  loadSdkCatalog,
  validateNpmRegistryMetadata,
  validateSdkCatalog,
} from "./validate-sdk-catalog.mjs";

test("accepts the repository SDK catalog without stored versions", () => {
  const sdks = validateSdkCatalog(loadSdkCatalog());
  assert.equal(sdks.length, 1);
  assert.equal(sdks[0].id, "client-sdk-typescript");
  assert.equal(sdks[0].distribution.defaultChannel, "latest");
});

test("rejects version fields anywhere in an SDK entry", () => {
  const catalog = structuredClone(loadSdkCatalog());
  catalog.sdks[0].distribution.version = "0.0.3-dev";
  assert.throws(() => validateSdkCatalog(catalog), /version fields are forbidden/);
});

test("rejects non-official public URLs", () => {
  const catalog = structuredClone(loadSdkCatalog());
  catalog.sdks[0].distribution.publicUrl = "https://example.com/eva-sdk";
  assert.throws(() => validateSdkCatalog(catalog), /official allowlist|npm public URL/);
});

test("resolves the default channel to an exact registry version", () => {
  const sdk = validateSdkCatalog(loadSdkCatalog())[0];
  assert.equal(validateNpmRegistryMetadata(sdk, {
    name: "@autoark-ai/eva-client-sdk-ts",
    "dist-tags": { latest: "0.0.3-dev", dev: "0.0.3-dev" },
  }), "0.0.3-dev");
  assert.throws(
    () => validateNpmRegistryMetadata(sdk, { name: sdk.distribution.package, "dist-tags": {} }),
    /default channel must resolve/,
  );
});
