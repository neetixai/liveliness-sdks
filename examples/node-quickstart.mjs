#!/usr/bin/env node
// Neetix Liveliness — Node quickstart: signup -> age check -> face match.
//
// From a repo clone (builds the web SDK first):
//   npm install && npm run build -w @neetix/liveliness
//   node examples/node-quickstart.mjs selfie.jpg id-card.jpg [you@company.com]
//
// With an existing key:  NEETIX_API_KEY=lv_... node examples/node-quickstart.mjs selfie.jpg id.jpg
//
// Requires Node >= 18 (global fetch + Blob).
import { readFile } from "node:fs/promises";
import { NeetixClient, NeetixApiError } from "@neetix/liveliness";

const [selfiePath, cardPath, email] = process.argv.slice(2);
if (!selfiePath || !cardPath) {
  console.error("usage: node-quickstart.mjs <selfie.jpg> <id-card.jpg> [signup-email]");
  process.exit(1);
}

const asBlob = async (path) =>
  new Blob([await readFile(path)], { type: "image/jpeg" });

// 1. Get a key: from the environment, or self-serve signup (500 free credits).
let apiKey = process.env.NEETIX_API_KEY;
if (!apiKey) {
  const signupEmail = email ?? `sdk-demo+${Date.now()}@example.com`;
  const s = await new NeetixClient().signup(signupEmail);
  apiKey = s.api_key;
  console.log(`signed up ${signupEmail}: ${s.credits} free credits (key shown once — save it!)`);
}

const nx = new NeetixClient({ apiKey });
const selfie = await asBlob(selfiePath);
const card = await asBlob(cardPath);

// 2. Age check (1 credit). New endpoint — tolerate 404 on older deployments.
try {
  const age = await nx.ageCheck(selfie);
  console.log("age check:", JSON.stringify(age));
} catch (e) {
  if (e instanceof NeetixApiError && e.status === 404) {
    console.log("age check: /v1/age not available on this deployment yet, skipping");
  } else throw e;
}

// 3. Face match + liveliness (2 credits).
try {
  const res = await nx.faceMatch(selfie, card, { clientRefId: "quickstart-1" });
  console.log(`verdict: ${res.verdict}`);
  console.log(`same face: ${res.result.is_same_face} (${res.result.same_face_confidence})`);
  console.log(`liveness: ${res.result.liveness_score} (${res.result.liveness_status})`);
  for (const w of res.warnings) console.log(`warning [${w.severity}] ${w.code}: ${w.description}`);
} catch (e) {
  if (e instanceof NeetixApiError) {
    console.error(`API error ${e.status} (${e.messageCode}): ${e.message}`);
    if (e.isInsufficientCredits) console.error("→ top up via POST /v1/billing/topup");
    process.exit(2);
  }
  throw e;
}

// 4. What did that cost?
const bal = await nx.balance();
console.log(`credits left: ${bal.balance}`);
