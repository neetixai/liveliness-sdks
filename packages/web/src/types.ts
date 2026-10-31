// Wire types for the Neetix Liveliness API (https://liveliness.neetix.in).
// These mirror the server's response shapes; unknown/extra keys are preserved
// where the shape is open-ended.

export type Verdict = "approved" | "review" | "declined";

/** One entry of the risk-policy `warnings[]` array. */
export interface Warning {
  code: string;
  severity: "decline" | "review";
  description: string;
}

export interface QualityMetrics {
  sharpness: number;
  brightness: number;
  face_area_ratio: number;
  score: number;
  blurry: boolean;
}

export interface Forensics {
  screen_replay_score: number;
  synthetic_score: number;
  high_freq_ratio: number;
  spectral_peak: number;
}

export interface FaceSignals {
  mask_confidence?: number;
  left_eye_open?: number;
  right_eye_open?: number;
  age_bracket?: string;
  gender?: string;
  emotion?: string;
}

export interface CaptureIntegrity {
  selfie_sha256: string;
  exif_present: boolean;
  camera?: string;
  software?: string;
  edited: boolean;
  c2pa_manifest_present: boolean;
  replayed: boolean;
  signed_capture: boolean;
}

export interface FaceMatchResult {
  is_same_face: boolean;
  same_face_confidence: number;
  cosine_similarity: number;
  decision: string;
  match_threshold: number;
  liveness_score: number;
  liveness_status: string;
  spoof_detected: boolean;
  liveness_threshold: number;
  person_quality: QualityMetrics;
  card_quality: QualityMetrics;
  person_face_count: number;
  card_face_count: number;
  forensics: Forensics;
  document_forensics: Forensics;
  face_signals?: FaceSignals;
  capture?: CaptureIntegrity;
  model_version: string;
  latency_ms: number;
}

/** `POST /v1/face/face-match` */
export interface FaceMatchResponse {
  status: string;
  statusCode: number;
  verdict: Verdict;
  warnings: Warning[];
  clientRefId: string;
  requestId: string;
  result: FaceMatchResult;
}

/** `POST /v1/liveness` */
export interface LivenessResponse {
  status: "Approved" | "Declined" | "Not Finished";
  liveness_score: number;
  liveness_status: string;
  liveness_evaluated: boolean;
  face_count: number;
  threshold: number;
}

/**
 * `POST /v1/age` — selfie age estimation (new endpoint; may return 404
 * `not_found` on deployments that predate it).
 */
export interface AgeCheckResponse {
  status: string;
  /** e.g. "20-29"; "unknown" on the tract fallback backend. */
  age_bracket: string;
  /** Bracket midpoint estimate; null when unavailable. */
  age_estimate: number | null;
  face_count: number;
  /** 0-100; null when liveness wasn't evaluated. */
  liveness_score: number | null;
  [key: string]: unknown;
}

/** `POST /v1/signup` — the api_key is shown ONCE; store it. */
export interface SignupResponse {
  status: string;
  api_key: string;
  client_id: string;
  /** Legacy field kept for compatibility (superseded by `credits`). */
  monthly_quota: number;
  /** Free credits granted on signup (500). */
  credits: number;
  message: string;
}

export interface AuthVerifyResponse {
  status: string;
  authenticated: boolean;
  user_id: string;
  match_confidence: number;
  match_threshold: number;
  liveness_score: number;
  liveness_ok: boolean;
}

/** `POST /v1/session/start` */
export interface SessionStartResponse {
  status: string;
  session_id: string;
  challenges: string[];
  expires_at: string;
  instructions: string;
}

/** `POST /v1/session/{id}/verify` — verdict envelope. */
export interface SessionVerifyResponse {
  status: string;
  verdict?: string;
  warnings?: Warning[];
  [key: string]: unknown;
}

/** `POST /v1/stream/start` */
export interface StreamStartResponse {
  status: string;
  session_id: string;
  stream_url: string;
  challenges: string[];
  expires_at: string;
  instructions: string;
}

export interface StreamFrameUpdate {
  type: "frame";
  frame_no: number;
  liveness: number;
  identity_cos?: number;
  challenge_index: number;
  challenge_total: number;
  current_challenge?: string;
  warnings: string[];
}

export interface StreamVerdictMessage {
  type: "verdict";
  session_id: string;
  verdict: "approved" | "declined";
  frames: number;
  liveness: number;
  genuine_ratio: number;
  motion_variance: number;
  min_identity_cos: number;
  challenges_completed: boolean;
  reasons: string[];
  warnings: string[];
}

export type StreamMessage = StreamFrameUpdate | StreamVerdictMessage;

/** `POST /v1/aml/screen` */
export interface AmlMatch {
  matched_name: string;
  score: number;
  list: string;
  country?: string | null;
  program?: string | null;
  dob_match?: boolean | null;
}

export interface AmlScreenResponse {
  status: string;
  query: string;
  screened_against: number;
  threshold: number;
  hit: boolean;
  matches: AmlMatch[];
}

/** `POST /v1/kyb/validate` — only the fields you sent come back. */
export interface KybGstin {
  input: string;
  valid: boolean;
  checksum_valid?: boolean;
  state_code?: string | null;
  state?: string | null;
  pan?: string | null;
  entity_number?: string | null;
  expected_check_digit?: string | null;
}

export interface KybPan {
  input: string;
  valid: boolean;
  entity_type_code?: string | null;
  entity_type?: string | null;
}

export interface KybCin {
  input: string;
  valid: boolean;
  listing_status?: string | null;
  listing_code?: string | null;
  industry_code?: string | null;
  state_code?: string | null;
  state?: string | null;
  incorporation_year?: number | null;
  company_class_code?: string | null;
  company_class?: string | null;
  registration_number?: string | null;
}

export interface KybValidateResponse {
  status: string;
  gstin?: KybGstin;
  pan?: KybPan;
  cin?: KybCin;
}

/** `POST /v1/document/mrz` */
export interface MrzResponse {
  status: string;
  valid: boolean;
  format: "TD1" | "TD3";
  document_number: string;
  surname: string;
  given_names: string;
  nationality: string;
  date_of_birth: string;
  sex: string;
  expiry_date: string;
  checks: {
    document_number: boolean;
    date_of_birth: boolean;
    expiry_date: boolean;
    composite: boolean;
  };
}

/** Address block inside `aamva` from `POST /v1/document/id`. */
export interface AamvaAddress {
  street: string | null;
  city: string | null;
  state: string | null;
  postal: string | null;
}

/**
 * AAMVA payload decoded from the back-side PDF417 barcode of a US/CA
 * driver's license / state ID. Elements absent from the barcode are `null`.
 */
export interface AamvaData {
  /** AAMVA standard version (1–10). */
  version: number;
  /** Issuer Identification Number (IIN, 6 digits). */
  issuer_id: string;
  doc_type: "DL" | "ID";
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  /** "YYYY-MM-DD" */
  dob: string | null;
  /** "YYYY-MM-DD" */
  expiry: string | null;
  issue_date: string | null;
  license_number: string | null;
  address: AamvaAddress;
  sex: string | null;
  height: string | null;
  eye_color: string | null;
  country: "USA" | "CAN" | null;
  real_id_compliant: boolean | null;
  [key: string]: unknown;
}

/** Decision inputs derived from the barcode; null = not evaluable. */
export interface DocumentIdChecks {
  barcode_decoded: boolean;
  aamva_parsed: boolean;
  expired: boolean | null;
  underage_18: boolean | null;
  underage_21: boolean | null;
  dates_valid: boolean | null;
}

/**
 * `POST /v1/document/id` — DL/state-ID parsing: back-side PDF417 → AAMVA,
 * optional front-side face detection + document forensics. Warning codes:
 * `DOCUMENT_EXPIRED`, `DOCUMENT_UNDERAGE_18`, `DOCUMENT_UNDERAGE_21`,
 * `BARCODE_UNREADABLE`, `DOCUMENT_SCREEN_REPLAY`, `DOCUMENT_TAMPER`.
 */
export interface DocumentIdResponse {
  status: string;
  /** null when the barcode couldn't be decoded/parsed. */
  aamva: AamvaData | null;
  checks: DocumentIdChecks;
  /** Only when a `front` image was sent; null otherwise. */
  face_found: boolean | null;
  /** Front-side screen-replay/tamper signals; null without a `front` image. */
  forensics: Forensics | null;
  warnings: Warning[];
  [key: string]: unknown;
}

// ---------- Gallery (1:N face search) ----------

/** `POST /v1/face/enroll` */
export interface FaceEnrollResponse {
  status: string;
  enrollment_id: string;
  subject_id: string;
  blocklisted: boolean;
}

export interface GalleryMatch {
  subject_id: string;
  confidence: number;
  cosine_similarity: number;
  blocklisted: boolean;
}

/** `POST /v1/face/search` — best match first. */
export interface FaceSearchResponse {
  status: string;
  request_id: string;
  match_count: number;
  /** True when a blocklisted subject cleared the match threshold. */
  blocklist_hit: boolean;
  matches: GalleryMatch[];
}

// ---------- Revocable templates (ISO/IEC 24745) ----------

/** `POST /v1/template/protect` — store `template`, never a raw embedding. */
export interface TemplateProtectResponse {
  status: string;
  version: number;
  /** Base64 non-invertible template. */
  template: string;
  bits: number;
}

/** `POST /v1/template/verify` — `revoked` when key versions differ. */
export interface TemplateVerifyResponse {
  status: string;
  similarity: number;
  is_match: boolean;
  match_threshold: number;
  revoked: boolean;
}

// ---------- AML ongoing monitoring ----------

export interface AmlSubject {
  id: string;
  name: string;
  dob: string | null;
  /** The caller's own reference for this subject. */
  ref_id: string | null;
  status: "clear" | "hit";
  matches: AmlMatch[];
  last_screened_at: string;
  created_at: string;
}

/** `POST /v1/aml/monitor` */
export interface AmlMonitorCreateResponse {
  status: string;
  screened_against: number;
  subject: AmlSubject;
}

/** `GET /v1/aml/monitor` */
export interface AmlMonitorListResponse {
  status: string;
  subjects: AmlSubject[];
}

/** `DELETE /v1/aml/monitor/{id}` */
export interface DeletedResponse {
  status: string;
  id: string;
  deleted: boolean;
}

// ---------- Validation ----------

/**
 * `POST /v1/validate/identity` and `POST /v1/validate/contact` — only the
 * fields you submitted appear in `fields`. Aadhaar is echoed MASKED only.
 */
export interface ValidateResponse {
  status: string;
  fields: Record<string, unknown>;
}

// ---------- Risk (KYT + device) ----------

export interface Transaction {
  amount: number;
  /** Unix epoch seconds. */
  timestamp: number;
  direction: "credit" | "debit";
  counterparty?: string;
}

/** `POST /v1/txn/monitor` */
export interface TxnMonitorResponse {
  status: string;
  txn_count: number;
  flagged: boolean;
  risk_level: string;
  flags: Array<Record<string, unknown>>;
}

export interface WalletBlocklistEntry {
  address: string;
  chain: string;
  category: string;
  source: string;
}

/** `POST /v1/wallet/screen` */
export interface WalletScreenResponse {
  status: string;
  address: string;
  screened_against: number;
  hit: boolean;
  matches: WalletBlocklistEntry[];
}

/**
 * Device/network signals for `POST /v1/device/analyze`. The SDK does not
 * collect these — your app or capture SDK supplies them; scoring happens
 * server-side. All fields optional; booleans default false.
 */
export interface DeviceSignals {
  os?: string;
  model?: string;
  emulator?: boolean;
  rooted?: boolean;
  app_tampered?: boolean;
  debugger_attached?: boolean;
  screen_sharing?: boolean;
  virtual_camera?: boolean;
  ip?: string;
  vpn?: boolean;
  proxy?: boolean;
  tor?: boolean;
  datacenter?: boolean;
  [key: string]: unknown;
}

export interface DeviceFlag {
  code: string;
  weight: number;
  description: string;
}

/** `POST /v1/device/analyze` */
export interface DeviceAnalyzeResponse {
  status: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  ip_class: string | null;
  flags: DeviceFlag[];
}

// ---------- Workflows (one call, many checks) ----------

export type WorkflowCheck = "liveness" | "face_match" | "mrz" | "aml" | "device";

/** `POST /v1/workflow/run` — one entry in `checks` per requested check. */
export interface WorkflowRunResponse {
  status: string;
  verdict: Verdict;
  checks: Record<string, unknown>;
}

export interface WorkflowConfig {
  checks: WorkflowCheck[];
  thresholds?: Record<string, unknown>;
}

export interface SavedWorkflow {
  id: string;
  name: string;
  config: WorkflowConfig;
  created_at: string;
  updated_at: string;
}

/** `GET /v1/workflows` */
export interface WorkflowsListResponse {
  status: string;
  workflows: SavedWorkflow[];
}

/** `POST /v1/workflows` and `PUT /v1/workflows/{id}` */
export interface SavedWorkflowResponse {
  status: string;
  workflow: SavedWorkflow;
}

// ---------- Hosted verification links ----------

/** The compact result stored on a completed link. */
export interface LinkCompactResult {
  verdict: "approved" | "declined" | "review";
  confidence: number;
  liveness: number;
  /** Warning codes only (not the full `Warning` objects). */
  warnings: string[];
}

export interface VerifyLink {
  token: string;
  url: string;
  label: string | null;
  /** A pending row past its expiry reads as `expired` (computed on read). */
  status: "pending" | "completed" | "expired";
  result: LinkCompactResult | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
}

/** `POST /v1/links` — send `url` to the end user. */
export interface LinkCreateResponse {
  status: string;
  token: string;
  url: string;
  label: string | null;
  expires_at: string;
}

/** `GET /v1/links` */
export interface LinkListResponse {
  status: string;
  links: VerifyLink[];
}

/** `GET /v1/links/{token}` — public; the token is the capability. */
export interface LinkInfoResponse {
  status: "pending" | "completed" | "expired";
  label: string | null;
  expired: boolean;
  expires_at: string;
}

/** `POST /v1/links/{token}/verify` — public; charges the link OWNER. */
export interface LinkVerifyResponse {
  status: string;
  token: string;
  request_id: string;
  result: LinkCompactResult;
}

// ---------- Review queue ----------

export interface ReviewEntry {
  request_id: string;
  /** Hosted-link verifications appear as `link:<token>`. */
  client_ref_id: string;
  created_at: string;
  confidence: number;
  liveness_score: number;
  warnings: Warning[];
  /** Null until a reviewer rules. */
  decision: string | null;
  note: string | null;
}

/** `GET /v1/reviews` */
export interface ReviewsListResponse {
  status: string;
  reviews: ReviewEntry[];
}

/** `POST /v1/reviews/{request_id}/decision` */
export interface ReviewDecisionResponse {
  status: string;
  request_id: string;
  decision: "approved" | "declined";
  note: string | null;
}

// ---------- Tenant settings ----------

/** `GET /v1/settings` and `PUT /v1/settings` */
export interface TenantSettings {
  status: string;
  client_id: string;
  webhook_url: string | null;
  webhook_secret: string | null;
  retain_images: boolean;
  /** 7-90. */
  retention_days: number;
  /** Null when the tenant never saved settings. */
  updated_at: string | null;
}

export interface SettingsUpdate {
  /** http(s) URL; an EMPTY STRING clears the override. */
  webhook_url?: string;
  /** An EMPTY STRING clears the override. */
  webhook_secret?: string;
  retain_images?: boolean;
  /** 7-90. */
  retention_days?: number;
}

// ---------- Response signing ----------

/**
 * `GET /v1/verification-key` — the Ed25519 public key that signs face-match
 * response bodies (detached signature in `X-Neetix-Signature`).
 * `enabled: false` means signing is not configured on this deployment.
 */
export interface VerificationKeyResponse {
  algorithm: string | null;
  public_key_base64?: string;
  signed_header?: string;
  enabled?: boolean;
}

// ---------- Account (DSAR) ----------

/**
 * `GET /v1/account/export` / `POST /v1/account/delete`. The server returns a
 * free-form document (profile, key metadata, ledger, verification-log
 * metadata / a deletion summary); it is deliberately not pinned here.
 */
export interface AccountDataResponse {
  status?: string;
  [key: string]: unknown;
}

// ---------- Billing (prepaid credits) ----------

/** `GET /v1/billing/balance` */
export interface BalanceResponse {
  status: string;
  client_id: string;
  balance: number;
  /** false = postpaid/exempt account (calls don't deduct credits). */
  metered: boolean;
}

export interface LedgerEntry {
  delta: number;
  balance_after: number;
  reason: string;
  ref_id: string | null;
  created_at: string;
}

/** `GET /v1/billing/ledger` */
export interface LedgerResponse {
  status: string;
  client_id: string;
  balance: number;
  entries: LedgerEntry[];
}

export interface PackInfo {
  id: string;
  credits: number;
  display_price: string | null;
}

/** `GET /v1/billing/packs` */
export interface PacksResponse {
  status: string;
  packs: PackInfo[];
}

/** `POST /v1/billing/topup` — redirect the customer to `checkout_url`. */
export interface TopupResponse {
  status: string;
  pack: string;
  credits: number;
  checkout_url: string;
  session_id: string;
}

/**
 * The API's error envelopes. Most endpoints return
 * `{ success, statusCode, message, message_code, error: {type, detail} }`;
 * face-match domain errors use the Digitap-compatible
 * `{ status: "fail", statusCode, error: "<string>", clientRefId, requestId }`.
 */
export interface ApiErrorBody {
  success?: boolean;
  status?: string;
  statusCode?: number;
  message?: string;
  message_code?: string;
  error?: string | { type?: string; detail?: string };
  clientRefId?: string;
  requestId?: string;
}

export interface ClientOptions {
  /** API base, defaults to https://liveliness.neetix.in (no trailing slash). */
  baseUrl?: string;
  /** Bearer API key (from `signup()` or the console). */
  apiKey?: string;
  /** Override fetch (older Node, custom agents). Defaults to global fetch. */
  fetch?: typeof fetch;
}
