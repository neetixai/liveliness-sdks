import type {
  AuthVerifyResponse,
  ClientOptions,
  FaceMatchResponse,
  LivenessResponse,
  MrzResponse,
  SessionStartResponse,
  StreamStartResponse,
} from "./types";

/** Anything postable as a file part: a browser Blob, or `{ uri }` for RN. */
export type ImageInput = Blob | { uri: string; name?: string; type?: string };

/**
 * Neetix Liveliness API client. Framework-agnostic: works in the browser, in
 * React Native (pass a `{ uri }` image and the RN fetch), and in Node.
 */
export class NeetixClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly _fetch: typeof fetch;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    const f = opts.fetch ?? globalThis.fetch;
    if (!f) throw new Error("No fetch available; pass opts.fetch");
    this._fetch = f.bind(globalThis);
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    if (this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  private appendImage(form: FormData, field: string, image: ImageInput): void {
    if (image instanceof Blob) {
      form.append(field, image, "image.jpg");
    } else {
      // React Native file part.
      form.append(field, {
        uri: image.uri,
        name: image.name ?? "image.jpg",
        type: image.type ?? "image/jpeg",
      } as unknown as Blob);
    }
  }

  private async post<T>(path: string, form: FormData): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: form as unknown as BodyInit,
    });
    return this.parse<T>(res);
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    return this.parse<T>(res);
  }

  private async parse<T>(res: Response): Promise<T> {
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const msg =
        (json as { message?: string })?.message ?? `HTTP ${res.status}`;
      throw new NeetixApiError(msg, res.status, json);
    }
    return json as T;
  }

  /** Passive liveliness on a single selfie. */
  async liveness(selfie: ImageInput): Promise<LivenessResponse> {
    const form = new FormData();
    this.appendImage(form, "person", selfie);
    return this.post<LivenessResponse>("/v1/liveness", form);
  }

  /** Face match + liveliness (selfie vs ID/reference). */
  async faceMatch(
    selfie: ImageInput,
    card: ImageInput,
    fields?: Record<string, string>,
  ): Promise<FaceMatchResponse> {
    const form = new FormData();
    this.appendImage(form, "person", selfie);
    this.appendImage(form, "card", card);
    for (const [k, v] of Object.entries(fields ?? {})) form.append(k, v);
    return this.post<FaceMatchResponse>("/v1/face/face-match", form);
  }

  /** Enroll a user's face for biometric authentication. */
  async authEnroll(userId: string, selfie: ImageInput): Promise<unknown> {
    const form = new FormData();
    this.appendImage(form, "person", selfie);
    form.append("user_id", userId);
    return this.post("/v1/auth/enroll", form);
  }

  /** Authenticate a returning user by face + liveliness. */
  async authVerify(userId: string, selfie: ImageInput): Promise<AuthVerifyResponse> {
    const form = new FormData();
    this.appendImage(form, "person", selfie);
    form.append("user_id", userId);
    return this.post<AuthVerifyResponse>("/v1/auth/verify", form);
  }

  /** Start an active-challenge liveliness session. */
  async sessionStart(): Promise<SessionStartResponse> {
    const form = new FormData();
    return this.post<SessionStartResponse>("/v1/session/start", form);
  }

  /** Submit the ordered challenge frames for a session. */
  async sessionVerify(sessionId: string, frames: ImageInput[]): Promise<unknown> {
    const form = new FormData();
    frames.forEach((f, i) => this.appendImage(form, `frame_${i}`, f));
    return this.post(`/v1/session/${sessionId}/verify`, form);
  }

  /** Start a continuous-liveliness (V-CIP) stream session. */
  async streamStart(): Promise<StreamStartResponse> {
    const form = new FormData();
    return this.post<StreamStartResponse>("/v1/stream/start", form);
  }

  /** Parse + validate a passport/ID MRZ. */
  async parseMrz(mrz: string): Promise<MrzResponse> {
    return this.postJson<MrzResponse>("/v1/document/mrz", { mrz });
  }

  /** Protect an embedding into a revocable template ("no honeypot" storage). */
  async templateProtect(
    selfie: ImageInput,
    keyVersion = 1,
  ): Promise<{ template: string; version: number }> {
    const form = new FormData();
    this.appendImage(form, "person", selfie);
    form.append("key_version", String(keyVersion));
    return this.post("/v1/template/protect", form);
  }

  /** Compare two revocable templates. */
  async templateVerify(
    templateA: string,
    templateB: string,
  ): Promise<{ similarity: number; is_match: boolean; revoked: boolean }> {
    return this.postJson("/v1/template/verify", {
      template_a: templateA,
      template_b: templateB,
    });
  }

  /** The WebSocket URL for a stream session (for `StreamSession`). */
  streamUrl(sessionId: string): string {
    const ws = this.baseUrl.replace(/^http/, "ws");
    return `${ws}/v1/stream/${sessionId}`;
  }

  get key(): string | undefined {
    return this.apiKey;
  }
}

export class NeetixApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "NeetixApiError";
  }
}
