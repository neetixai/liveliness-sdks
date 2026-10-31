import type {
  AccountDataResponse,
  AgeCheckResponse,
  AmlMonitorCreateResponse,
  AmlMonitorListResponse,
  AmlScreenResponse,
  ApiErrorBody,
  AuthVerifyResponse,
  BalanceResponse,
  ClientOptions,
  DeletedResponse,
  DeviceAnalyzeResponse,
  DeviceSignals,
  DocumentIdResponse,
  FaceEnrollResponse,
  FaceMatchResponse,
  FaceSearchResponse,
  KybValidateResponse,
  LedgerResponse,
  LinkCreateResponse,
  LinkInfoResponse,
  LinkListResponse,
  LinkVerifyResponse,
  LivenessResponse,
  MrzResponse,
  PacksResponse,
  ReviewDecisionResponse,
  ReviewsListResponse,
  SavedWorkflowResponse,
  SessionStartResponse,
  SessionVerifyResponse,
  SettingsUpdate,
  SignupResponse,
  StreamStartResponse,
  TemplateProtectResponse,
  TemplateVerifyResponse,
  TenantSettings,
  TopupResponse,
  Transaction,
  TxnMonitorResponse,
  ValidateResponse,
  VerificationKeyResponse,
  WalletBlocklistEntry,
  WalletScreenResponse,
  WorkflowCheck,
  WorkflowConfig,
  WorkflowRunResponse,
  WorkflowsListResponse,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://liveliness.neetix.in";

/** Anything postable as a file part: a browser/Node Blob, or `{ uri }` for RN. */
export type ImageInput = Blob | { uri: string; name?: string; type?: string };

/** Images for `documentId` — at least one of `back` / `front` is required. */
export interface DocumentIdImages {
  /** Back of the card — the side with the PDF417 barcode. */
  back?: ImageInput;
  /** Front (portrait) side. */
  front?: ImageInput;
}

/**
 * Input for `workflowRun`. Send the parts the requested checks need:
 * `person` (liveness / face_match), `card` (face_match), `mrz` (mrz),
 * `name` + `dob` (aml), `device` (device).
 */
export interface WorkflowRunInput {
  /** Inline check list; wins over `workflowId` when both are set. */
  checks?: WorkflowCheck[];
  /** UUID of a saved workflow — used only when `checks` is absent. */
  workflowId?: string;
  person?: ImageInput;
  card?: ImageInput;
  mrz?: string;
  name?: string;
  dob?: string;
  /** Device signals; serialized to JSON for the server. */
  device?: DeviceSignals;
}

/** Optional extra fields for `faceMatch`. */
export interface FaceMatchOptions {
  clientRefId?: string;
  customerId?: string;
  /** Injection-defense capture signing (see API docs §4). */
  captureNonce?: string;
  clientSignature?: string;
}

/**
 * Neetix Liveliness API client. Framework-agnostic: works in the browser, in
 * Node >= 18 (global fetch + Blob), and in React Native (pass a `{ uri }`
 * image part).
 *
 * Every billable call deducts prepaid credits (face-match 2, stream 5,
 * KYB 2, document-id 2, workflow 3, others 1); an exhausted balance throws a
 * `NeetixApiError` with `status === 402` and
 * `messageCode === "insufficient_credits"`.
 */
export class NeetixClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly _fetch: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    const f = opts.fetch ?? globalThis.fetch;
    if (!f) throw new Error("No fetch available; pass opts.fetch");
    this._fetch = f.bind(globalThis);
  }

  // ---------- Account ----------

  /**
   * Self-serve trial signup — no auth needed. Grants 500 free credits.
   * The returned `api_key` is shown ONCE; persist it.
   */
  async signup(email: string): Promise<SignupResponse> {
    return this.postJson<SignupResponse>("/v1/signup", { email }, false);
  }

  // ---------- Face & liveliness ----------

  /** Passive liveliness on a single selfie. Cost: 1 credit. */
  async liveness(person: ImageInput): Promise<LivenessResponse> {
    const form = new FormData();
    this.appendImage(form, "person", person);
    return this.postForm<LivenessResponse>("/v1/liveness", form);
  }

  /**
   * Face match + liveliness (selfie vs ID/reference photo). Cost: 2 credits.
   * Inspect `verdict` (`approved | review | declined`) and `warnings[]`.
   */
  async faceMatch(
    person: ImageInput,
    card: ImageInput,
    opts?: FaceMatchOptions,
  ): Promise<FaceMatchResponse> {
    const form = new FormData();
    this.appendImage(form, "person", person);
    this.appendImage(form, "card", card);
    if (opts?.clientRefId) form.append("client_ref_id", opts.clientRefId);
    if (opts?.customerId) form.append("customer_id", opts.customerId);
    if (opts?.captureNonce) form.append("capture_nonce", opts.captureNonce);
    if (opts?.clientSignature) form.append("client_signature", opts.clientSignature);
    return this.postForm<FaceMatchResponse>("/v1/face/face-match", form);
  }

  /**
   * Selfie age estimation. Cost: 1 credit.
   * New endpoint — older deployments return 404 (`messageCode: "not_found"`).
   */
  async ageCheck(person: ImageInput): Promise<AgeCheckResponse> {
    const form = new FormData();
    this.appendImage(form, "person", person);
    return this.postForm<AgeCheckResponse>("/v1/age", form);
  }

  // ---------- Active-challenge & streaming liveliness ----------

  /** Start an active-challenge liveliness session. */
  async sessionStart(): Promise<SessionStartResponse> {
    return this.postForm<SessionStartResponse>("/v1/session/start", new FormData());
  }

  /** Submit the ordered challenge frames (`frame_0, frame_1, …`). */
  async sessionVerify(
    sessionId: string,
    frames: ImageInput[],
  ): Promise<SessionVerifyResponse> {
    const form = new FormData();
    frames.forEach((f, i) => this.appendImage(form, `frame_${i}`, f));
    return this.postForm<SessionVerifyResponse>(
      `/v1/session/${encodeURIComponent(sessionId)}/verify`,
      form,
    );
  }

  /** Start a continuous-liveliness (V-CIP) stream session. Cost: 5 credits. */
  async streamStart(): Promise<StreamStartResponse> {
    return this.postForm<StreamStartResponse>("/v1/stream/start", new FormData());
  }

  /** The WebSocket URL for a stream session (feed it to `StreamSession`). */
  streamUrl(sessionId: string): string {
    const ws = this.baseUrl.replace(/^http/, "ws");
    return `${ws}/v1/stream/${encodeURIComponent(sessionId)}`;
  }

  // ---------- Biometric auth ----------

  /** Enroll a user's face for biometric authentication. */
  async authEnroll(userId: string, person: ImageInput): Promise<unknown> {
    const form = new FormData();
    this.appendImage(form, "person", person);
    form.append("user_id", userId);
    return this.postForm("/v1/auth/enroll", form);
  }

  /** Authenticate a returning user by face + liveliness. */
  async authVerify(userId: string, person: ImageInput): Promise<AuthVerifyResponse> {
    const form = new FormData();
    this.appendImage(form, "person", person);
    form.append("user_id", userId);
    return this.postForm<AuthVerifyResponse>("/v1/auth/verify", form);
  }

  // ---------- Screening & documents ----------

  /** AML / sanctions & PEP screening by name (+ optional DOB). Cost: 1 credit. */
  async amlScreen(
    name: string,
    dob?: string,
    threshold?: number,
  ): Promise<AmlScreenResponse> {
    const body: Record<string, unknown> = { name };
    if (dob !== undefined) body.dob = dob;
    if (threshold !== undefined) body.threshold = threshold;
    return this.postJson<AmlScreenResponse>("/v1/aml/screen", body);
  }

  /** KYB: validate Indian business identifiers (GSTIN / PAN / CIN). Cost: 2 credits. */
  async kybValidate(ids: {
    gstin?: string;
    pan?: string;
    cin?: string;
  }): Promise<KybValidateResponse> {
    return this.postJson<KybValidateResponse>("/v1/kyb/validate", ids);
  }

  /** Parse + checksum-validate a passport/ID MRZ (2 or 3 lines). Cost: 1 credit. */
  async mrzParse(mrz: string): Promise<MrzResponse> {
    return this.postJson<MrzResponse>("/v1/document/mrz", { mrz });
  }

  /**
   * US/CA driver's-license / state-ID parsing. `back` (the side with the
   * PDF417 barcode) is decoded and AAMVA-parsed into `aamva` + `checks`;
   * `front` (portrait side) runs face detection (`face_found`) + document
   * forensics. Send at least one image (400 otherwise). A back image with
   * no readable barcode is NOT an error: you get a 200 with
   * `checks.barcode_decoded === false` and a `BARCODE_UNREADABLE` warning.
   * Cost: 2 credits.
   */
  async documentId(images: DocumentIdImages): Promise<DocumentIdResponse> {
    const form = new FormData();
    if (images.back) this.appendImage(form, "back", images.back);
    if (images.front) this.appendImage(form, "front", images.front);
    return this.postForm<DocumentIdResponse>("/v1/document/id", form);
  }

  // ---------- Gallery (1:N face search) ----------

  /**
   * Enroll a face in the tenant's 1:N gallery under `subjectId`.
   * `blocklisted` subjects flag future `faceSearch` hits. Cost: 1 credit.
   */
  async faceEnroll(
    subjectId: string,
    person: ImageInput,
    blocklisted = false,
  ): Promise<FaceEnrollResponse> {
    const form = new FormData();
    this.appendImage(form, "person", person);
    form.append("subject_id", subjectId);
    if (blocklisted) form.append("blocklisted", "true");
    return this.postForm<FaceEnrollResponse>("/v1/face/enroll", form);
  }

  /**
   * Search the tenant gallery for the closest enrolled subjects (best first).
   * Check `blocklist_hit` for dedupe/blocklist flows. Cost: 1 credit.
   */
  async faceSearch(person: ImageInput, topK = 5): Promise<FaceSearchResponse> {
    const form = new FormData();
    this.appendImage(form, "person", person);
    form.append("top_k", String(topK));
    return this.postForm<FaceSearchResponse>("/v1/face/search", form);
  }

  // ---------- Revocable templates ----------

  /**
   * Turn a face into a revocable, non-invertible template (ISO/IEC 24745).
   * Store the returned `template` instead of an embedding — bumping
   * `keyVersion` revokes every template issued under the old version.
   * Cost: 1 credit.
   */
  async templateProtect(
    person: ImageInput,
    keyVersion = 1,
  ): Promise<TemplateProtectResponse> {
    const form = new FormData();
    this.appendImage(form, "person", person);
    form.append("key_version", String(keyVersion));
    return this.postForm<TemplateProtectResponse>("/v1/template/protect", form);
  }

  /**
   * Compare two protected templates. Templates from different key versions
   * never match (`revoked: true`). Cost: 1 credit.
   */
  async templateVerify(
    templateA: string,
    templateB: string,
  ): Promise<TemplateVerifyResponse> {
    return this.postJson<TemplateVerifyResponse>("/v1/template/verify", {
      template_a: templateA,
      template_b: templateB,
    });
  }

  // ---------- AML ongoing monitoring ----------

  /**
   * Add a subject to ongoing watchlist monitoring (screened immediately, then
   * on every watchlist refresh). A clear-to-hit transition fires the tenant
   * webhook (`aml.monitor.hit`). Cost: 1 credit.
   */
  async amlMonitorAdd(subject: {
    name: string;
    dob?: string;
    refId?: string;
  }): Promise<AmlMonitorCreateResponse> {
    const body: Record<string, unknown> = { name: subject.name };
    if (subject.dob !== undefined) body.dob = subject.dob;
    if (subject.refId !== undefined) body.ref_id = subject.refId;
    return this.postJson<AmlMonitorCreateResponse>("/v1/aml/monitor", body);
  }

  /** Monitored subjects, newest first. */
  async amlMonitorList(limit = 50): Promise<AmlMonitorListResponse> {
    return this.getJson<AmlMonitorListResponse>(
      `/v1/aml/monitor?limit=${limit}`,
    );
  }

  /** Stop monitoring a subject. */
  async amlMonitorDelete(id: string): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/aml/monitor/${encodeURIComponent(id)}`,
    );
  }

  // ---------- Validation ----------

  /**
   * Format + checksum validation for Indian identity numbers (Aadhaar via
   * Verhoeff, PAN, Voter ID, DL). Aadhaar comes back MASKED only.
   * Cost: 1 credit.
   */
  async validateIdentity(ids: {
    aadhaar?: string;
    pan?: string;
    voter?: string;
    dl?: string;
  }): Promise<ValidateResponse> {
    return this.postJson<ValidateResponse>("/v1/validate/identity", ids);
  }

  /**
   * Email validation (disposable / role-based flags) and phone normalization
   * to E.164. Cost: 1 credit.
   */
  async validateContact(contact: {
    email?: string;
    phone?: string;
  }): Promise<ValidateResponse> {
    return this.postJson<ValidateResponse>("/v1/validate/contact", contact);
  }

  // ---------- Risk ----------

  /**
   * Transaction monitoring (KYT) over a batch: high value, structuring,
   * velocity, round-tripping. Cost: 1 credit.
   */
  async txnMonitor(
    transactions: Transaction[],
    thresholds?: Record<string, unknown>,
  ): Promise<TxnMonitorResponse> {
    const body: Record<string, unknown> = { transactions };
    if (thresholds !== undefined) body.thresholds = thresholds;
    return this.postJson<TxnMonitorResponse>("/v1/txn/monitor", body);
  }

  /**
   * Screen a crypto wallet address against the provisioned blocklist, or an
   * inline `blocklist` supplied with the request. Cost: 1 credit.
   */
  async walletScreen(
    address: string,
    blocklist?: WalletBlocklistEntry[],
  ): Promise<WalletScreenResponse> {
    const body: Record<string, unknown> = { address };
    if (blocklist !== undefined) body.blocklist = blocklist;
    return this.postJson<WalletScreenResponse>("/v1/wallet/screen", body);
  }

  /**
   * Score device-integrity and network signals (emulator, root, tampering,
   * virtual camera, VPN/proxy/Tor/datacenter IP) into a risk score + flags.
   * Your app supplies the signals; this SDK does not collect them.
   * Cost: 1 credit.
   */
  async deviceAnalyze(signals: DeviceSignals): Promise<DeviceAnalyzeResponse> {
    return this.postJson<DeviceAnalyzeResponse>("/v1/device/analyze", signals);
  }

  // ---------- Workflows ----------

  /**
   * Run several checks in one call and get a single folded verdict. Pass
   * either inline `checks` or a saved `workflowId` (inline wins).
   * Cost: 3 credits.
   */
  async workflowRun(input: WorkflowRunInput): Promise<WorkflowRunResponse> {
    const form = new FormData();
    if (input.checks?.length) form.append("checks", input.checks.join(","));
    else if (input.workflowId) form.append("workflow_id", input.workflowId);
    if (input.person) this.appendImage(form, "person", input.person);
    if (input.card) this.appendImage(form, "card", input.card);
    if (input.mrz) form.append("mrz", input.mrz);
    if (input.name) form.append("name", input.name);
    if (input.dob) form.append("dob", input.dob);
    if (input.device) form.append("device", JSON.stringify(input.device));
    return this.postForm<WorkflowRunResponse>("/v1/workflow/run", form);
  }

  /** Saved workflow configurations, newest first. */
  async workflowsList(limit = 50): Promise<WorkflowsListResponse> {
    return this.getJson<WorkflowsListResponse>(`/v1/workflows?limit=${limit}`);
  }

  /** Save a reusable workflow configuration (names are unique per tenant). */
  async workflowSave(
    name: string,
    config: WorkflowConfig,
  ): Promise<SavedWorkflowResponse> {
    return this.postJson<SavedWorkflowResponse>("/v1/workflows", {
      name,
      config,
    });
  }

  /** Replace a saved workflow's name + config. */
  async workflowUpdate(
    id: string,
    name: string,
    config: WorkflowConfig,
  ): Promise<SavedWorkflowResponse> {
    return this.request<SavedWorkflowResponse>(
      "PUT",
      `/v1/workflows/${encodeURIComponent(id)}`,
      { name, config },
    );
  }

  /** Delete a saved workflow. */
  async workflowDelete(id: string): Promise<DeletedResponse> {
    return this.request<DeletedResponse>(
      "DELETE",
      `/v1/workflows/${encodeURIComponent(id)}`,
    );
  }

  // ---------- Hosted verification links ----------

  /**
   * Mint a single-use hosted verification URL — no frontend work on your
   * side. Free to mint; the `face_match` charge (2 credits) lands on you when
   * the end user actually verifies. Lifetime defaults to 72h (1-720).
   */
  async linkCreate(opts: {
    label?: string;
    expiresHours?: number;
  } = {}): Promise<LinkCreateResponse> {
    const body: Record<string, unknown> = {};
    if (opts.label !== undefined) body.label = opts.label;
    if (opts.expiresHours !== undefined) body.expires_hours = opts.expiresHours;
    return this.postJson<LinkCreateResponse>("/v1/links", body);
  }

  /** Your links with status + compact result, newest first. */
  async linkList(limit = 50): Promise<LinkListResponse> {
    return this.getJson<LinkListResponse>(`/v1/links?limit=${limit}`);
  }

  /**
   * Public link status — no auth, the token is the capability. Rate limited
   * per IP (30/hour). Use this to build your own applicant page.
   */
  async linkInfo(token: string): Promise<LinkInfoResponse> {
    return this.request<LinkInfoResponse>(
      "GET",
      `/v1/links/${encodeURIComponent(token)}`,
      undefined,
      false,
    );
  }

  /**
   * Complete a link as the end user (public, no auth): selfie + ID run the
   * standard face-match pipeline and the link OWNER is charged. Single-use —
   * a duplicate answers 410 `link_gone`; a bad-image 422 keeps the link
   * pending so the user can retry.
   */
  async linkVerify(
    token: string,
    person: ImageInput,
    card: ImageInput,
  ): Promise<LinkVerifyResponse> {
    const form = new FormData();
    this.appendImage(form, "person", person);
    this.appendImage(form, "card", card);
    return this.postForm<LinkVerifyResponse>(
      `/v1/links/${encodeURIComponent(token)}/verify`,
      form,
      false,
    );
  }

  // ---------- Review queue ----------

  /**
   * Verifications whose stored verdict is `review`, newest first.
   * Already-decided rows stay listed with their decision attached.
   */
  async reviewsList(limit = 100): Promise<ReviewsListResponse> {
    return this.getJson<ReviewsListResponse>(`/v1/reviews?limit=${limit}`);
  }

  /** Record a reviewer's ruling (note capped at 500 chars) + audit row. */
  async reviewDecide(
    requestId: string,
    decision: "approved" | "declined",
    note?: string,
  ): Promise<ReviewDecisionResponse> {
    const body: Record<string, unknown> = { decision };
    if (note !== undefined) body.note = note;
    return this.postJson<ReviewDecisionResponse>(
      `/v1/reviews/${encodeURIComponent(requestId)}/decision`,
      body,
    );
  }

  /**
   * The retained capture behind a review entry, as JPEG bytes. Exists only
   * when image retention was on at verification time and the row is still
   * inside the retention window (404 otherwise).
   */
  async reviewImage(
    requestId: string,
    kind: "person" | "card",
  ): Promise<Blob> {
    const res = await this._fetch(
      `${this.baseUrl}/v1/reviews/${encodeURIComponent(requestId)}/image/${kind}`,
      { method: "GET", headers: this.headers() },
    );
    if (!res.ok) await this.parse(res); // throws a NeetixApiError
    return res.blob();
  }

  // ---------- Tenant settings ----------

  /** Webhook + image-retention settings (defaults when never saved). */
  async settingsGet(): Promise<TenantSettings> {
    return this.getJson<TenantSettings>("/v1/settings");
  }

  /**
   * Partial update — absent fields keep their stored value; an EMPTY STRING
   * clears `webhook_url` / `webhook_secret` back to the global config.
   * `retention_days` must be 7-90.
   */
  async settingsUpdate(update: SettingsUpdate): Promise<TenantSettings> {
    return this.request<TenantSettings>("PUT", "/v1/settings", update);
  }

  // ---------- Account (DSAR) ----------

  /** Export everything stored about your account (profile, keys, ledger, logs). */
  async accountExport(): Promise<AccountDataResponse> {
    return this.getJson<AccountDataResponse>("/v1/account/export");
  }

  /**
   * Wipe biometric data, verification images and logs, and scrub the account
   * email. Financial records required for accounting are retained.
   * **Irreversible.**
   */
  async accountDelete(): Promise<AccountDataResponse> {
    return this.postJson<AccountDataResponse>("/v1/account/delete", {});
  }

  // ---------- Response signing ----------

  /**
   * The Ed25519 public key that signs face-match response bodies (detached
   * signature in the `X-Neetix-Signature` header). Public — no auth.
   */
  async verificationKey(): Promise<VerificationKeyResponse> {
    return this.request<VerificationKeyResponse>(
      "GET",
      "/v1/verification-key",
      undefined,
      false,
    );
  }

  // ---------- Billing (prepaid credits) ----------

  /** Current prepaid-credit balance. */
  async balance(): Promise<BalanceResponse> {
    return this.getJson<BalanceResponse>("/v1/billing/balance");
  }

  /** Credit ledger, newest first. */
  async ledger(limit = 50): Promise<LedgerResponse> {
    return this.getJson<LedgerResponse>(`/v1/billing/ledger?limit=${limit}`);
  }

  /** Purchasable credit packs. */
  async packs(): Promise<PacksResponse> {
    return this.getJson<PacksResponse>("/v1/billing/packs");
  }

  /**
   * Create a hosted-checkout top-up. Redirect the customer to
   * `checkout_url`; credits arrive when the payment settles (webhook-driven).
   */
  async topup(pack: string, email?: string): Promise<TopupResponse> {
    const body: Record<string, unknown> = { pack };
    if (email !== undefined) body.email = email;
    return this.postJson<TopupResponse>("/v1/billing/topup", body);
  }

  get key(): string | undefined {
    return this.apiKey;
  }

  // ---------- Transport ----------

  private headers(extra?: Record<string, string>, auth = true): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    if (auth && this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  private appendImage(form: FormData, field: string, image: ImageInput): void {
    if (typeof Blob !== "undefined" && image instanceof Blob) {
      form.append(field, image, "image.jpg");
    } else {
      // React Native file part.
      const rn = image as { uri: string; name?: string; type?: string };
      form.append(field, {
        uri: rn.uri,
        name: rn.name ?? "image.jpg",
        type: rn.type ?? "image/jpeg",
      } as unknown as Blob);
    }
  }

  private async postForm<T = unknown>(
    path: string,
    form: FormData,
    auth = true,
  ): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(undefined, auth),
      body: form as unknown as BodyInit,
    });
    return this.parse<T>(res);
  }

  /** GET/PUT/DELETE with an optional JSON body. */
  private async request<T>(
    method: "GET" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    auth = true,
  ): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(
        body === undefined ? undefined : { "Content-Type": "application/json" },
        auth,
      ),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return this.parse<T>(res);
  }

  private async postJson<T>(path: string, body: unknown, auth = true): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }, auth),
      body: JSON.stringify(body),
    });
    return this.parse<T>(res);
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    return this.parse<T>(res);
  }

  private async parse<T>(res: Response): Promise<T> {
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new NeetixApiError(
        `Non-JSON response (${res.status}): ${text.slice(0, 200)}`,
        res.status,
        undefined,
        text,
      );
    }
    if (!res.ok) {
      const body = json as ApiErrorBody;
      // Standard envelope carries `message` + `message_code`; face-match
      // domain errors carry a Digitap-style `error` string instead.
      const msg =
        body?.message ??
        (typeof body?.error === "string" ? body.error : undefined) ??
        `HTTP ${res.status}`;
      throw new NeetixApiError(msg, res.status, body?.message_code, json);
    }
    return json as T;
  }
}

/**
 * API error. `status` is the HTTP status; `messageCode` is the stable
 * machine-readable code from the error envelope (e.g. `unauthorized`,
 * `no_face_detected`, `insufficient_credits`).
 */
export class NeetixApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly messageCode: string | undefined,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "NeetixApiError";
  }

  /** True when the prepaid balance is exhausted (HTTP 402). */
  get isInsufficientCredits(): boolean {
    return this.status === 402 || this.messageCode === "insufficient_credits";
  }
}
