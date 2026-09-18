import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  selectLatestStableTag,
  selectReferenceSource,
  validateCatalog,
  validateDartPublicImports,
  validateInstalledPublicImports,
  validateReleaseSdkResolutions,
  validateReferenceSources,
} from "./validate-release.mjs";
import { loadSdkCatalog, validateSdkCatalog } from "./validate-sdk-catalog.mjs";

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

test("accepts the official model catalog web source", () => {
  const registry = validateReferenceSources({
    schemaVersion: 1,
    sources: [{
      id: "eva-gateway-model-list",
      purpose: "model-catalog",
      kind: "web",
      url: "https://eva.autoarkai.com/api-docs/guide/gateway-model-list.md",
      format: "markdown",
    }],
  });
  assert.equal(registry.sources[0].purpose, "model-catalog");
});

test("requires a valid resolution policy and official repository", () => {
  assert.throws(
    () => validateReferenceSources({
      schemaVersion: 1,
      sources: [{ ...createReferenceSource(), resolution: { mode: "main" } }],
    }),
    /unsupported mode/,
  );
  assert.throws(
    () => validateReferenceSources({
      schemaVersion: 1,
      sources: [{ ...createReferenceSource(), repository: "https://example.com/mirror.git" }],
    }),
    /official allowlist/,
  );
});

test("release validation requires default SDK dependency resolution", () => {
  const testSdks = validateSdkCatalog(loadSdkCatalog());
  assert.throws(
    () => validateReleaseSdkResolutions(testSdks),
    /requires latest-version SDK resolution: client-sdk-typescript/,
  );

  const releaseSdks = structuredClone(testSdks);
  releaseSdks[0].distribution.resolution = { mode: "latest-version" };
  assert.equal(validateReleaseSdkResolutions(releaseSdks).length, 4);
});

test("selects the highest stable numeric SemVer tag", () => {
  assert.equal(
    selectLatestStableTag(["0.0.9", "0.0.10", "0.1.0-beta.1", "v1.0.0", "main", "0.1.0"]),
    "0.1.0",
  );
  assert.throws(
    () => selectLatestStableTag(["main", "v1.0.0", "1.0.0-rc.1"]),
    /no stable X.Y.Z tag/,
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

test("validates a PyPI catalog, uv lock, registry sources, and public imports", () => {
  const fixture = createPyPiFixture();
  const examples = validateCatalog(fixture.root);
  assert.equal(examples.length, 1);
  assert.equal(examples[0].sdkVersion, "1.0.0");
  assert.deepEqual(examples[0].publicImports, [
    "eva_client_sdk",
    "eva_client_sdk.contracts",
    "eva_client_sdk.media",
  ]);
});

test("rejects PyPI project and lock version drift", () => {
  const fixture = createPyPiFixture();
  writeFileSync(
    join(fixture.exampleRoot, "pyproject.toml"),
    fixture.pyprojectText.replace("==1.0.0", "==1.0.1"),
  );
  assert.throws(() => validateCatalog(fixture.root), /uv.lock SDK version drifted/);
});

test("rejects non-PyPI and local uv lock sources", () => {
  const registryFixture = createPyPiFixture();
  writeFileSync(
    join(registryFixture.exampleRoot, "uv.lock"),
    registryFixture.lockText.replace("https://pypi.org/simple", "https://example.com/simple"),
  );
  assert.throws(() => validateCatalog(registryFixture.root), /must resolve from https:\/\/pypi.org\/simple/);

  const localFixture = createPyPiFixture();
  writeFileSync(
    join(localFixture.exampleRoot, "uv.lock"),
    `${localFixture.lockText}\n[[package]]\nname = "local-helper"\nversion = "0.1.0"\nsource = { editable = "../helper" }\n`,
  );
  assert.throws(() => validateCatalog(localFixture.root), /forbidden source/);

  const virtualFixture = createPyPiFixture();
  writeFileSync(
    join(virtualFixture.exampleRoot, "uv.lock"),
    `${virtualFixture.lockText}\n[[package]]\nname = "virtual-helper"\nversion = "0.1.0"\nsource = { virtual = "." }\n`,
  );
  assert.throws(() => validateCatalog(virtualFixture.root), /must use source/);
});

test("rejects non-public Python SDK imports", () => {
  const fixture = createPyPiFixture();
  writeFileSync(
    join(fixture.exampleRoot, "internal.py"),
    "from eva_client_sdk.internal import secret\n",
  );
  assert.throws(() => validateCatalog(fixture.root), /forbidden non-public SDK import/);
});

test("validates a Pub catalog, exact lock, checksum, and public Dart imports", () => {
  const fixture = createPubFixture();
  const examples = validateCatalog(fixture.root);
  assert.equal(examples.length, 1);
  assert.equal(examples[0].sdkVersion, "0.1.0");
  assert.deepEqual(
    validateDartPublicImports(fixture.exampleRoot, "autoark_eva_client_sdk"),
    ["package:autoark_eva_client_sdk/autoark_eva_client_sdk.dart"],
  );
});

test("validates a CMake example pinned to an exact GitHub Release", () => {
  const fixture = createCmakeFixture();
  const examples = validateCatalog(fixture.root);
  assert.equal(examples.length, 1);
  assert.equal(examples[0].sdkPackage, "EvaClient");
  assert.equal(examples[0].sdkVersion, "0.1.0");
});

test("rejects CMake examples that bypass the public Release checksum", () => {
  const fixture = createCmakeFixture();
  writeFileSync(
    join(fixture.exampleRoot, "scripts", "prepare-sdk.mjs"),
    'const url = "https://github.com/AutoArk/eva-cpp-sdk-release/releases/download/0.1.0/sdk.tar.gz";\n',
  );
  assert.throws(() => validateCatalog(fixture.root), /verify the published checksum/);
});

test("rejects Pub manifest and lock version drift", () => {
  const fixture = createPubFixture();
  writeFileSync(
    join(fixture.exampleRoot, "pubspec.yaml"),
    fixture.pubspecText.replace("autoark_eva_client_sdk: 0.1.0", "autoark_eva_client_sdk: 0.1.1"),
  );
  assert.throws(() => validateCatalog(fixture.root), /pub lock SDK version drifted/);
});

test("rejects non-pub.dev sources and local Pub overrides", () => {
  const registryFixture = createPubFixture();
  writeFileSync(
    join(registryFixture.exampleRoot, "pubspec.lock"),
    registryFixture.lockText.replace("https://pub.dev", "https://example.com"),
  );
  assert.throws(() => validateCatalog(registryFixture.root), /must resolve from pub.dev/);

  const overrideFixture = createPubFixture();
  writeFileSync(
    join(overrideFixture.exampleRoot, "pubspec_overrides.yaml"),
    "dependency_overrides:\n  autoark_eva_client_sdk:\n    path: ../sdk\n",
  );
  assert.throws(() => validateCatalog(overrideFixture.root), /disable the local SDK override/);
});

test("rejects non-public Dart SDK imports", () => {
  const fixture = createPubFixture();
  writeFileSync(
    join(fixture.exampleRoot, "lib", "internal.dart"),
    "import 'package:autoark_eva_client_sdk/src/agent.dart';\n",
  );
  assert.throws(() => validateCatalog(fixture.root), /forbidden non-public SDK import/);
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

function createPyPiFixture() {
  const root = mkdtempSync(join(tmpdir(), "eva-release-python-test-"));
  temporaryRoots.push(root);
  const exampleRoot = join(root, "client-sdk", "python", "demo");
  mkdirSync(exampleRoot, { recursive: true });
  const catalog = {
    schemaVersion: 1,
    examples: [{
      id: "client-sdk-python-demo",
      sdkFamily: "client-sdk",
      language: "python",
      platform: "terminal",
      path: "client-sdk/python/demo",
      sdk: { ecosystem: "pypi", package: "autoark-eva-client-sdk" },
      status: "dev",
    }],
  };
  const pyprojectText = `[project]
name = "fixture"
version = "0.1.0"
dependencies = ["autoark-eva-client-sdk[pyaudio,camera]==1.0.0"]

[tool.uv.sources]
autoark-eva-client-sdk = { index = "eva-pypi" }

[[tool.uv.index]]
name = "eva-pypi"
url = "https://pypi.org/simple"
explicit = true
`;
  const lockText = `version = 1

[[package]]
name = "autoark-eva-client-sdk"
version = "1.0.0"
source = { registry = "https://pypi.org/simple" }

[[package]]
name = "fixture"
version = "0.1.0"
source = { virtual = "." }
`;
  writeFileSync(join(root, "examples.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(join(exampleRoot, "README.md"), "# Python Demo\n");
  writeFileSync(join(exampleRoot, "pyproject.toml"), pyprojectText);
  writeFileSync(join(exampleRoot, "uv.lock"), lockText);
  writeFileSync(
    join(exampleRoot, "main.py"),
    "from eva_client_sdk import Eva\nfrom eva_client_sdk.contracts import StaticGreeting\nfrom eva_client_sdk.media import NativeAecProcessor\n",
  );
  return { exampleRoot, lockText, pyprojectText, root };
}

function createPubFixture() {
  const root = mkdtempSync(join(tmpdir(), "eva-release-pub-test-"));
  temporaryRoots.push(root);
  const exampleRoot = join(root, "client-sdk", "flutter", "demo");
  mkdirSync(join(exampleRoot, "lib"), { recursive: true });
  const catalog = {
    schemaVersion: 1,
    examples: [{
      id: "client-sdk-flutter-demo",
      sdkFamily: "client-sdk",
      language: "flutter",
      platform: "mobile",
      path: "client-sdk/flutter/demo",
      sdk: { ecosystem: "pub", package: "autoark_eva_client_sdk" },
      status: "release",
    }],
  };
  const pubspecText = `name: fixture
publish_to: "none"
version: 0.0.1+1

environment:
  sdk: ^3.12.2

dependencies:
  flutter:
    sdk: flutter
  autoark_eva_client_sdk: 0.1.0
`;
  const lockText = `packages:
  autoark_eva_client_sdk:
    dependency: "direct main"
    description:
      name: autoark_eva_client_sdk
      sha256: "6c1533a29c7085776a812cf214e368159cdf4aceaac52cee2234107d7bec2d98"
      url: "https://pub.dev"
    source: hosted
    version: "0.1.0"
`;
  writeFileSync(join(root, "examples.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(join(exampleRoot, "README.md"), "# Flutter Demo\n");
  writeFileSync(join(exampleRoot, "pubspec.yaml"), pubspecText);
  writeFileSync(join(exampleRoot, "pubspec.lock"), lockText);
  writeFileSync(
    join(exampleRoot, "lib", "main.dart"),
    "import 'package:autoark_eva_client_sdk/autoark_eva_client_sdk.dart';\n",
  );
  return { exampleRoot, lockText, pubspecText, root };
}

function createCmakeFixture() {
  const root = mkdtempSync(join(tmpdir(), "eva-release-cmake-test-"));
  temporaryRoots.push(root);
  const exampleRoot = join(root, "client-sdk", "cpp", "demo");
  mkdirSync(join(exampleRoot, "scripts"), { recursive: true });
  const catalog = {
    schemaVersion: 1,
    examples: [{
      id: "client-sdk-cpp-demo",
      sdkFamily: "client-sdk",
      language: "cpp",
      platform: "terminal",
      path: "client-sdk/cpp/demo",
      sdk: { ecosystem: "cmake", package: "EvaClient" },
      status: "release",
    }],
  };
  writeFileSync(join(root, "examples.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(join(exampleRoot, "README.md"), "# C++ Demo\n");
  writeFileSync(
    join(exampleRoot, "CMakeLists.txt"),
    'set(EVA_SDK_VERSION "0.1.0")\nset(EVA_REQUIRED_SDK_VERSION "${EVA_SDK_VERSION}")\nfind_package(EvaClient ${EVA_REQUIRED_SDK_VERSION} EXACT CONFIG REQUIRED)\n',
  );
  writeFileSync(
    join(exampleRoot, "scripts", "prepare-sdk.mjs"),
    'const url = "https://github.com/AutoArk/eva-cpp-sdk-release/releases/download/0.1.0/sdk.tar.gz";\nconst checksum = `${url}.sha256`;\n',
  );
  writeFileSync(join(exampleRoot, "scripts", "run-with-key-file.mjs"), "// fixture\n");
  return { exampleRoot, root };
}

function createReferenceSource() {
  return {
    id: "eva-sdk-examples",
    purpose: "examples-catalog",
    kind: "git",
    repository: "https://github.com/AutoArk/eva-sdk-examples.git",
    resolution: { mode: "latest-tag" },
    paths: { catalog: "examples.json" },
  };
}
