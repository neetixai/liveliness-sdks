// Wire types for the Neetix Liveliness API. Mirrors the server response shapes.

export type Verdict = "approved" | "review" | "declined";

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

export interface FaceMatchResponse {
  status: string;
  statusCode: number;
  verdict: Verdict;
  warnings: Warning[];
  clientRefId: string;
  requestId: string;
  result: FaceMatchResult;
}

export interface LivenessResponse {
  status: "Approved" | "Declined" | "Not Finished";
  liveness_score: number;
  liveness_status: string;
  liveness_evaluated: boolean;
  face_count: number;
  threshold: number;
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

export interface SessionStartResponse {
  status: string;
  session_id: string;
  challenges: string[];
  expires_at: string;
  instructions: string;
}

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

export interface ClientOptions {
  /** API base, e.g. https://api.neetix.in (no trailing slash). */
  baseUrl: string;
  /** Bearer API key. */
  apiKey?: string;
  /** Override fetch (Node/RN). Defaults to global fetch. */
  fetch?: typeof fetch;
}
