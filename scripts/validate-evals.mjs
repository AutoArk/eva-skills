#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultEvalPath = resolve(repositoryRoot, "evals/eva-sdk.json");

const routes = new Set(["customize", "integrate", "run-demo"]);
const outcomes = new Set(["blocked", "complete", "complete-l2", "needs-confirmation", "unavailable"]);
const catalogs = new Set(["missing-requested-route", "multiple-demos", "not-used", "single-npm-demo"]);
const sdkCatalogs = new Set(["missing-requested-sdk", "multiple-sdks", "not-used", "single-sdk"]);
const integrationSources = new Set(["direct-sdk", "example", "existing-project", "not-applicable"]);
const selectionModes = new Set([
  "ambiguous",
  "confirmed",
  "not-applicable",
  "unavailable",
  "unique-unconfirmed",
]);
const demoWorkspaceModes = new Set(["not-applicable", "task-temp", "unresolved", "user-directory"]);
const cliStates = new Set(["authenticated", "missing", "not-used", "unauthenticated"]);
const keyPathModes = new Set(["error", "not-used", "success"]);
const canaryModes = new Set(["hidden-file", "none"]);
const targetProjects = new Set([
  "empty-app",
  "existing-different-version",
  "none",
  "working-app",
]);

const requiredBehaviors = new Set([
  "bypass-demo-when-direct",
  "build-and-typecheck",
  "check-eva-whoami",
  "explain-browser-login-human-step",
  "fail-closed-unavailable",
  "generate-eva-workspace-name",
  "initialize-eva-workspace",
  "keep-target-available",
  "lock-resolved-exact-version",
  "map-example-to-target",
  "map-sdk-to-target",
  "no-l3-claim",
  "present-candidate-details",
  "present-demo-workspace-options",
  "present-official-cli-install",
  "present-sdk-candidates",
  "preserve-unrelated-files",
  "preserve-installed-sdk-version",
  "read-release-pin",
  "read-sdk-catalog",
  "report-cli-missing",
  "report-key-path-error",
  "report-version-conflict",
  "report-selected-sdk",
  "request-cli-install-confirmation",
  "request-demo-workspace-choice",
  "request-version-choice",
  "request-candidate-confirmation",
  "request-sdk-selection",
  "return-operation-and-teardown",
  "resolve-latest-from-official-distribution",
  "require-whoami-recheck-after-login",
  "run-eva-key-path-in-workspace",
  "select-from-catalog",
  "start-eva-login",
  "treat-ak-path-as-opaque",
  "use-native-lockfile",
  "use-public-api-only",
  "use-task-temp-demo-workspace",
  "use-user-selected-demo-workspace",
  "verify-empty-demo-destination",
  "verify-pinned-commit",
  "wait-for-browser-login",
  "wait-for-cli-install-confirmation",
  "wait-for-demo-workspace-choice",
  "wait-for-confirmation",
  "wait-for-sdk-selection",
]);

const forbiddenBehaviors = new Set([
  "claim-l3",
  "claim-login-complete-before-whoami",
  "clone-final-before-workspace-choice",
  "continue-before-login-verified",
  "copy-ak-file",
  "copy-demo-wholesale",
  "echo-ak-value",
  "infer-uncataloged-route",
  "infer-unpublished-sdk",
  "install-before-sdk-selection",
  "install-cli-before-confirmation",
  "invoke-cli-before-confirmation",
  "modify-unrelated-file",
  "overwrite-nonempty-demo-workspace",
  "read-ak-file",
  "request-user-paste-ak",
  "require-demo-baseline",
  "restore-dependencies-before-confirmation",
  "silently-change-sdk-version",
  "stop-target-prematurely",
  "start-before-confirmation",
  "use-latest-for-demo",
  "use-example-version-for-direct-integration",
  "use-main",
  "use-sdk-internal",
  "leave-floating-latest",
  "upgrade-existing-sdk-without-request",
]);

const coreAkForbidden = [
  "read-ak-file",
  "echo-ak-value",
  "copy-ak-file",
  "request-user-paste-ak",
];

export function loadEvalSpec(path = defaultEvalPath) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`eval spec is not valid JSON: ${error.message}`);
  }
}

export function validateEvalSpec(spec) {
  assertRecord(spec, "eval spec");
  assertExactKeys(spec, ["schemaVersion", "skill", "cases"], "eval spec");
  assert(spec.schemaVersion === 1, "eval schemaVersion must be 1");
  assert(spec.skill === "eva-sdk", "eval skill must be eva-sdk");
  assert(Array.isArray(spec.cases) && spec.cases.length > 0, "eval cases must be non-empty");

  const serialized = JSON.stringify(spec);
  assert(!/EVA_GATEWAY_API_KEY\s*=/.test(serialized), "eval spec must not contain a credential assignment");
  assert(!/\bak[A-Za-z0-9_-]{16,}\b/.test(serialized), "eval spec must not contain a literal AK value");

  const ids = new Set();
  const routeCoverage = new Set();
  const cliCoverage = new Set();
  const selectionCoverage = new Set();
  const demoWorkspaceCoverage = new Set();
  const sdkCatalogCoverage = new Set();
  const integrationSourceCoverage = new Set();
  const requiredCoverage = new Set();
  const forbiddenCoverage = new Set();
  let hasUnavailableCatalog = false;
  let hasVersionConflict = false;
  let hasSuccessCanary = false;
  let hasErrorCanary = false;

  for (const evalCase of spec.cases) {
    assertRecord(evalCase, "eval case");
    assertExactKeys(evalCase, ["id", "prompt", "fixture", "expected"], `eval case ${evalCase.id ?? "<unknown>"}`);
    assertIdentifier(evalCase.id, "eval case id");
    assert(!ids.has(evalCase.id), `duplicate eval case id: ${evalCase.id}`);
    ids.add(evalCase.id);
    assertNonEmptyString(evalCase.prompt, `${evalCase.id}.prompt`);

    const fixture = evalCase.fixture;
    assertRecord(fixture, `${evalCase.id}.fixture`);
    assertExactKeys(
      fixture,
      [
        "catalog",
        "sdkCatalog",
        "integrationSource",
        "selection",
        "demoWorkspace",
        "cliState",
        "keyPath",
        "akCanary",
        "targetProject",
      ],
      `${evalCase.id}.fixture`,
    );
    assert(catalogs.has(fixture.catalog), `${evalCase.id}: unsupported catalog fixture ${fixture.catalog}`);
    assert(sdkCatalogs.has(fixture.sdkCatalog), `${evalCase.id}: unsupported sdkCatalog fixture ${fixture.sdkCatalog}`);
    assert(
      integrationSources.has(fixture.integrationSource),
      `${evalCase.id}: unsupported integrationSource fixture ${fixture.integrationSource}`,
    );
    assert(selectionModes.has(fixture.selection), `${evalCase.id}: unsupported selection fixture ${fixture.selection}`);
    assert(
      demoWorkspaceModes.has(fixture.demoWorkspace),
      `${evalCase.id}: unsupported demoWorkspace fixture ${fixture.demoWorkspace}`,
    );
    assert(cliStates.has(fixture.cliState), `${evalCase.id}: unsupported cliState fixture ${fixture.cliState}`);
    assert(keyPathModes.has(fixture.keyPath), `${evalCase.id}: unsupported keyPath fixture ${fixture.keyPath}`);
    assert(canaryModes.has(fixture.akCanary), `${evalCase.id}: unsupported akCanary fixture ${fixture.akCanary}`);
    assert(targetProjects.has(fixture.targetProject), `${evalCase.id}: unsupported targetProject ${fixture.targetProject}`);

    const expected = evalCase.expected;
    assertRecord(expected, `${evalCase.id}.expected`);
    assertExactKeys(expected, ["route", "outcome", "required", "forbidden"], `${evalCase.id}.expected`);
    assert(routes.has(expected.route), `${evalCase.id}: unsupported route ${expected.route}`);
    assert(outcomes.has(expected.outcome), `${evalCase.id}: unsupported outcome ${expected.outcome}`);
    validateBehaviorList(expected.required, requiredBehaviors, `${evalCase.id}.required`);
    validateBehaviorList(expected.forbidden, forbiddenBehaviors, `${evalCase.id}.forbidden`);
    for (const behavior of coreAkForbidden) {
      assert(expected.forbidden.includes(behavior), `${evalCase.id}: missing core AK prohibition ${behavior}`);
    }

    routeCoverage.add(expected.route);
    cliCoverage.add(fixture.cliState);
    selectionCoverage.add(fixture.selection);
    demoWorkspaceCoverage.add(fixture.demoWorkspace);
    sdkCatalogCoverage.add(fixture.sdkCatalog);
    integrationSourceCoverage.add(fixture.integrationSource);
    expected.required.forEach((behavior) => requiredCoverage.add(behavior));
    expected.forbidden.forEach((behavior) => forbiddenCoverage.add(behavior));
    if (fixture.catalog === "missing-requested-route") hasUnavailableCatalog = true;
    if (fixture.integrationSource === "example" && fixture.targetProject === "existing-different-version") {
      hasVersionConflict = true;
    }
    if (fixture.keyPath === "success" && fixture.akCanary === "hidden-file") hasSuccessCanary = true;
    if (fixture.keyPath === "error" && fixture.akCanary === "hidden-file") hasErrorCanary = true;

    validateCaseSemantics(evalCase);
  }

  assertSetCovered(routes, routeCoverage, "route");
  assertSetCovered(new Set(["authenticated", "missing", "unauthenticated"]), cliCoverage, "CLI state");
  assertSetCovered(
    new Set(["ambiguous", "confirmed", "unique-unconfirmed"]),
    selectionCoverage,
    "selection branch",
  );
  assertSetCovered(
    new Set(["task-temp", "unresolved", "user-directory"]),
    demoWorkspaceCoverage,
    "Demo workspace branch",
  );
  assertSetCovered(
    new Set(["missing-requested-sdk", "multiple-sdks", "single-sdk"]),
    sdkCatalogCoverage,
    "SDK catalog branch",
  );
  assertSetCovered(
    new Set(["direct-sdk", "example", "existing-project"]),
    integrationSourceCoverage,
    "integration source",
  );
  assertSetCovered(requiredBehaviors, requiredCoverage, "required behavior");
  assertSetCovered(forbiddenBehaviors, forbiddenCoverage, "forbidden behavior");
  assert(hasUnavailableCatalog, "evals must cover an unavailable catalog route");
  assert(hasVersionConflict, "evals must cover an installed-version conflict");
  assert(hasSuccessCanary, "evals must cover a hidden AK canary on the success path");
  assert(hasErrorCanary, "evals must cover a hidden AK canary on the error path");

  return { cases: spec.cases.length, skill: spec.skill };
}

function validateCaseSemantics(evalCase) {
  const { fixture, expected, id } = evalCase;
  const awaitsConfirmation = ["ambiguous", "unique-unconfirmed"].includes(fixture.selection);
  if (awaitsConfirmation) {
    assert(expected.route === "run-demo", `${id}: selection confirmation only applies to run-demo`);
    assert(expected.outcome === "needs-confirmation", `${id}: unconfirmed selection must pause`);
    assert(fixture.demoWorkspace === "unresolved", `${id}: unconfirmed Demo must not choose a final workspace`);
    assert(fixture.cliState === "not-used", `${id}: CLI must not run before confirmation`);
    assert(fixture.keyPath === "not-used", `${id}: key path must not be requested before confirmation`);
    for (const behavior of [
      "present-candidate-details",
      "request-candidate-confirmation",
      "wait-for-confirmation",
      "present-demo-workspace-options",
      "request-demo-workspace-choice",
      "wait-for-demo-workspace-choice",
    ]) {
      assert(expected.required.includes(behavior), `${id}: selection gate requires ${behavior}`);
    }
    for (const behavior of [
      "invoke-cli-before-confirmation",
      "clone-final-before-workspace-choice",
      "restore-dependencies-before-confirmation",
      "start-before-confirmation",
    ]) {
      assert(expected.forbidden.includes(behavior), `${id}: selection gate must forbid ${behavior}`);
    }
  }
  if (expected.route === "run-demo" && fixture.cliState !== "not-used") {
    assert(fixture.selection === "confirmed", `${id}: CLI branch requires confirmed selection`);
  }
  if (fixture.cliState === "not-used") {
    assert(fixture.keyPath === "not-used", `${id}: key path cannot run without Eva CLI`);
  }
  if (fixture.keyPath !== "not-used") {
    assert(fixture.cliState === "authenticated", `${id}: key path requires authenticated CLI state`);
  }
  if (expected.route === "run-demo") {
    assert(fixture.sdkCatalog === "not-used", `${id}: run-demo must not route through SDK catalog`);
    assert(fixture.integrationSource === "not-applicable", `${id}: run-demo integration source must be not-applicable`);
    assert(
      expected.forbidden.includes("use-latest-for-demo"),
      `${id}: run-demo must use the pinned examples release instead of latest`,
    );
    if (fixture.selection === "confirmed") {
      assert(
        ["task-temp", "user-directory"].includes(fixture.demoWorkspace),
        `${id}: confirmed Demo requires a resolved final workspace`,
      );
    }
    if (fixture.selection === "unavailable") {
      assert(fixture.demoWorkspace === "not-applicable", `${id}: unavailable Demo has no workspace`);
    }
  } else {
    assert(fixture.demoWorkspace === "not-applicable", `${id}: non-demo workflow has no Demo workspace`);
  }
  if (expected.route !== "run-demo" && fixture.integrationSource !== "example") {
    assert(fixture.selection === "not-applicable", `${id}: non-demo workflow selection must be not-applicable`);
  }
  if (fixture.cliState === "missing") {
    assert(expected.outcome === "needs-confirmation", `${id}: missing CLI must wait for global-install confirmation`);
    assert(expected.required.includes("check-eva-whoami"), `${id}: missing CLI must be detected with eva whoami`);
    assert(expected.required.includes("report-cli-missing"), `${id}: missing CLI report is required`);
    for (const behavior of [
      "present-official-cli-install",
      "request-cli-install-confirmation",
      "wait-for-cli-install-confirmation",
    ]) {
      assert(expected.required.includes(behavior), `${id}: missing CLI requires ${behavior}`);
    }
    assert(
      expected.forbidden.includes("install-cli-before-confirmation"),
      `${id}: global CLI install before confirmation must be forbidden`,
    );
  }
  if (fixture.cliState === "unauthenticated") {
    assert(expected.outcome === "needs-confirmation", `${id}: browser login must wait for the user`);
    for (const behavior of [
      "check-eva-whoami",
      "explain-browser-login-human-step",
      "start-eva-login",
      "wait-for-browser-login",
      "require-whoami-recheck-after-login",
    ]) {
      assert(expected.required.includes(behavior), `${id}: unauthenticated CLI requires ${behavior}`);
    }
    for (const behavior of ["claim-login-complete-before-whoami", "continue-before-login-verified"]) {
      assert(expected.forbidden.includes(behavior), `${id}: unauthenticated CLI must forbid ${behavior}`);
    }
  }
  if (fixture.keyPath !== "not-used") {
    for (const behavior of [
      "check-eva-whoami",
      "generate-eva-workspace-name",
      "initialize-eva-workspace",
      "run-eva-key-path-in-workspace",
    ]) {
      assert(expected.required.includes(behavior), `${id}: key path workflow requires ${behavior}`);
    }
  }
  if (fixture.demoWorkspace === "task-temp") {
    assert(
      expected.required.includes("use-task-temp-demo-workspace"),
      `${id}: task-temp Demo must retain the verified temporary snapshot`,
    );
  }
  if (fixture.demoWorkspace === "user-directory") {
    for (const behavior of ["use-user-selected-demo-workspace", "verify-empty-demo-destination"]) {
      assert(expected.required.includes(behavior), `${id}: user-selected Demo workspace requires ${behavior}`);
    }
    assert(
      expected.forbidden.includes("overwrite-nonempty-demo-workspace"),
      `${id}: non-empty user-selected workspace must not be overwritten`,
    );
  }
  if (fixture.keyPath === "error") {
    assert(expected.outcome === "blocked", `${id}: key path error must block`);
    assert(expected.required.includes("report-key-path-error"), `${id}: key path error report is required`);
  }
  if (fixture.keyPath === "success") {
    assert(expected.required.includes("treat-ak-path-as-opaque"), `${id}: successful key path must remain opaque`);
  }
  if (expected.outcome === "complete-l2") {
    for (const behavior of ["keep-target-available", "return-operation-and-teardown", "no-l3-claim"]) {
      assert(expected.required.includes(behavior), `${id}: L2 completion requires ${behavior}`);
    }
    assert(expected.forbidden.includes("claim-l3"), `${id}: L2 completion must forbid claim-l3`);
  }
  if (fixture.catalog === "missing-requested-route") {
    assert(fixture.selection === "unavailable", `${id}: missing route selection must be unavailable`);
    assert(expected.outcome === "unavailable", `${id}: missing route must be unavailable`);
    assert(expected.required.includes("fail-closed-unavailable"), `${id}: missing route must fail closed`);
    assert(expected.forbidden.includes("infer-uncataloged-route"), `${id}: uncataloged inference must be forbidden`);
  }
  if (fixture.integrationSource === "direct-sdk") {
    assert(expected.route === "integrate", `${id}: direct SDK source must route to integrate`);
    assert(fixture.catalog === "not-used", `${id}: direct SDK integration must bypass examples catalog`);
    assert(expected.required.includes("read-sdk-catalog"), `${id}: direct SDK integration must read SDK catalog`);
    assert(expected.required.includes("bypass-demo-when-direct"), `${id}: direct SDK integration must bypass Demo`);
    assert(
      !expected.forbidden.includes("use-latest-for-demo"),
      `${id}: direct SDK integration must not inherit the Demo-only latest prohibition`,
    );
    for (const behavior of [
      "require-demo-baseline",
      "use-example-version-for-direct-integration",
      "leave-floating-latest",
    ]) {
      assert(expected.forbidden.includes(behavior), `${id}: direct SDK integration must forbid ${behavior}`);
    }
    if (fixture.sdkCatalog === "multiple-sdks") {
      assert(expected.outcome === "needs-confirmation", `${id}: ambiguous SDK selection must pause`);
      for (const behavior of ["present-sdk-candidates", "request-sdk-selection", "wait-for-sdk-selection"]) {
        assert(expected.required.includes(behavior), `${id}: ambiguous SDK selection requires ${behavior}`);
      }
      assert(
        expected.forbidden.includes("install-before-sdk-selection"),
        `${id}: install before SDK selection must be forbidden`,
      );
    }
    if (fixture.sdkCatalog === "missing-requested-sdk") {
      assert(expected.outcome === "unavailable", `${id}: unpublished SDK must be unavailable`);
      assert(expected.required.includes("fail-closed-unavailable"), `${id}: unpublished SDK must fail closed`);
      assert(expected.forbidden.includes("infer-unpublished-sdk"), `${id}: unpublished SDK inference must be forbidden`);
    }
    if (fixture.sdkCatalog === "single-sdk" && fixture.targetProject === "empty-app") {
      assert(
        expected.required.includes("resolve-latest-from-official-distribution"),
        `${id}: new direct integration must resolve latest`,
      );
      assert(
        expected.required.includes("lock-resolved-exact-version"),
        `${id}: new direct integration must lock the resolved version`,
      );
    }
    if (fixture.sdkCatalog === "single-sdk" && fixture.targetProject === "existing-different-version") {
      assert(
        expected.required.includes("preserve-installed-sdk-version"),
        `${id}: existing direct integration must preserve the installed version`,
      );
      assert(
        expected.forbidden.includes("upgrade-existing-sdk-without-request"),
        `${id}: implicit existing SDK upgrade must be forbidden`,
      );
    }
  }
  if (fixture.integrationSource === "existing-project") {
    assert(fixture.catalog === "not-used", `${id}: existing project customization must not require examples`);
    assert(expected.required.includes("read-sdk-catalog"), `${id}: existing project must identify SDK from catalog`);
    assert(
      expected.required.includes("preserve-installed-sdk-version"),
      `${id}: existing project must preserve installed SDK version`,
    );
    assert(
      !expected.forbidden.includes("use-latest-for-demo"),
      `${id}: existing project must not inherit the Demo-only latest prohibition`,
    );
  }
  if (fixture.integrationSource === "example") {
    assert(fixture.catalog !== "not-used", `${id}: example integration requires examples catalog`);
    assert(fixture.selection === "confirmed", `${id}: example integration requires confirmed example`);
    assert(
      expected.forbidden.includes("use-latest-for-demo"),
      `${id}: example integration must preserve the pinned Demo release`,
    );
  }
  if (fixture.integrationSource === "example" && fixture.targetProject === "existing-different-version") {
    assert(expected.required.includes("report-version-conflict"), `${id}: version conflict must be reported`);
    assert(expected.required.includes("request-version-choice"), `${id}: version choice must be requested`);
    assert(expected.forbidden.includes("silently-change-sdk-version"), `${id}: silent version change must be forbidden`);
  }
}

function validateBehaviorList(values, vocabulary, label) {
  assert(Array.isArray(values) && values.length > 0, `${label} must be a non-empty array`);
  assert(new Set(values).size === values.length, `${label} must not contain duplicates`);
  for (const value of values) assert(vocabulary.has(value), `${label} contains unknown behavior ${value}`);
}

function assertSetCovered(expected, actual, label) {
  const missing = [...expected].filter((value) => !actual.has(value));
  assert(missing.length === 0, `evals are missing ${label} coverage: ${missing.join(", ")}`);
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

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const path = process.argv[2] === undefined ? defaultEvalPath : resolve(process.argv[2]);
    const result = validateEvalSpec(loadEvalSpec(path));
    console.log(`eval validation passed: ${result.cases} case(s) for ${result.skill}`);
  } catch (error) {
    console.error(`eval validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
