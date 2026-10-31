#!/usr/bin/env node
/**
 * Contract check — the guard that keeps these SDKs from drifting away from the
 * API again.
 *
 * Reads `spec/openapi.yaml` (refresh it with `just sync-spec`), extracts every
 * documented path + method, then scans each SDK's client source for the paths
 * it actually calls. Endpoints that are deliberately out of scope for a client
 * SDK live in EXCLUDED with a reason; anything else missing from the WEB SDK
 * (the reference client) fails the check. The other platforms are reported as
 * coverage, not enforced — their parity table in README.md is generated from
 * this output.
 *
 * Usage:
 *   node tools/contract-check.mjs            # human report, exits non-zero on a gap
 *   node tools/contract-check.mjs --markdown # parity table for README.md
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Endpoints no API-key client SDK should wrap, and why. Keeping the reason
 * next to the exclusion is the point: a reader can tell "not supported yet"
 * from "never belongs here".
 */
const EXCLUDED = new Map([
  ["GET /health", "infra probe, not a product call"],
  ["GET /ready", "infra probe"],
  ["GET /metrics", "Prometheus scrape, operator-only"],
  ["GET /capture", "server-rendered hosted capture page (HTML, not JSON)"],
  ["POST /v1/leads", "marketing site contact form"],
  ["GET /v1/auth/config", "console browser surface"],
  ["GET /v1/auth/google/start", "console OAuth redirect"],
  ["GET /v1/auth/google/callback", "console OAuth redirect"],
  ["POST /v1/auth/logout", "console session cookie"],
  ["GET /v1/auth/me", "console session cookie"],
  ["POST /v1/keys", "session-authed only (console mints keys)"],
  ["POST /v1/keys/revoke", "session-authed only"],
  ["POST /v1/face/verify", "alias of /v1/face/face-match (same handler)"],
  ["GET /v1/stream/{id}", "WebSocket upgrade — see StreamSession, not a REST call"],
  ["POST /v1/billing/webhook/dodo", "inbound payment webhook (server receives)"],
  ["GET /v1/admin/overview", "admin key, operator-only"],
  ["GET /v1/admin/accounts", "admin key, operator-only"],
  ["GET /v1/admin/leads", "admin key, operator-only"],
  ["POST /v1/admin/credits/grant", "admin key, operator-only"],
  ["POST /v1/admin/aml/rescreen", "admin key, operator-only"],
  ["POST /v1/admin/aml/reload", "admin key, operator-only"],
  ["POST /v1/admin/images/purge", "admin key, operator-only"],
]);

/**
 * Back-office endpoints we deliberately do NOT put in an on-device SDK. An
 * API key in a shipped app is extractable, so the mobile surface stops at
 * capture-and-verify: no key that can drain the review queue, rewrite webhook
 * settings, mint links or delete the account should ever live in an app
 * bundle. Server SDKs (web/Node) wrap all of it.
 */
const SERVER_ONLY = new Set([
  "POST /v1/links",
  "GET /v1/links",
  "GET /v1/reviews",
  "POST /v1/reviews/{request_id}/decision",
  "GET /v1/reviews/{request_id}/image/{kind}",
  "GET /v1/settings",
  "PUT /v1/settings",
  "GET /v1/account/export",
  "POST /v1/account/delete",
  "GET /v1/workflows",
  "POST /v1/workflows",
  "PUT /v1/workflows/{id}",
  "DELETE /v1/workflows/{id}",
  "POST /v1/aml/monitor",
  "GET /v1/aml/monitor",
  "DELETE /v1/aml/monitor/{id}",
  "POST /v1/txn/monitor",
  "POST /v1/wallet/screen",
]);

/**
 * The SDKs we scan. `scope: "full"` must cover every in-scope endpoint;
 * `scope: "device"` must cover everything except SERVER_ONLY. Both are
 * enforced — that is what keeps "one API, same surface everywhere" true.
 */
const SDKS = [
  {
    name: "Web / Node (TS)",
    scope: "full",
    reference: true,
    files: ["packages/web/src/client.ts", "packages/web/src/stream.ts"],
  },
  {
    name: "React Native",
    scope: "full",
    // Re-exports the web client, so its coverage is the web client's.
    inherits: "Web / Node (TS)",
    files: ["packages/react-native/src/index.ts"],
  },
  {
    name: "Flutter",
    scope: "device",
    files: ["packages/flutter/lib/src/client.dart"],
  },
  {
    name: "iOS (Swift)",
    scope: "device",
    files: ["packages/swift/Sources/NeetixLiveliness/NeetixClient.swift"],
  },
  {
    name: "Android (Kotlin)",
    scope: "device",
    files: ["packages/android/src/main/kotlin/in/neetix/liveliness/NeetixClient.kt"],
  },
];

// ---------- spec ----------

/** Top-level `paths:` entries and their methods, straight off the YAML. */
function specEndpoints(yaml) {
  const lines = yaml.split("\n");
  const out = [];
  let inPaths = false;
  let current = null;
  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    if (/^\S/.test(line)) break; // next top-level key ends the paths block
    const path = line.match(/^ {2}(\/[^:\s]*):\s*$/);
    if (path) {
      current = path[1];
      continue;
    }
    const method = line.match(/^ {4}(get|post|put|patch|delete):\s*$/);
    if (method && current) out.push(`${method[1].toUpperCase()} ${current}`);
  }
  return out;
}

// ---------- SDK sources ----------

/**
 * Paths a source file calls. Normalizes interpolation back to the spec's
 * `{param}` form so `/v1/links/${token}/verify` matches
 * `/v1/links/{token}/verify`.
 */
function pathsIn(source) {
  const found = new Set();
  // A path is `/v1/` followed by any run of plain chars, `${...}`
  // interpolations (TS/Kotlin/Dart/Swift all use this shape) or `{...}`
  // placeholders — repeated, so multi-parameter paths match too.
  const re =
    /\/v1\/(?:[A-Za-z0-9/_.-]|\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*|\{[^}]*\}|\\\([^)]*\))+/g;
  for (const m of source.matchAll(re)) {
    const p = m[0]
      .replace(/\$\{[^}]*\}/g, "{param}")
      .replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, "{param}") // Kotlin "$sessionId"
      .replace(/\\\([^)]*\)/g, "{param}") // Swift string interpolation
      .replace(/\{[^}]*\}/g, "{param}")
      .replace(/\?.*$/, "")
      .replace(/\/+$/, "");
    if (p.length > 4) found.add(p);
  }
  return found;
}

/** Spec path with its parameter names flattened, for comparison. */
function normalizeSpecPath(path) {
  return path.replace(/\{[^}]*\}/g, "{param}");
}

function coverage(sdk) {
  const called = new Set();
  for (const rel of sdk.files) {
    let src;
    try {
      src = readFileSync(join(root, rel), "utf8");
    } catch {
      continue;
    }
    for (const p of pathsIn(src)) called.add(p);
  }
  return called;
}

// ---------- report ----------

const spec = specEndpoints(readFileSync(join(root, "spec/openapi.yaml"), "utf8"));
const inScope = spec.filter((e) => !EXCLUDED.has(e));

const byName = new Map();
for (const sdk of SDKS) byName.set(sdk.name, coverage(sdk));
for (const sdk of SDKS) {
  if (sdk.inherits) byName.set(sdk.name, byName.get(sdk.inherits));
}

const deviceScope = inScope.filter((e) => !SERVER_ONLY.has(e));

const rows = SDKS.map((sdk) => {
  const called = byName.get(sdk.name);
  const expected = sdk.scope === "device" ? deviceScope : inScope;
  const have = expected.filter((e) =>
    called.has(normalizeSpecPath(e.split(" ")[1])),
  );
  return {
    sdk,
    expected,
    have: have.length,
    missing: expected.filter((e) => !have.includes(e)),
  };
});

const markdown = process.argv.includes("--markdown");

if (markdown) {
  console.log(`| SDK | Scope | Endpoints wrapped |`);
  console.log(`|---|---|---|`);
  for (const r of rows) {
    const scope = r.sdk.scope === "device" ? "on-device" : "server + browser";
    console.log(`| ${r.sdk.name} | ${scope} | ${r.have} / ${r.expected.length} |`);
  }
} else {
  console.log(
    `spec: ${spec.length} documented operations — ${inScope.length} in scope for a client SDK, ` +
      `${EXCLUDED.size} excluded by design`,
  );
  console.log(
    `on-device scope: ${deviceScope.length} (${SERVER_ONLY.size} back-office endpoints stay server-side)\n`,
  );
  for (const r of rows) {
    const pct = Math.round((r.have / r.expected.length) * 100);
    console.log(
      `  ${r.sdk.name.padEnd(18)} ${String(r.have).padStart(2)}/${String(r.expected.length).padEnd(2)}  ${String(pct).padStart(3)}%  (${r.sdk.scope})`,
    );
  }
}

let failed = false;
for (const r of rows) {
  if (r.missing.length === 0) continue;
  failed = true;
  console.error(
    `\nFAIL — ${r.sdk.name} does not wrap ${r.missing.length} endpoint(s) in its ${r.sdk.scope} scope:`,
  );
  for (const e of r.missing) console.error(`  - ${e}`);
}

if (failed) {
  console.error(
    "\nAdd a method for each, or record the reason in tools/contract-check.mjs " +
      "(EXCLUDED for 'never in an SDK', SERVER_ONLY for 'not on a device').",
  );
  process.exit(1);
}

if (!markdown) console.log("\nOK — every SDK covers its scope.");
