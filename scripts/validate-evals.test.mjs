import assert from "node:assert/strict";
import { test } from "node:test";

import { loadEvalSpec, validateEvalSpec } from "./validate-evals.mjs";

test("accepts the repository eval catalog and its required coverage", () => {
  const result = validateEvalSpec(loadEvalSpec());
  assert.deepEqual(result, { cases: 13, skill: "eva-sdk" });
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

test("requires the AK prohibition set on every success and failure path", () => {
  const spec = cloneSpec();
  const cliError = spec.cases.find((evalCase) => evalCase.id === "run-demo-key-path-error-does-not-seek-secret");
  cliError.expected.forbidden = cliError.expected.forbidden.filter(
    (behavior) => behavior !== "read-ak-file",
  );
  assert.throws(() => validateEvalSpec(spec), /missing core AK prohibition read-ak-file/);
});

test("forbids CLI, dependency restore, and startup before candidate confirmation", () => {
  const spec = cloneSpec();
  const ambiguous = spec.cases.find((evalCase) => evalCase.id === "run-demo-ambiguous-lists-candidates");
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

test("key path retrieval requires workspace initialization", () => {
  const spec = cloneSpec();
  const success = spec.cases.find((evalCase) => evalCase.id === "run-demo-success-after-confirmation");
  success.expected.required = success.expected.required.filter(
    (behavior) => behavior !== "initialize-eva-workspace",
  );
  assert.throws(() => validateEvalSpec(spec), /key path workflow requires initialize-eva-workspace/);
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
  assert.throws(() => validateEvalSpec(spec), /selection gate requires request-demo-workspace-choice/);
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
