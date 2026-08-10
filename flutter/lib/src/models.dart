// Response models for the Neetix Liveliness API.

/// One entry of the risk-policy `warnings[]` array.
class ApiWarning {
  ApiWarning({required this.code, required this.severity, required this.description});
  final String code;
  final String severity; // "decline" | "review"
  final String description;
  factory ApiWarning.fromJson(Map<String, dynamic> j) => ApiWarning(
        code: j['code'] as String,
        severity: j['severity'] as String,
        description: j['description'] as String,
      );
}

/// `POST /v1/signup` — the `apiKey` is shown ONCE; persist it.
class SignupResponse {
  SignupResponse({
    required this.status,
    required this.apiKey,
    required this.clientId,
    required this.credits,
    required this.message,
  });
  final String status;
  final String apiKey;
  final String clientId;
  final int credits;
  final String message;
  factory SignupResponse.fromJson(Map<String, dynamic> j) => SignupResponse(
        status: j['status'] as String,
        apiKey: j['api_key'] as String,
        clientId: j['client_id'] as String,
        credits: (j['credits'] as num?)?.toInt() ?? 0,
        message: (j['message'] as String?) ?? '',
      );
}

/// `POST /v1/liveness`
class LivenessResponse {
  LivenessResponse({
    required this.status,
    required this.livenessScore,
    required this.livenessStatus,
    required this.faceCount,
    required this.raw,
  });
  final String status; // "Approved" | "Declined" | "Not Finished"
  final double livenessScore;
  final String livenessStatus;
  final int faceCount;
  final Map<String, dynamic> raw;
  bool get approved => status == 'Approved';
  factory LivenessResponse.fromJson(Map<String, dynamic> j) => LivenessResponse(
        status: j['status'] as String,
        livenessScore: (j['liveness_score'] as num).toDouble(),
        livenessStatus: j['liveness_status'] as String,
        faceCount: (j['face_count'] as num?)?.toInt() ?? 0,
        raw: j,
      );
}

/// `POST /v1/age` — selfie age estimation. New endpoint: fields are optional
/// and [raw] carries the full body.
class AgeCheckResponse {
  AgeCheckResponse({
    required this.status,
    this.ageBracket,
    this.estimatedAge,
    this.isAdult,
    required this.raw,
  });
  final String status;
  final String? ageBracket;
  final double? estimatedAge;
  final bool? isAdult;
  final Map<String, dynamic> raw;
  factory AgeCheckResponse.fromJson(Map<String, dynamic> j) => AgeCheckResponse(
        status: (j['status'] as String?) ?? '',
        ageBracket: j['age_bracket'] as String?,
        estimatedAge: (j['age_estimate'] as num?)?.toDouble(),
        isAdult: j['is_adult'] as bool?,
        raw: j,
      );
}

/// `POST /v1/face/face-match`
class FaceMatchResponse {
  FaceMatchResponse({
    required this.status,
    required this.verdict,
    required this.warnings,
    required this.result,
  });
  final String status;
  final String verdict; // "approved" | "review" | "declined"
  final List<ApiWarning> warnings;

  /// The full nested result (is_same_face, same_face_confidence,
  /// liveness_score, face_signals, capture, forensics, …).
  final Map<String, dynamic> result;

  bool get approved => verdict == 'approved';
  bool get isSameFace => result['is_same_face'] == true;
  double get sameFaceConfidence =>
      ((result['same_face_confidence'] as num?) ?? 0).toDouble();
  double get livenessScore => ((result['liveness_score'] as num?) ?? 0).toDouble();

  factory FaceMatchResponse.fromJson(Map<String, dynamic> j) => FaceMatchResponse(
        status: j['status'] as String,
        verdict: j['verdict'] as String,
        warnings: ((j['warnings'] as List<dynamic>?) ?? const [])
            .map((w) => ApiWarning.fromJson(w as Map<String, dynamic>))
            .toList(),
        result: (j['result'] as Map<String, dynamic>?) ?? const {},
      );
}

/// One watchlist hit from `POST /v1/aml/screen`.
class AmlMatch {
  AmlMatch({
    required this.matchedName,
    required this.score,
    required this.list,
    this.country,
    this.program,
    this.dobMatch,
  });
  final String matchedName;
  final double score;
  final String list;
  final String? country;
  final String? program;
  final bool? dobMatch;
  factory AmlMatch.fromJson(Map<String, dynamic> j) => AmlMatch(
        matchedName: j['matched_name'] as String,
        score: (j['score'] as num).toDouble(),
        list: j['list'] as String,
        country: j['country'] as String?,
        program: j['program'] as String?,
        dobMatch: j['dob_match'] as bool?,
      );
}

/// `POST /v1/aml/screen`
class AmlScreenResponse {
  AmlScreenResponse({
    required this.hit,
    required this.screenedAgainst,
    required this.threshold,
    required this.matches,
  });
  final bool hit;
  final int screenedAgainst;
  final double threshold;
  final List<AmlMatch> matches;
  factory AmlScreenResponse.fromJson(Map<String, dynamic> j) => AmlScreenResponse(
        hit: j['hit'] as bool,
        screenedAgainst: (j['screened_against'] as num?)?.toInt() ?? 0,
        threshold: ((j['threshold'] as num?) ?? 0).toDouble(),
        matches: ((j['matches'] as List<dynamic>?) ?? const [])
            .map((m) => AmlMatch.fromJson(m as Map<String, dynamic>))
            .toList(),
      );
}

/// `POST /v1/kyb/validate` — only the identifiers you sent come back;
/// each is a `{ input, valid, …decoded }` map.
class KybValidateResponse {
  KybValidateResponse({this.gstin, this.pan, this.cin, required this.raw});
  final Map<String, dynamic>? gstin;
  final Map<String, dynamic>? pan;
  final Map<String, dynamic>? cin;
  final Map<String, dynamic> raw;
  factory KybValidateResponse.fromJson(Map<String, dynamic> j) =>
      KybValidateResponse(
        gstin: j['gstin'] as Map<String, dynamic>?,
        pan: j['pan'] as Map<String, dynamic>?,
        cin: j['cin'] as Map<String, dynamic>?,
        raw: j,
      );
}

/// `POST /v1/document/mrz`
class MrzResponse {
  MrzResponse({
    required this.valid,
    required this.format,
    required this.documentNumber,
    required this.surname,
    required this.givenNames,
    required this.nationality,
    required this.dateOfBirth,
    required this.expiryDate,
    required this.checks,
  });
  final bool valid;
  final String format; // "TD1" | "TD3"
  final String documentNumber;
  final String surname;
  final String givenNames;
  final String nationality;
  final String dateOfBirth;
  final String expiryDate;
  final Map<String, dynamic> checks;
  factory MrzResponse.fromJson(Map<String, dynamic> j) => MrzResponse(
        valid: j['valid'] as bool,
        format: j['format'] as String,
        documentNumber: j['document_number'] as String,
        surname: j['surname'] as String,
        givenNames: j['given_names'] as String,
        nationality: j['nationality'] as String,
        dateOfBirth: j['date_of_birth'] as String,
        expiryDate: j['expiry_date'] as String,
        checks: (j['checks'] as Map<String, dynamic>?) ?? const {},
      );
}

/// `POST /v1/auth/verify`
class AuthVerifyResponse {
  AuthVerifyResponse({
    required this.authenticated,
    required this.userId,
    required this.matchConfidence,
    required this.livenessScore,
    required this.livenessOk,
  });
  final bool authenticated;
  final String userId;
  final double matchConfidence;
  final double livenessScore;
  final bool livenessOk;
  factory AuthVerifyResponse.fromJson(Map<String, dynamic> j) =>
      AuthVerifyResponse(
        authenticated: j['authenticated'] as bool,
        userId: j['user_id'] as String,
        matchConfidence: (j['match_confidence'] as num).toDouble(),
        livenessScore: (j['liveness_score'] as num).toDouble(),
        livenessOk: j['liveness_ok'] as bool,
      );
}

/// `POST /v1/session/start`
class SessionStartResponse {
  SessionStartResponse({
    required this.sessionId,
    required this.challenges,
    required this.expiresAt,
    required this.instructions,
  });
  final String sessionId;
  final List<String> challenges;
  final String expiresAt;
  final String instructions;
  factory SessionStartResponse.fromJson(Map<String, dynamic> j) =>
      SessionStartResponse(
        sessionId: j['session_id'] as String,
        challenges: ((j['challenges'] as List<dynamic>?) ?? const [])
            .map((c) => c as String)
            .toList(),
        expiresAt: (j['expires_at'] as String?) ?? '',
        instructions: (j['instructions'] as String?) ?? '',
      );
}

/// `GET /v1/billing/balance`
class BalanceResponse {
  BalanceResponse({required this.balance, required this.metered, required this.clientId});
  final int balance;
  final bool metered;
  final String clientId;
  factory BalanceResponse.fromJson(Map<String, dynamic> j) => BalanceResponse(
        balance: (j['balance'] as num).toInt(),
        metered: j['metered'] as bool,
        clientId: (j['client_id'] as String?) ?? '',
      );
}

/// One row of `GET /v1/billing/ledger`.
class LedgerEntry {
  LedgerEntry({
    required this.delta,
    required this.balanceAfter,
    required this.reason,
    this.refId,
    required this.createdAt,
  });
  final int delta;
  final int balanceAfter;
  final String reason;
  final String? refId;
  final String createdAt;
  factory LedgerEntry.fromJson(Map<String, dynamic> j) => LedgerEntry(
        delta: (j['delta'] as num).toInt(),
        balanceAfter: (j['balance_after'] as num).toInt(),
        reason: j['reason'] as String,
        refId: j['ref_id'] as String?,
        createdAt: (j['created_at'] as String?) ?? '',
      );
}

/// `GET /v1/billing/ledger`
class LedgerResponse {
  LedgerResponse({required this.balance, required this.entries});
  final int balance;
  final List<LedgerEntry> entries;
  factory LedgerResponse.fromJson(Map<String, dynamic> j) => LedgerResponse(
        balance: (j['balance'] as num).toInt(),
        entries: ((j['entries'] as List<dynamic>?) ?? const [])
            .map((e) => LedgerEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// API error: HTTP [statusCode] plus the stable machine-readable
/// [messageCode] from the error envelope (e.g. `unauthorized`,
/// `no_face_detected`, `insufficient_credits`).
class NeetixApiException implements Exception {
  NeetixApiException(this.statusCode, this.message, {this.messageCode, this.body});
  final int statusCode;
  final String message;
  final String? messageCode;
  final Map<String, dynamic>? body;

  /// True when the prepaid balance is exhausted (HTTP 402).
  bool get isInsufficientCredits =>
      statusCode == 402 || messageCode == 'insufficient_credits';

  @override
  String toString() =>
      'NeetixApiException($statusCode${messageCode != null ? ' $messageCode' : ''}): $message';
}
