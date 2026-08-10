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
