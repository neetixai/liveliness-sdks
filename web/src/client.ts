import type {
  AgeCheckResponse,
  AmlScreenResponse,
  ApiErrorBody,
  AuthVerifyResponse,
  BalanceResponse,
  ClientOptions,
  DocumentIdResponse,
  FaceMatchResponse,
  KybValidateResponse,
  LedgerResponse,
  LivenessResponse,
  MrzResponse,
  PacksResponse,
  SessionStartResponse,
  SessionVerifyResponse,
  SignupResponse,
  StreamStartResponse,
  TopupResponse,
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

  private async postForm<T = unknown>(path: string, form: FormData): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: form as unknown as BodyInit,
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
