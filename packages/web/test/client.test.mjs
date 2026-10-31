// Request-shape tests for the TypeScript client, run with `node --test`
// against the built `dist/` (so they exercise what consumers actually load).
//
// No network: a stub fetch records every request. These assert the two things
// that silently break integrations — the path/method/body we send, and
// whether the API key is attached. Public endpoints MUST NOT carry it.

import { test } from "node:test";
import assert from "node:assert/strict";

import { NeetixClient, NeetixApiError } from "../dist/index.js";

/** A fetch stub that records calls and replies with `body` (200 by default). */
function stub(body = { status: "success" }, init = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, fetchImpl };
}

function client(fetchImpl, apiKey = "lv_test_key") {
  return new NeetixClient({
    baseUrl: "https://api.example.test",
    apiKey,
    fetch: fetchImpl,
  });
}

const auth = (call) => call.options.headers["Authorization"];
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });

test("baseUrl trailing slashes are trimmed, bearer key attached", async () => {
  const { calls, fetchImpl } = stub();
  const nx = new NeetixClient({
    baseUrl: "https://api.example.test///",
    apiKey: "k",
    fetch: fetchImpl,
  });
  await nx.balance();
  assert.equal(calls[0].url, "https://api.example.test/v1/billing/balance");
  assert.equal(auth(calls[0]), "Bearer k");
});

test("signup is unauthenticated and posts JSON", async () => {
  const { calls, fetchImpl } = stub({ status: "success", api_key: "x", credits: 1000 });
  const res = await client(fetchImpl).signup("dev@example.test");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].url, "https://api.example.test/v1/signup");
  assert.equal(auth(calls[0]), undefined, "signup must not send the API key");
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: "dev@example.test" });
  assert.equal(res.credits, 1000);
});

test("faceMatch posts both images plus the optional typed fields", async () => {
  const { calls, fetchImpl } = stub();
  await client(fetchImpl).faceMatch(jpeg(), jpeg(), {
    clientRefId: "ref-1",
    customerId: "cust-1",
    captureNonce: "nonce",
    clientSignature: "sig",
  });
  const form = calls[0].options.body;
  assert.equal(calls[0].url, "https://api.example.test/v1/face/face-match");
  assert.ok(form.get("person"), "person part present");
  assert.ok(form.get("card"), "card part present");
  assert.equal(form.get("client_ref_id"), "ref-1");
  assert.equal(form.get("customer_id"), "cust-1");
  assert.equal(form.get("capture_nonce"), "nonce");
  assert.equal(form.get("client_signature"), "sig");
});

test("faceEnroll only sends blocklisted when asked", async () => {
  const { calls, fetchImpl } = stub();
  const nx = client(fetchImpl);
  await nx.faceEnroll("subject-1", jpeg());
  assert.equal(calls[0].options.body.get("subject_id"), "subject-1");
  assert.equal(calls[0].options.body.get("blocklisted"), null);

  await nx.faceEnroll("subject-2", jpeg(), true);
  assert.equal(calls[1].options.body.get("blocklisted"), "true");
});

test("templateProtect defaults to key version 1 and templateVerify posts both", async () => {
  const { calls, fetchImpl } = stub();
  const nx = client(fetchImpl);
  await nx.templateProtect(jpeg());
  assert.equal(calls[0].url, "https://api.example.test/v1/template/protect");
  assert.equal(calls[0].options.body.get("key_version"), "1");

  await nx.templateVerify("A", "B");
  assert.deepEqual(JSON.parse(calls[1].options.body), { template_a: "A", template_b: "B" });
});

test("amlMonitorAdd maps refId to ref_id and omits absent fields", async () => {
  const { calls, fetchImpl } = stub();
  await client(fetchImpl).amlMonitorAdd({ name: "Asha Kumar", refId: "lead-9" });
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    name: "Asha Kumar",
    ref_id: "lead-9",
  });
});

test("amlMonitorDelete and workflowDelete use DELETE with an encoded id", async () => {
  const { calls, fetchImpl } = stub({ status: "success", id: "x", deleted: true });
  const nx = client(fetchImpl);
  await nx.amlMonitorDelete("a/b");
  assert.equal(calls[0].options.method, "DELETE");
  assert.equal(calls[0].url, "https://api.example.test/v1/aml/monitor/a%2Fb");

  await nx.workflowDelete("w1");
  assert.equal(calls[1].options.method, "DELETE");
  assert.equal(calls[1].url, "https://api.example.test/v1/workflows/w1");
});

test("settingsUpdate uses PUT and forwards an empty string as a clear", async () => {
  const { calls, fetchImpl } = stub();
  await client(fetchImpl).settingsUpdate({ webhook_url: "", retention_days: 30 });
  assert.equal(calls[0].options.method, "PUT");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    webhook_url: "",
    retention_days: 30,
  });
});

test("workflowRun sends inline checks and serializes device signals", async () => {
  const { calls, fetchImpl } = stub();
  await client(fetchImpl).workflowRun({
    checks: ["liveness", "face_match", "device"],
    person: jpeg(),
    card: jpeg(),
    device: { emulator: true, ip: "203.0.113.5" },
  });
  const form = calls[0].options.body;
  assert.equal(form.get("checks"), "liveness,face_match,device");
  assert.deepEqual(JSON.parse(form.get("device")), { emulator: true, ip: "203.0.113.5" });
});

test("workflowRun prefers inline checks over a saved workflow id", async () => {
  const { calls, fetchImpl } = stub();
  await client(fetchImpl).workflowRun({ checks: ["aml"], workflowId: "saved-1", name: "A" });
  assert.equal(calls[0].options.body.get("checks"), "aml");
  assert.equal(calls[0].options.body.get("workflow_id"), null);
});

test("workflowRun falls back to workflow_id when no checks are given", async () => {
  const { calls, fetchImpl } = stub();
  await client(fetchImpl).workflowRun({ workflowId: "saved-1", person: jpeg() });
  assert.equal(calls[0].options.body.get("workflow_id"), "saved-1");
});

test("the public link endpoints never send the API key", async () => {
  const { calls, fetchImpl } = stub({
    status: "success",
    token: "t",
    request_id: "r",
    result: { verdict: "approved", confidence: 98.9, liveness: 95, warnings: [] },
  });
  const nx = client(fetchImpl);

  await nx.linkInfo("tok en");
  assert.equal(calls[0].url, "https://api.example.test/v1/links/tok%20en");
  assert.equal(auth(calls[0]), undefined, "linkInfo is a public endpoint");

  await nx.linkVerify("tok", jpeg(), jpeg());
  assert.equal(calls[1].url, "https://api.example.test/v1/links/tok/verify");
  assert.equal(auth(calls[1]), undefined, "linkVerify is completed by the end user");

  await nx.verificationKey();
  assert.equal(auth(calls[2]), undefined, "verification-key is public");

  // Contrast: minting a link is an owner action and must be authenticated.
  await nx.linkCreate({ label: "KYC", expiresHours: 24 });
  assert.equal(auth(calls[3]), "Bearer lv_test_key");
  assert.deepEqual(JSON.parse(calls[3].options.body), { label: "KYC", expires_hours: 24 });
});

test("streamUrl switches the scheme to ws and encodes the id", async () => {
  const { fetchImpl } = stub();
  assert.equal(
    client(fetchImpl).streamUrl("s 1"),
    "wss://api.example.test/v1/stream/s%201",
  );
});

test("a 402 surfaces as NeetixApiError with isInsufficientCredits", async () => {
  const { fetchImpl } = stub(
    { message: "insufficient credits", message_code: "insufficient_credits" },
    { status: 402 },
  );
  await assert.rejects(
    () => client(fetchImpl).liveness(jpeg()),
    (err) => {
      assert.ok(err instanceof NeetixApiError);
      assert.equal(err.status, 402);
      assert.equal(err.messageCode, "insufficient_credits");
      assert.ok(err.isInsufficientCredits);
      return true;
    },
  );
});

test("a face-match 422 fail body surfaces its `error` string", async () => {
  const { fetchImpl } = stub(
    { status: "fail", statusCode: 422, error: "No face detected in person image" },
    { status: 422 },
  );
  await assert.rejects(
    () => client(fetchImpl).faceMatch(jpeg(), jpeg()),
    (err) => {
      assert.equal(err.status, 422);
      assert.match(err.message, /No face detected/);
      return true;
    },
  );
});

test("reviewImage returns the raw blob and still throws on an error status", async () => {
  const { calls, fetchImpl } = stub();
  const blob = await client(fetchImpl).reviewImage("req-1", "person");
  assert.equal(calls[0].url, "https://api.example.test/v1/reviews/req-1/image/person");
  assert.ok(blob instanceof Blob);

  const missing = stub({ message: "not found", message_code: "not_found" }, { status: 404 });
  await assert.rejects(() => client(missing.fetchImpl).reviewImage("req-2", "card"), NeetixApiError);
});
