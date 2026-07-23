import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  selectReferenceSource,
  validateCatalog,
  validateInstalledPublicImports,
  validateReferenceSources,
} from "./validate-release.mjs";

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

test("accepts an extensible registry and selects the examples catalog by purpose", () => {
  const registry = validateReferenceSources({
    schemaVersion: 1,
    sources: [createReferenceSource(), {
      ...createReferenceSource(),
      id: "eva-sdk-examples-readme",
      purpose: "public-docs",
      paths: { readme: "README.md" },
    }],
  });
  assert.equal(registry.sources.length, 2);
  assert.deepEqual(selectReferenceSource(registry, "examples-catalog"), createReferenceSource());
});

test("rejects branch refs and unapproved repositories", () => {
  assert.throws(
    () => validateReferenceSources({ schemaVersion: 1, sources: [{ ...createReferenceSource(), ref: "main" }] }),
    /immutable tag/,
  );
  assert.throws(
    () => validateReferenceSources({
      schemaVersion: 1,
      sources: [{ ...createReferenceSource(), repository: "https://example.com/mirror.git" }],
    }),
    /official allowlist/,
  );
});

test("rejects duplicate source ids and ambiguous purposes", () => {
  const source = createReferenceSource();
  assert.throws(
    () => validateReferenceSources({ schemaVersion: 1, sources: [source, source] }),
    /duplicate reference source id/,
  );
  const registry = validateReferenceSources({
    schemaVersion: 1,
    sources: [source, { ...source, id: "second-examples-source" }],
  });
  assert.throws(() => selectReferenceSource(registry, "examples-catalog"), /exactly one/);
});

test("validates an npm catalog, exact lock, and exported SDK imports", () => {
  const fixture = createNpmFixture();
  const examples = validateCatalog(fixture.root);
  assert.equal(examples.length, 1);
  assert.deepEqual(
    validateInstalledPublicImports(fixture.exampleRoot, "@autoark-ai/eva-client-sdk-ts"),
    ["@autoark-ai/eva-client-sdk-ts", "@autoark-ai/eva-client-sdk-ts/browser"],
  );
});

test("rejects catalog paths that escape or disagree with family/language", () => {
  const fixture = createNpmFixture();
  const catalogPath = join(fixture.root, "examples.json");
  const catalog = JSON.parse(fixture.catalogText);
  catalog.examples[0].path = "../outside";
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  assert.throws(() => validateCatalog(fixture.root), /path must be normalized/);
});

test("rejects lockfile SDK version drift", () => {
  const fixture = createNpmFixture();
  const lockPath = join(fixture.exampleRoot, "package-lock.json");
  const lock = JSON.parse(fixture.lockText);
  lock.packages["node_modules/@autoark-ai/eva-client-sdk-ts"].version = "9.9.9";
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  assert.throws(() => validateCatalog(fixture.root), /locked SDK version drifted/);
});

test("rejects SDK imports that are not declared in package exports", () => {
  const fixture = createNpmFixture();
  writeFileSync(
    join(fixture.exampleRoot, "src", "internal.ts"),
    'import value from "@autoark-ai/eva-client-sdk-ts/internal";\nexport default value;\n',
  );
  assert.throws(
    () => validateInstalledPublicImports(fixture.exampleRoot, "@autoark-ai/eva-client-sdk-ts"),
    /forbidden non-exported SDK import/,
  );
});

function createNpmFixture() {
  const root = mkdtempSync(join(tmpdir(), "eva-release-test-"));
  temporaryRoots.push(root);
  const fixtureSdkVersion = "1.2.3-test.1";
  const exampleRoot = join(root, "client-sdk", "ts", "demo");
  const sdkRoot = join(exampleRoot, "node_modules", "@autoark-ai", "eva-client-sdk-ts");
  mkdirSync(join(exampleRoot, "src"), { recursive: true });
  mkdirSync(sdkRoot, { recursive: true });

  const catalog = {
    schemaVersion: 1,
    examples: [{
      id: "client-sdk-ts-demo",
      sdkFamily: "client-sdk",
      language: "ts",
      platform: "browser",
      path: "client-sdk/ts/demo",
      sdk: { ecosystem: "npm", package: "@autoark-ai/eva-client-sdk-ts" },
      status: "dev",
    }],
  };
  const manifest = {
    name: "fixture",
    private: true,
    version: "0.0.0",
    scripts: {
      build: "node --version",
      "dev:key-file": "node launcher.mjs",
      typecheck: "node --version",
    },
    dependencies: { "@autoark-ai/eva-client-sdk-ts": fixtureSdkVersion },
  };
  const lock = {
    name: "fixture",
    version: "0.0.0",
    lockfileVersion: 3,
    packages: {
      "": {
        name: "fixture",
        version: "0.0.0",
        dependencies: { "@autoark-ai/eva-client-sdk-ts": fixtureSdkVersion },
      },
      "node_modules/@autoark-ai/eva-client-sdk-ts": {
        version: fixtureSdkVersion,
        resolved: `https://registry.npmjs.org/@autoark-ai/eva-client-sdk-ts/-/eva-client-sdk-ts-${fixtureSdkVersion}.tgz`,
      },
    },
  };

  const catalogText = `${JSON.stringify(catalog, null, 2)}\n`;
  const lockText = `${JSON.stringify(lock, null, 2)}\n`;
  writeFileSync(join(root, "examples.json"), catalogText);
  writeFileSync(join(exampleRoot, "README.md"), "# Demo\n");
  writeFileSync(join(exampleRoot, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(exampleRoot, "package-lock.json"), lockText);
  writeFileSync(
    join(exampleRoot, "src", "main.ts"),
    'import { Eva } from "@autoark-ai/eva-client-sdk-ts";\nimport "@autoark-ai/eva-client-sdk-ts/browser";\nvoid Eva;\n',
  );
  writeFileSync(join(sdkRoot, "package.json"), `${JSON.stringify({
    name: "@autoark-ai/eva-client-sdk-ts",
    exports: { ".": "./index.js", "./browser": "./browser.js" },
  }, null, 2)}\n`);

  return { catalogText, exampleRoot, lockText, root };
}

function createReferenceSource() {
  return {
    id: "eva-sdk-examples",
    purpose: "examples-catalog",
    kind: "git",
    repository: "https://github.com/AutoArk/eva-sdk-examples.git",
    ref: "0.0.3",
    commit: "9437fd633beb75c7c54d4922ea35bd18846bf8eb",
    paths: { catalog: "examples.json" },
  };
}
