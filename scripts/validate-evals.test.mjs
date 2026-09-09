import assert from "node:assert/strict";
import { test } from "node:test";

import { loadEvalSpec, validateEvalSpec } from "./validate-evals.mjs";

test("accepts the repository eval catalog and its required coverage", () => {
  const result = validateEvalSpec(loadEvalSpec());
  assert.deepEqual(result, { cases: 21, skill: "eva-sdk" });
});

test("requires the exact Demo request to carry the reusable authorization behavior", () => {
  const spec = cloneSpec();
  const exact = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-explicit-id-and-empty-directory-reuses-authorization",
  );
  exact.expected.required = exact.expected.required.filter(
    (behavior) => behavior !== "reuse-explicit-demo-authorization",
  );
  assert.throws(() => validateEvalSpec(spec), /exact request authorization must be reused/);
});

test("rejects repeated candidate or workspace confirmation on a reusable Demo authorization", () => {
  const spec = cloneSpec();
  const exact = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-explicit-id-and-empty-directory-reuses-authorization",
  );
  exact.expected.required.push("request-candidate-confirmation");
  assert.throws(
    () => validateEvalSpec(spec),
    /reusable Demo authorization must not also require request-candidate-confirmation/,
  );
});

test("requires an exact Demo request without a directory to wait for a workspace choice", () => {
  const spec = cloneSpec();
  const missingDirectory = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-explicit-id-without-directory-still-pauses",
  );
  missingDirectory.expected.required = missingDirectory.expected.required.filter(
    (behavior) => behavior !== "request-demo-workspace-choice",
  );
  assert.throws(() => validateEvalSpec(spec), /unresolved Demo workspace requires request-demo-workspace-choice/);
});

test("requires a changed immutable snapshot to invalidate prior Demo authorization", () => {
  const spec = cloneSpec();
  const changed = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-local-snapshot-identity-change-invalidates-authorization",
  );
  changed.expected.forbidden = changed.expected.forbidden.filter(
    (behavior) => behavior !== "reuse-stale-demo-authorization",
  );
  assert.throws(() => validateEvalSpec(spec), /changed identity must invalidate prior Demo authorization/);
});

test("requires a non-empty custom directory to retain overwrite protection", () => {
  const spec = cloneSpec();
  const nonempty = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-nonempty-directory-does-not-reuse-authorization",
  );
  nonempty.expected.forbidden = nonempty.expected.forbidden.filter(
    (behavior) => behavior !== "reuse-demo-authorization-with-nonempty-directory",
  );
  assert.throws(() => validateEvalSpec(spec), /non-empty Demo workspace must forbid/);
});

test("routes the Flutter Demo through the Pub candidate confirmation gate", () => {
  const spec = loadEvalSpec();
  const flutterDemo = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-flutter-unique-candidate-still-confirms",
  );
  assert.equal(flutterDemo.fixture.catalog, "single-pub-demo");
  assert.equal(flutterDemo.expected.route, "run-demo");
  assert.equal(flutterDemo.fixture.selection, "unique-unconfirmed");
  assert(flutterDemo.expected.required.includes("request-candidate-confirmation"));
});

test("launches a confirmed Flutter Demo through EVA CLI and the AK launcher", () => {
  const spec = loadEvalSpec();
  const flutterDemo = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-flutter-success-prefers-ak-launcher",
  );
  assert.equal(flutterDemo.fixture.catalog, "single-pub-demo");
  assert.equal(flutterDemo.fixture.selection, "confirmed");
  assert.equal(flutterDemo.fixture.cliState, "authenticated");
  assert.equal(flutterDemo.fixture.keySave, "success");
  assert(flutterDemo.expected.required.includes("count-credential-launcher-build-as-build-check"));
  assert(flutterDemo.expected.required.includes("check-eva-whoami"));
  assert(flutterDemo.expected.required.includes("pass-credential-path-to-documented-launcher"));
  assert(flutterDemo.expected.forbidden.includes("skip-cli-because-runtime-input-exists"));
  assert(flutterDemo.expected.forbidden.includes("prebuild-before-build-capable-launcher"));
  assert(flutterDemo.expected.forbidden.includes("treat-credentialless-build-as-demo-start"));
  assert(flutterDemo.expected.forbidden.includes("use-ordinary-launcher-without-explicit-request"));
});

test("requires a confirmed Pub Demo credential-launch regression case", () => {
  const spec = cloneSpec();
  const flutterDemo = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-flutter-success-prefers-ak-launcher",
  );
  flutterDemo.fixture.catalog = "single-npm-demo";
  assert.throws(
    () => validateEvalSpec(spec),
    /confirmed Pub Demo launched through the authenticated credential path/,
  );
});

test("forbids a confirmed Flutter Demo from falling back to the ordinary launcher", () => {
  const spec = cloneSpec();
  const flutterDemo = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-flutter-success-prefers-ak-launcher",
  );
  flutterDemo.expected.forbidden = flutterDemo.expected.forbidden.filter(
    (behavior) => behavior !== "use-ordinary-launcher-without-explicit-request",
  );
  assert.throws(
    () => validateEvalSpec(spec),
    /confirmed Pub Demo must forbid use-ordinary-launcher-without-explicit-request/,
  );
});

test("forbids a confirmed Flutter Demo from prebuilding before its launcher build", () => {
  const spec = cloneSpec();
  const flutterDemo = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-flutter-success-prefers-ak-launcher",
  );
  flutterDemo.expected.forbidden = flutterDemo.expected.forbidden.filter(
    (behavior) => behavior !== "prebuild-before-build-capable-launcher",
  );
  assert.throws(
    () => validateEvalSpec(spec),
    /confirmed Pub Demo must forbid a redundant prebuild/,
  );
});

test("routes direct Flutter integration through the published SDK catalog", () => {
  const spec = loadEvalSpec();
  const flutterIntegration = spec.cases.find(
    (evalCase) => evalCase.id === "integrate-flutter-direct-from-pub",
  );
  assert.equal(flutterIntegration.fixture.integrationSource, "direct-sdk");
  assert.equal(flutterIntegration.expected.route, "integrate");
  assert(flutterIntegration.expected.required.includes("resolve-latest-from-official-distribution"));
  assert(flutterIntegration.expected.forbidden.includes("require-demo-baseline"));
});

test("rejects duplicate case ids", () => {
  const spec = cloneSpec();
  spec.cases[1].id = spec.cases[0].id;
  assert.throws(() => validateEvalSpec(spec), /duplicate eval case id/);
});

test("rejects literal credentials in prompts or fixtures", () => {
  const spec = cloneSpec();
  const assignment = ["EVA_GATEWAY_API_KEY", ["ak", "ThisMustNeverEnterTheEvalSpec"].join("")].join("=");
  spec.cases[0].prompt = `Use ${assignment}`;
  assert.throws(() => validateEvalSpec(spec), /credential assignment|literal AK value/);
});

test("requires the credential prohibition set on every success and failure path", () => {
  const spec = cloneSpec();
  const cliError = spec.cases.find((evalCase) => evalCase.id === "run-demo-key-path-error-does-not-seek-secret");
  cliError.expected.forbidden = cliError.expected.forbidden.filter(
    (behavior) => behavior !== "read-dotenv-file",
  );
  assert.throws(() => validateEvalSpec(spec), /missing core AK prohibition read-dotenv-file/);
});

test("forbids eva key show on every credential path", () => {
  const spec = cloneSpec();
  const success = spec.cases.find((evalCase) => evalCase.id === "run-demo-success-after-confirmation");
  success.expected.forbidden = success.expected.forbidden.filter(
    (behavior) => behavior !== "run-eva-key-show",
  );
  assert.throws(() => validateEvalSpec(spec), /missing core AK prohibition run-eva-key-show/);
});

test("examples workflow resolves the latest stable tag and pins its commit", () => {
  const spec = cloneSpec();
  const success = spec.cases.find((evalCase) => evalCase.id === "run-demo-success-after-confirmation");
  success.expected.required = success.expected.required.filter(
    (behavior) => behavior !== "resolve-latest-stable-example-tag",
  );
  assert.throws(() => validateEvalSpec(spec), /examples workflow requires resolve-latest-stable-example-tag/);
});

test("forbids CLI, dependency restore, and startup before candidate confirmation", () => {
  const spec = cloneSpec();
  const ambiguous = spec.cases.find(
    (evalCase) => evalCase.id === "run-demo-eva-context-voice-request-lists-candidates",
  );
  ambiguous.expected.forbidden = ambiguous.expected.forbidden.filter(
    (behavior) => behavior !== "invoke-cli-before-confirmation",
  );
  assert.throws(() => validateEvalSpec(spec), /selection gate must forbid invoke-cli-before-confirmation/);
});

test("rejects missing semantic coverage even when the schema is valid", () => {
  const spec = cloneSpec();
  const conflict = spec.cases.find(
    (evalCase) => evalCase.id === "integrate-example-version-conflict-asks-owner",
  );
  conflict.expected.required = conflict.expected.required.filter(
    (behavior) => behavior !== "request-version-choice",
  );
  assert.throws(() => validateEvalSpec(spec), /version choice must be requested|missing required behavior coverage/);
});

test("direct SDK integration must not require an example baseline", () => {
  const spec = cloneSpec();
  const direct = spec.cases.find((evalCase) => evalCase.id === "integrate-new-project-minimal-diff");
  direct.expected.required = direct.expected.required.filter(
    (behavior) => behavior !== "bypass-demo-when-direct",
  );
  assert.throws(() => validateEvalSpec(spec), /must bypass Demo|missing required behavior coverage/);
});

test("latest is resolved once and the exact version must be locked", () => {
  const spec = cloneSpec();
  const direct = spec.cases.find((evalCase) => evalCase.id === "integrate-new-project-minimal-diff");
  direct.expected.required = direct.expected.required.filter(
    (behavior) => behavior !== "lock-resolved-exact-version",
  );
  assert.throws(() => validateEvalSpec(spec), /must lock the resolved version|missing required behavior coverage/);
});

test("global CLI installation requires separate user confirmation", () => {
  const spec = cloneSpec();
  const missing = spec.cases.find((evalCase) => evalCase.id === "run-demo-cli-missing-after-confirmation");
  missing.expected.forbidden = missing.expected.forbidden.filter(
    (behavior) => behavior !== "install-cli-before-confirmation",
  );
  assert.throws(() => validateEvalSpec(spec), /global CLI install before confirmation must be forbidden/);
});

test("browser login cannot be treated as complete before whoami recheck", () => {
  const spec = cloneSpec();
  const login = spec.cases.find((evalCase) => evalCase.id === "run-demo-login-browser-requires-human");
  login.expected.required = login.expected.required.filter(
    (behavior) => behavior !== "require-whoami-recheck-after-login",
  );
  assert.throws(() => validateEvalSpec(spec), /unauthenticated CLI requires require-whoami-recheck-after-login/);
});

test("unauthenticated CLI retries once with access to the user CLI session", () => {
  const spec = cloneSpec();
  const login = spec.cases.find((evalCase) => evalCase.id === "run-demo-login-browser-requires-human");
  login.expected.required = login.expected.required.filter(
    (behavior) => behavior !== "retry-eva-whoami-with-user-session-access",
  );
  assert.throws(() => validateEvalSpec(spec), /requires retry-eva-whoami-with-user-session-access/);
});

test("key setup requires entering the project directory", () => {
  const spec = cloneSpec();
  const success = spec.cases.find((evalCase) => evalCase.id === "run-demo-success-after-confirmation");
  success.expected.required = success.expected.required.filter(
    (behavior) => behavior !== "enter-project-directory",
  );
  assert.throws(() => validateEvalSpec(spec), /key save workflow requires enter-project-directory/);
});

test("missing-key branch requires --no-show-key creation", () => {
  const spec = cloneSpec();
  const keyError = spec.cases.find((evalCase) => evalCase.id === "run-demo-key-path-error-does-not-seek-secret");
  keyError.expected.required = keyError.expected.required.filter(
    (behavior) => behavior !== "create-eva-key-with-no-show",
  );
  assert.throws(() => validateEvalSpec(spec), /missing-key branch must create safely/);
});

test("existing-key branch forbids creating another key", () => {
  const spec = cloneSpec();
  const success = spec.cases.find((evalCase) => evalCase.id === "run-demo-success-after-confirmation");
  success.expected.forbidden = success.expected.forbidden.filter(
    (behavior) => behavior !== "create-eva-key-when-existing",
  );
  assert.throws(() => validateEvalSpec(spec), /existing-key branch must not create another key/);
});

test("successful Demo startup must pass the opaque AK path to the documented launcher", () => {
  const spec = cloneSpec();
  const success = spec.cases.find((evalCase) => evalCase.id === "run-demo-success-after-confirmation");
  success.expected.required = success.expected.required.filter(
    (behavior) => behavior !== "pass-credential-path-to-documented-launcher",
  );
  assert.throws(() => validateEvalSpec(spec), /must be passed to the documented launcher/);
});

test("Demo confirmation also requires a final workspace choice", () => {
  const spec = cloneSpec();
  const unique = spec.cases.find((evalCase) => evalCase.id === "run-demo-unique-candidate-still-confirms");
  unique.expected.required = unique.expected.required.filter(
    (behavior) => behavior !== "request-demo-workspace-choice",
  );
  assert.throws(() => validateEvalSpec(spec), /unresolved Demo workspace requires request-demo-workspace-choice/);
});

test("user-selected Demo destination cannot overwrite a non-empty directory", () => {
  const spec = cloneSpec();
  const success = spec.cases.find((evalCase) => evalCase.id === "run-demo-success-after-confirmation");
  success.expected.forbidden = success.expected.forbidden.filter(
    (behavior) => behavior !== "overwrite-nonempty-demo-workspace",
  );
  assert.throws(() => validateEvalSpec(spec), /non-empty user-selected workspace must not be overwritten/);
});

function cloneSpec() {
  return structuredClone(loadEvalSpec());
}
