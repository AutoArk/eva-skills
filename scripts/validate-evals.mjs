#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultEvalPath = resolve(repositoryRoot, "evals/eva-sdk.json");

const routes = new Set(["customize", "integrate", "not-applicable", "run-demo"]);
const outcomes = new Set(["blocked", "complete", "complete-l2", "needs-confirmation", "not-applicable", "unavailable"]);
const catalogs = new Set([
  "missing-requested-route",
  "multiple-demos",
  "not-used",
  "single-cmake-demo",
  "single-npm-demo",
  "single-pub-demo",
]);
const sdkCatalogs = new Set([
  "missing-requested-sdk",
  "multiple-sdks",
  "not-used",
  "single-cpp-sdk",
  "single-sdk",
]);
const integrationSources = new Set(["direct-sdk", "example", "existing-project", "not-applicable"]);
const selectionModes = new Set([
  "ambiguous",
  "confirmed",
  "identity-changed",
  "not-applicable",
  "request-authorized",
  "unavailable",
  "unique-unconfirmed",
]);
const demoWorkspaceModes = new Set([
  "not-applicable",
  "task-temp",
  "unresolved",
  "user-directory",
  "user-directory-nonempty",
]);
const cliStates = new Set(["authenticated", "missing", "not-used", "unauthenticated"]);
const keyInventoryModes = new Set(["empty", "existing", "not-used"]);
const keySaveModes = new Set(["error", "not-used", "success"]);
const canaryModes = new Set(["hidden-file", "none"]);
const targetProjects = new Set([
  "empty-app",
  "existing-different-version",
  "none",
  "working-app",
]);

const requiredBehaviors = new Set([
  "avoid-eva-sdk-routing",
  "bypass-demo-when-direct",
  "build-and-typecheck",
  "check-eva-whoami",
  "count-credential-launcher-build-as-build-check",
  "create-eva-key-with-no-show",
  "enter-project-directory",
  "explain-browser-login-human-step",
  "fail-closed-unavailable",
  "keep-target-available",
  "list-eva-keys",
  "lock-resolved-exact-version",
  "map-example-to-target",
  "map-sdk-to-target",
  "no-l3-claim",
  "pass-credential-path-to-documented-launcher",
  "preflight-cli-availability-before-dependencies",
  "present-candidate-details",
  "present-demo-workspace-options",
  "present-official-cli-install",
  "present-sdk-candidates",
  "preserve-unrelated-files",
  "preserve-installed-sdk-version",
  "read-example-source-policy",
  "read-sdk-catalog",
  "report-cli-missing",
  "report-key-save-error",
  "report-nonempty-demo-destination",
  "report-snapshot-identity-change",
  "report-version-conflict",
  "report-selected-sdk",
  "request-cli-install-confirmation",
  "request-demo-workspace-choice",
  "request-version-choice",
  "request-candidate-confirmation",
  "request-sdk-selection",
  "return-operation-and-teardown",
  "resolve-latest-from-official-distribution",
  "resolve-configured-example-branch",
  "reuse-explicit-demo-authorization",
  "retry-eva-whoami-with-user-session-access",
  "require-whoami-recheck-after-login",
  "save-eva-key-to-dotenv",
  "select-github-release-platform-asset",
  "select-from-catalog",
  "start-eva-login",
  "treat-dotenv-path-as-opaque",
  "use-native-lockfile",
  "use-cmake-package-config",
  "use-public-api-only",
  "use-task-temp-demo-workspace",
  "use-user-selected-demo-workspace",
  "verify-empty-demo-destination",
  "verify-github-release-checksum",
  "pin-resolved-example-commit",
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
  "create-eva-key-when-existing",
  "create-eva-key-without-no-show-key",
  "copy-demo-wholesale",
  "echo-ak-value",
  "follow-branch-after-pin",
  "infer-uncataloged-route",
  "infer-unpublished-sdk",
  "install-before-sdk-selection",
  "install-cli-before-confirmation",
  "invoke-cli-before-confirmation",
  "invoke-eva-sdk-workflow",
  "modify-unrelated-file",
  "overwrite-nonempty-demo-workspace",
  "prebuild-before-build-capable-launcher",
  "read-dotenv-file",
  "repeat-candidate-confirmation",
  "request-user-paste-ak",
  "run-eva-key-show",
  "require-demo-baseline",
  "restore-dependencies-before-confirmation",
  "restore-dependencies-before-cli-preflight",
  "reuse-demo-authorization-with-nonempty-directory",
  "reuse-stale-demo-authorization",
  "silently-change-sdk-version",
  "stop-target-prematurely",
  "start-before-confirmation",
  "start-without-credential-path-after-key-success",
  "skip-cli-because-runtime-input-exists",
  "treat-credentialless-build-as-demo-start",
  "use-example-prerelease-tag",
  "use-example-version-for-direct-integration",
  "use-github-source-archive",
  "use-ordinary-launcher-without-explicit-request",
  "use-sdk-internal",
  "leave-floating-latest",
  "skip-release-checksum",
  "upgrade-existing-sdk-without-request",
  "use-obsolete-eva-init",
  "use-obsolete-eva-key-path",
]);

const coreCredentialForbidden = [
  "read-dotenv-file",
  "echo-ak-value",
  "copy-ak-file",
  "request-user-paste-ak",
  "run-eva-key-show",
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
  const keyInventoryCoverage = new Set();
  const keySaveCoverage = new Set();
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
  let hasConfirmedPubCredentialLaunch = false;
  let hasExplicitRequestAuthorizationReuse = false;
  let hasUnbrandedVoiceExclusion = false;

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
        "keyInventory",
        "keySave",
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
    assert(
      keyInventoryModes.has(fixture.keyInventory),
      `${evalCase.id}: unsupported keyInventory fixture ${fixture.keyInventory}`,
    );
    assert(keySaveModes.has(fixture.keySave), `${evalCase.id}: unsupported keySave fixture ${fixture.keySave}`);
    assert(canaryModes.has(fixture.akCanary), `${evalCase.id}: unsupported akCanary fixture ${fixture.akCanary}`);
    assert(targetProjects.has(fixture.targetProject), `${evalCase.id}: unsupported targetProject ${fixture.targetProject}`);

    const expected = evalCase.expected;
    assertRecord(expected, `${evalCase.id}.expected`);
    assertExactKeys(expected, ["route", "outcome", "required", "forbidden"], `${evalCase.id}.expected`);
    assert(routes.has(expected.route), `${evalCase.id}: unsupported route ${expected.route}`);
    assert(outcomes.has(expected.outcome), `${evalCase.id}: unsupported outcome ${expected.outcome}`);
    validateBehaviorList(expected.required, requiredBehaviors, `${evalCase.id}.required`);
    validateBehaviorList(expected.forbidden, forbiddenBehaviors, `${evalCase.id}.forbidden`);
    for (const behavior of coreCredentialForbidden) {
      assert(expected.forbidden.includes(behavior), `${evalCase.id}: missing core AK prohibition ${behavior}`);
    }

    routeCoverage.add(expected.route);
    cliCoverage.add(fixture.cliState);
    keyInventoryCoverage.add(fixture.keyInventory);
    keySaveCoverage.add(fixture.keySave);
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
    if (fixture.keySave === "success" && fixture.akCanary === "hidden-file") hasSuccessCanary = true;
    if (fixture.keySave === "error" && fixture.akCanary === "hidden-file") hasErrorCanary = true;
    if (
      fixture.catalog === "single-pub-demo"
      && fixture.selection === "confirmed"
      && fixture.cliState === "authenticated"
      && fixture.keySave === "success"
      && expected.route === "run-demo"
      && expected.outcome === "complete-l2"
    ) {
      hasConfirmedPubCredentialLaunch = true;
    }
    if (
      fixture.selection === "request-authorized"
      && fixture.demoWorkspace === "user-directory"
      && expected.route === "run-demo"
      && expected.outcome === "complete-l2"
    ) {
      hasExplicitRequestAuthorizationReuse = true;
    }
    if (
      expected.route === "not-applicable"
      && expected.outcome === "not-applicable"
      && /语音.*[Dd]emo|语音.*Demo/.test(evalCase.prompt)
    ) {
      hasUnbrandedVoiceExclusion = true;
    }

    validateCaseSemantics(evalCase);
  }

  assertSetCovered(routes, routeCoverage, "route");
  assertSetCovered(new Set(["authenticated", "missing", "unauthenticated"]), cliCoverage, "CLI state");
  assertSetCovered(new Set(["empty", "existing"]), keyInventoryCoverage, "key inventory branch");
  assertSetCovered(new Set(["error", "success"]), keySaveCoverage, "key save branch");
  assertSetCovered(
    new Set(["ambiguous", "confirmed", "identity-changed", "request-authorized", "unique-unconfirmed"]),
    selectionCoverage,
    "selection branch",
  );
  assertSetCovered(
    new Set(["task-temp", "unresolved", "user-directory", "user-directory-nonempty"]),
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
  assert(
    hasConfirmedPubCredentialLaunch,
    "evals must cover a confirmed Pub Demo launched through the authenticated credential path",
  );
  assert(
    hasExplicitRequestAuthorizationReuse,
    "evals must cover reusing an explicit Demo id and absolute empty-directory authorization",
  );
  assert(hasUnbrandedVoiceExclusion, "evals must exclude an unbranded voice Demo request without EVA context");

  return { cases: spec.cases.length, skill: spec.skill };
}

function validateCaseSemantics(evalCase) {
  const { fixture, expected, id } = evalCase;
  const awaitsCandidateConfirmation = ["ambiguous", "identity-changed", "unique-unconfirmed"].includes(
    fixture.selection,
  );
  const usesExamples = expected.route === "run-demo" || fixture.integrationSource === "example";
  if (usesExamples) {
    for (const behavior of [
      "read-example-source-policy",
      "resolve-configured-example-branch",
      "pin-resolved-example-commit",
    ]) {
      assert(expected.required.includes(behavior), `${id}: examples workflow requires ${behavior}`);
    }
    assert(
      expected.forbidden.includes("follow-branch-after-pin"),
      `${id}: examples workflow must freeze the resolved branch commit`,
    );
    assert(
      expected.forbidden.includes("use-example-prerelease-tag"),
      `${id}: examples workflow must forbid prerelease tags`,
    );
  }
  if (awaitsCandidateConfirmation) {
    assert(expected.route === "run-demo", `${id}: selection confirmation only applies to run-demo`);
    assert(expected.outcome === "needs-confirmation", `${id}: unconfirmed selection must pause`);
    assert(fixture.cliState === "not-used", `${id}: CLI must not run before confirmation`);
    assert(fixture.keyInventory === "not-used", `${id}: keys must not be listed before confirmation`);
    assert(fixture.keySave === "not-used", `${id}: key must not be saved before confirmation`);
    for (const behavior of [
      "present-candidate-details",
      "request-candidate-confirmation",
      "wait-for-confirmation",
    ]) {
      assert(expected.required.includes(behavior), `${id}: selection gate requires ${behavior}`);
    }
    for (const behavior of [
      "invoke-cli-before-confirmation",
      "restore-dependencies-before-confirmation",
      "start-before-confirmation",
    ]) {
      assert(expected.forbidden.includes(behavior), `${id}: selection gate must forbid ${behavior}`);
    }
    if (["ambiguous", "unique-unconfirmed"].includes(fixture.selection)) {
      assert(fixture.demoWorkspace === "unresolved", `${id}: unconfirmed Demo must not choose a final workspace`);
    }
    if (fixture.selection === "identity-changed") {
      assert(
        expected.required.includes("report-snapshot-identity-change"),
        `${id}: changed identity must be reported before reconfirmation`,
      );
      assert(
        expected.forbidden.includes("reuse-stale-demo-authorization"),
        `${id}: changed identity must invalidate prior Demo authorization`,
      );
      for (const behavior of [
        "request-demo-workspace-choice",
        "wait-for-demo-workspace-choice",
      ]) {
        assert(
          !expected.required.includes(behavior),
          `${id}: unchanged workspace must not trigger ${behavior} after an identity change`,
        );
      }
    }
  }
  if (expected.route === "run-demo" && fixture.demoWorkspace === "unresolved") {
    assert(expected.outcome === "needs-confirmation", `${id}: missing Demo workspace must pause`);
    for (const behavior of [
      "present-demo-workspace-options",
      "request-demo-workspace-choice",
      "wait-for-demo-workspace-choice",
    ]) {
      assert(expected.required.includes(behavior), `${id}: unresolved Demo workspace requires ${behavior}`);
    }
    assert(
      expected.forbidden.includes("clone-final-before-workspace-choice"),
      `${id}: unresolved Demo workspace must not receive the final clone`,
    );
  }
  if (fixture.demoWorkspace === "user-directory-nonempty") {
    assert(expected.route === "run-demo", `${id}: non-empty Demo workspace only applies to run-demo`);
    assert(expected.outcome === "needs-confirmation", `${id}: non-empty Demo workspace must pause`);
    assert(fixture.cliState === "not-used", `${id}: CLI must not run for a non-empty Demo workspace`);
    for (const behavior of [
      "report-nonempty-demo-destination",
      "request-demo-workspace-choice",
      "wait-for-demo-workspace-choice",
    ]) {
      assert(expected.required.includes(behavior), `${id}: non-empty Demo workspace requires ${behavior}`);
    }
    for (const behavior of [
      "overwrite-nonempty-demo-workspace",
      "reuse-demo-authorization-with-nonempty-directory",
    ]) {
      assert(expected.forbidden.includes(behavior), `${id}: non-empty Demo workspace must forbid ${behavior}`);
    }
  }
  if (expected.route === "run-demo" && fixture.cliState !== "not-used") {
    assert(
      ["confirmed", "request-authorized"].includes(fixture.selection),
      `${id}: CLI branch requires confirmed or reusable request authorization`,
    );
  }
  if (fixture.cliState === "not-used") {
    assert(fixture.keyInventory === "not-used", `${id}: keys cannot be listed without EVA CLI`);
    assert(fixture.keySave === "not-used", `${id}: key cannot be saved without EVA CLI`);
  }
  if (fixture.keyInventory === "not-used") {
    assert(fixture.keySave === "not-used", `${id}: key save cannot run without listing keys`);
  }
  if (fixture.keyInventory !== "not-used") {
    assert(fixture.keySave !== "not-used", `${id}: listed keys must resolve to a save outcome`);
  }
  if (fixture.keySave !== "not-used") {
    assert(fixture.cliState === "authenticated", `${id}: key save requires authenticated CLI state`);
    assert(fixture.keyInventory !== "not-used", `${id}: key save requires key inventory state`);
  }
  if (expected.route === "run-demo") {
    assert(fixture.sdkCatalog === "not-used", `${id}: run-demo must not route through SDK catalog`);
    assert(fixture.integrationSource === "not-applicable", `${id}: run-demo integration source must be not-applicable`);
    if (["confirmed", "request-authorized"].includes(fixture.selection) && fixture.cliState !== "not-used") {
      assert(
        ["task-temp", "user-directory"].includes(fixture.demoWorkspace),
        `${id}: authorized Demo execution requires a resolved final workspace`,
      );
    }
    if (fixture.selection === "unavailable") {
      assert(fixture.demoWorkspace === "not-applicable", `${id}: unavailable Demo has no workspace`);
    }
  } else {
    assert(fixture.demoWorkspace === "not-applicable", `${id}: non-demo workflow has no Demo workspace`);
  }
  if (expected.route === "not-applicable") {
    assert(expected.outcome === "not-applicable", `${id}: excluded request must be not-applicable`);
    assert(expected.required.includes("avoid-eva-sdk-routing"), `${id}: excluded request must avoid EVA SDK routing`);
    assert(
      expected.forbidden.includes("invoke-eva-sdk-workflow"),
      `${id}: excluded request must not invoke the EVA SDK workflow`,
    );
  }
  if (expected.route !== "run-demo" && fixture.integrationSource !== "example") {
    assert(fixture.selection === "not-applicable", `${id}: non-demo workflow selection must be not-applicable`);
  }
  if (fixture.cliState === "missing") {
    assert(expected.outcome === "needs-confirmation", `${id}: missing CLI must wait for global-install confirmation`);
    assert(expected.required.includes("check-eva-whoami"), `${id}: missing CLI must be detected with eva whoami`);
    assert(expected.required.includes("report-cli-missing"), `${id}: missing CLI report is required`);
    assert(
      expected.required.includes("preflight-cli-availability-before-dependencies"),
      `${id}: missing CLI must be detected before dependency restore`,
    );
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
    assert(
      expected.forbidden.includes("restore-dependencies-before-cli-preflight"),
      `${id}: dependency restore must wait for CLI availability preflight`,
    );
  }
  if (fixture.cliState === "unauthenticated") {
    assert(expected.outcome === "needs-confirmation", `${id}: browser login must wait for the user`);
    for (const behavior of [
      "check-eva-whoami",
      "retry-eva-whoami-with-user-session-access",
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
  if (fixture.keySave !== "not-used") {
    for (const behavior of [
      "check-eva-whoami",
      "enter-project-directory",
      "list-eva-keys",
      "save-eva-key-to-dotenv",
    ]) {
      assert(expected.required.includes(behavior), `${id}: key save workflow requires ${behavior}`);
    }
    for (const behavior of ["use-obsolete-eva-init", "use-obsolete-eva-key-path"]) {
      assert(expected.forbidden.includes(behavior), `${id}: key workflow must forbid ${behavior}`);
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
  if (
    fixture.selection === "request-authorized"
    && fixture.demoWorkspace === "user-directory"
    && fixture.cliState !== "not-used"
  ) {
    assert(
      expected.required.includes("reuse-explicit-demo-authorization"),
      `${id}: exact request authorization must be reused`,
    );
    assert(
      expected.forbidden.includes("repeat-candidate-confirmation"),
      `${id}: exact request authorization must not trigger repeated confirmation`,
    );
    for (const behavior of [
      "request-candidate-confirmation",
      "wait-for-confirmation",
      "request-demo-workspace-choice",
      "wait-for-demo-workspace-choice",
    ]) {
      assert(
        !expected.required.includes(behavior),
        `${id}: reusable Demo authorization must not also require ${behavior}`,
      );
    }
  }
  if (fixture.selection === "request-authorized") {
    for (const behavior of ["request-candidate-confirmation", "wait-for-confirmation"]) {
      assert(
        !expected.required.includes(behavior),
        `${id}: exact Demo id must not trigger ${behavior}`,
      );
    }
  }
  if (fixture.keyInventory === "empty") {
    assert(expected.required.includes("create-eva-key-with-no-show"), `${id}: missing-key branch must create safely`);
    assert(
      expected.forbidden.includes("create-eva-key-without-no-show-key"),
      `${id}: missing-key branch must forbid unsafe key creation`,
    );
  }
  if (fixture.keyInventory === "existing") {
    assert(
      expected.forbidden.includes("create-eva-key-when-existing"),
      `${id}: existing-key branch must not create another key`,
    );
  }
  if (fixture.keySave === "error") {
    assert(expected.outcome === "blocked", `${id}: key save error must block`);
    assert(expected.required.includes("report-key-save-error"), `${id}: key save error report is required`);
  }
  if (fixture.keySave === "success") {
    assert(expected.required.includes("treat-dotenv-path-as-opaque"), `${id}: successful .env path must remain opaque`);
    assert(
      expected.required.includes("pass-credential-path-to-documented-launcher"),
      `${id}: successful .env save must be passed to the documented launcher`,
    );
    assert(
      expected.forbidden.includes("start-without-credential-path-after-key-success"),
      `${id}: successful .env save must forbid startup without that path`,
    );
  }
  if (
    fixture.catalog === "single-pub-demo"
    && ["confirmed", "request-authorized"].includes(fixture.selection)
    && fixture.keySave === "success"
  ) {
    for (const behavior of [
      "skip-cli-because-runtime-input-exists",
      "treat-credentialless-build-as-demo-start",
      "use-ordinary-launcher-without-explicit-request",
    ]) {
      assert(
        expected.forbidden.includes(behavior),
        `${id}: confirmed Pub Demo must forbid ${behavior}`,
      );
    }
    assert(
      expected.required.includes("count-credential-launcher-build-as-build-check"),
      `${id}: confirmed Pub Demo must count its credential launcher build`,
    );
    assert(
      expected.forbidden.includes("prebuild-before-build-capable-launcher"),
      `${id}: confirmed Pub Demo must forbid a redundant prebuild`,
    );
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
      !expected.forbidden.includes("use-example-prerelease-tag"),
      `${id}: direct SDK integration must not inherit the Demo-only prerelease prohibition`,
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
    if (fixture.sdkCatalog === "single-cpp-sdk") {
      for (const behavior of [
        "resolve-latest-from-official-distribution",
        "lock-resolved-exact-version",
        "select-github-release-platform-asset",
        "verify-github-release-checksum",
        "use-cmake-package-config",
      ]) {
        assert(expected.required.includes(behavior), `${id}: direct C++ integration requires ${behavior}`);
      }
      for (const behavior of ["use-github-source-archive", "skip-release-checksum"]) {
        assert(expected.forbidden.includes(behavior), `${id}: direct C++ integration must forbid ${behavior}`);
      }
    }
  }
  if (fixture.catalog === "single-cmake-demo") {
    for (const behavior of [
      "select-github-release-platform-asset",
      "verify-github-release-checksum",
      "use-cmake-package-config",
    ]) {
      assert(expected.required.includes(behavior), `${id}: CMake Demo requires ${behavior}`);
    }
    for (const behavior of ["use-github-source-archive", "skip-release-checksum"]) {
      assert(expected.forbidden.includes(behavior), `${id}: CMake Demo must forbid ${behavior}`);
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
      !expected.forbidden.includes("use-example-prerelease-tag"),
      `${id}: existing project must not inherit the Demo-only prerelease prohibition`,
    );
  }
  if (fixture.integrationSource === "example") {
    assert(fixture.catalog !== "not-used", `${id}: example integration requires examples catalog`);
    assert(fixture.selection === "confirmed", `${id}: example integration requires confirmed example`);
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
