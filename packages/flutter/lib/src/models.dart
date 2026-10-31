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

/// Address block inside [AamvaData].
class AamvaAddress {
  AamvaAddress({this.street, this.city, this.state, this.postal});
  final String? street;
  final String? city;
  final String? state;
  final String? postal;
  factory AamvaAddress.fromJson(Map<String, dynamic> j) => AamvaAddress(
        street: j['street'] as String?,
        city: j['city'] as String?,
        state: j['state'] as String?,
        postal: j['postal'] as String?,
      );
}

/// AAMVA payload decoded from the back-side PDF417 barcode of a US/CA
/// driver's license / state ID (`POST /v1/document/id`). Elements absent
/// from the barcode are null; [raw] carries the full map.
class AamvaData {
  AamvaData({
    this.version,
    this.issuerId,
    this.docType,
    this.firstName,
    this.middleName,
    this.lastName,
    this.dob,
    this.expiry,
    this.issueDate,
    this.licenseNumber,
    required this.address,
    this.sex,
    this.height,
    this.eyeColor,
    this.country,
    this.realIdCompliant,
    required this.raw,
  });

  /// AAMVA standard version (1–10).
  final int? version;

  /// Issuer Identification Number (IIN, 6 digits).
  final String? issuerId;
  final String? docType; // "DL" | "ID"
  final String? firstName;
  final String? middleName;
  final String? lastName;
  final String? dob; // "YYYY-MM-DD"
  final String? expiry; // "YYYY-MM-DD"
  final String? issueDate;
  final String? licenseNumber;
  final AamvaAddress address;
  final String? sex;
  final String? height;
  final String? eyeColor;
  final String? country; // "USA" | "CAN"
  final bool? realIdCompliant;
  final Map<String, dynamic> raw;

  factory AamvaData.fromJson(Map<String, dynamic> j) => AamvaData(
        version: (j['version'] as num?)?.toInt(),
        issuerId: j['issuer_id'] as String?,
        docType: j['doc_type'] as String?,
        firstName: j['first_name'] as String?,
        middleName: j['middle_name'] as String?,
        lastName: j['last_name'] as String?,
        dob: j['dob'] as String?,
        expiry: j['expiry'] as String?,
        issueDate: j['issue_date'] as String?,
        licenseNumber: j['license_number'] as String?,
        address: AamvaAddress.fromJson(
            (j['address'] as Map<String, dynamic>?) ?? const {}),
        sex: j['sex'] as String?,
        height: j['height'] as String?,
        eyeColor: j['eye_color'] as String?,
        country: j['country'] as String?,
        realIdCompliant: j['real_id_compliant'] as bool?,
        raw: j,
      );
}

/// Decision inputs derived from the barcode; null = not evaluable.
class DocumentIdChecks {
  DocumentIdChecks({
    required this.barcodeDecoded,
    required this.aamvaParsed,
    this.expired,
    this.underage18,
    this.underage21,
    this.datesValid,
  });
  final bool barcodeDecoded;
  final bool aamvaParsed;
  final bool? expired;
  final bool? underage18;
  final bool? underage21;
  final bool? datesValid;
  factory DocumentIdChecks.fromJson(Map<String, dynamic> j) => DocumentIdChecks(
        barcodeDecoded: (j['barcode_decoded'] as bool?) ?? false,
        aamvaParsed: (j['aamva_parsed'] as bool?) ?? false,
        expired: j['expired'] as bool?,
        underage18: j['underage_18'] as bool?,
        underage21: j['underage_21'] as bool?,
        datesValid: j['dates_valid'] as bool?,
      );
}

/// `POST /v1/document/id` — DL/state-ID parsing: back-side PDF417 → AAMVA
/// ([aamva] + [checks]), optional front-side face detection ([faceFound]) +
/// document forensics ([forensics]). Warning codes: `DOCUMENT_EXPIRED`,
/// `DOCUMENT_UNDERAGE_18`, `DOCUMENT_UNDERAGE_21`, `BARCODE_UNREADABLE`,
/// `DOCUMENT_SCREEN_REPLAY`, `DOCUMENT_TAMPER`.
class DocumentIdResponse {
  DocumentIdResponse({
    required this.status,
    this.aamva,
    required this.checks,
    this.faceFound,
    this.forensics,
    required this.warnings,
    required this.raw,
  });
  final String status;

  /// Null when the barcode couldn't be decoded/parsed.
  final AamvaData? aamva;
  final DocumentIdChecks checks;

  /// Only when a `front` image was sent; null otherwise.
  final bool? faceFound;

  /// Front-side screen-replay/tamper signals (screen_replay_score,
  /// synthetic_score, …); null without a `front` image.
  final Map<String, dynamic>? forensics;
  final List<ApiWarning> warnings;
  final Map<String, dynamic> raw;

  factory DocumentIdResponse.fromJson(Map<String, dynamic> j) =>
      DocumentIdResponse(
        status: (j['status'] as String?) ?? '',
        aamva: j['aamva'] is Map<String, dynamic>
            ? AamvaData.fromJson(j['aamva'] as Map<String, dynamic>)
            : null,
        checks: DocumentIdChecks.fromJson(
            (j['checks'] as Map<String, dynamic>?) ?? const {}),
        faceFound: j['face_found'] as bool?,
        forensics: j['forensics'] as Map<String, dynamic>?,
        warnings: ((j['warnings'] as List<dynamic>?) ?? const [])
            .map((w) => ApiWarning.fromJson(w as Map<String, dynamic>))
            .toList(),
        raw: j,
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

// ---------- Gallery (1:N face search) ----------

/// `POST /v1/face/enroll`
class FaceEnrollResponse {
  FaceEnrollResponse({
    required this.status,
    required this.enrollmentId,
    required this.subjectId,
    required this.blocklisted,
  });
  final String status;
  final String enrollmentId;
  final String subjectId;
  final bool blocklisted;
  factory FaceEnrollResponse.fromJson(Map<String, dynamic> j) => FaceEnrollResponse(
        status: j['status'] as String,
        enrollmentId: (j['enrollment_id'] as String?) ?? '',
        subjectId: (j['subject_id'] as String?) ?? '',
        blocklisted: (j['blocklisted'] as bool?) ?? false,
      );
}

/// One ranked gallery hit from `POST /v1/face/search`.
class GalleryMatch {
  GalleryMatch({
    required this.subjectId,
    required this.confidence,
    required this.cosineSimilarity,
    required this.blocklisted,
  });
  final String subjectId;
  final double confidence;
  final double cosineSimilarity;
  final bool blocklisted;
  factory GalleryMatch.fromJson(Map<String, dynamic> j) => GalleryMatch(
        subjectId: (j['subject_id'] as String?) ?? '',
        confidence: (j['confidence'] as num?)?.toDouble() ?? 0,
        cosineSimilarity: (j['cosine_similarity'] as num?)?.toDouble() ?? 0,
        blocklisted: (j['blocklisted'] as bool?) ?? false,
      );
}

/// `POST /v1/face/search` — best match first.
class FaceSearchResponse {
  FaceSearchResponse({
    required this.status,
    required this.requestId,
    required this.matchCount,
    required this.blocklistHit,
    required this.matches,
  });
  final String status;
  final String requestId;
  final int matchCount;

  /// True when a blocklisted subject cleared the match threshold.
  final bool blocklistHit;
  final List<GalleryMatch> matches;
  factory FaceSearchResponse.fromJson(Map<String, dynamic> j) => FaceSearchResponse(
        status: j['status'] as String,
        requestId: (j['request_id'] as String?) ?? '',
        matchCount: (j['match_count'] as num?)?.toInt() ?? 0,
        blocklistHit: (j['blocklist_hit'] as bool?) ?? false,
        matches: ((j['matches'] as List<dynamic>?) ?? const [])
            .map((m) => GalleryMatch.fromJson(m as Map<String, dynamic>))
            .toList(),
      );
}

// ---------- Revocable templates (ISO/IEC 24745) ----------

/// `POST /v1/template/protect` — store [template], never a raw embedding.
class TemplateProtectResponse {
  TemplateProtectResponse({
    required this.status,
    required this.version,
    required this.template,
    required this.bits,
  });
  final String status;
  final int version;

  /// Base64 non-invertible template.
  final String template;
  final int bits;
  factory TemplateProtectResponse.fromJson(Map<String, dynamic> j) =>
      TemplateProtectResponse(
        status: j['status'] as String,
        version: (j['version'] as num?)?.toInt() ?? 0,
        template: (j['template'] as String?) ?? '',
        bits: (j['bits'] as num?)?.toInt() ?? 0,
      );
}

/// `POST /v1/template/verify` — [revoked] when the key versions differ.
class TemplateVerifyResponse {
  TemplateVerifyResponse({
    required this.status,
    required this.similarity,
    required this.isMatch,
    required this.matchThreshold,
    required this.revoked,
  });
  final String status;
  final double similarity;
  final bool isMatch;
  final double matchThreshold;
  final bool revoked;
  factory TemplateVerifyResponse.fromJson(Map<String, dynamic> j) =>
      TemplateVerifyResponse(
        status: j['status'] as String,
        similarity: (j['similarity'] as num?)?.toDouble() ?? 0,
        isMatch: (j['is_match'] as bool?) ?? false,
        matchThreshold: (j['match_threshold'] as num?)?.toDouble() ?? 0,
        revoked: (j['revoked'] as bool?) ?? false,
      );
}

// ---------- Validation ----------

/// `POST /v1/validate/identity` and `POST /v1/validate/contact` — only the
/// fields you submitted appear in [fields]. Aadhaar is echoed MASKED only.
class ValidateResponse {
  ValidateResponse({required this.status, required this.fields});
  final String status;
  final Map<String, dynamic> fields;
  factory ValidateResponse.fromJson(Map<String, dynamic> j) => ValidateResponse(
        status: j['status'] as String,
        fields: (j['fields'] as Map<String, dynamic>?) ?? const {},
      );
}

// ---------- Device & IP risk ----------

/// One scored signal from `POST /v1/device/analyze`.
class DeviceFlag {
  DeviceFlag({required this.code, required this.weight, required this.description});
  final String code;
  final double weight;
  final String description;
  factory DeviceFlag.fromJson(Map<String, dynamic> j) => DeviceFlag(
        code: (j['code'] as String?) ?? '',
        weight: (j['weight'] as num?)?.toDouble() ?? 0,
        description: (j['description'] as String?) ?? '',
      );
}

/// `POST /v1/device/analyze`
class DeviceAnalyzeResponse {
  DeviceAnalyzeResponse({
    required this.status,
    required this.riskScore,
    required this.riskLevel,
    required this.ipClass,
    required this.flags,
  });
  final String status;
  final double riskScore;
  final String riskLevel; // "low" | "medium" | "high"
  final String? ipClass;
  final List<DeviceFlag> flags;
  factory DeviceAnalyzeResponse.fromJson(Map<String, dynamic> j) =>
      DeviceAnalyzeResponse(
        status: j['status'] as String,
        riskScore: (j['risk_score'] as num?)?.toDouble() ?? 0,
        riskLevel: (j['risk_level'] as String?) ?? '',
        ipClass: j['ip_class'] as String?,
        flags: ((j['flags'] as List<dynamic>?) ?? const [])
            .map((f) => DeviceFlag.fromJson(f as Map<String, dynamic>))
            .toList(),
      );
}

// ---------- Workflows ----------

/// `POST /v1/workflow/run` — one entry in [checks] per requested check.
class WorkflowRunResponse {
  WorkflowRunResponse({
    required this.status,
    required this.verdict,
    required this.checks,
  });
  final String status;
  final String verdict; // "approved" | "review" | "declined"
  final Map<String, dynamic> checks;
  bool get approved => verdict == 'approved';
  factory WorkflowRunResponse.fromJson(Map<String, dynamic> j) => WorkflowRunResponse(
        status: j['status'] as String,
        verdict: (j['verdict'] as String?) ?? '',
        checks: (j['checks'] as Map<String, dynamic>?) ?? const {},
      );
}

// ---------- Continuous liveliness (V-CIP) ----------

/// `POST /v1/stream/start` — open [streamUrl] as a WebSocket and push frames.
class StreamStartResponse {
  StreamStartResponse({
    required this.status,
    required this.sessionId,
    required this.streamUrl,
    required this.challenges,
    required this.expiresAt,
    required this.instructions,
  });
  final String status;
  final String sessionId;
  final String streamUrl;
  final List<String> challenges;
  final String expiresAt;
  final String instructions;
  factory StreamStartResponse.fromJson(Map<String, dynamic> j) => StreamStartResponse(
        status: j['status'] as String,
        sessionId: (j['session_id'] as String?) ?? '',
        streamUrl: (j['stream_url'] as String?) ?? '',
        challenges: ((j['challenges'] as List<dynamic>?) ?? const [])
            .map((c) => c as String)
            .toList(),
        expiresAt: (j['expires_at'] as String?) ?? '',
        instructions: (j['instructions'] as String?) ?? '',
      );
}

// ---------- Hosted verification links ----------

/// The compact result stored on a completed link.
class LinkCompactResult {
  LinkCompactResult({
    required this.verdict,
    required this.confidence,
    required this.liveness,
    required this.warnings,
  });
  final String verdict; // "approved" | "declined" | "review"
  final double confidence;
  final double liveness;

  /// Warning codes only (not the full [ApiWarning] objects).
  final List<String> warnings;
  factory LinkCompactResult.fromJson(Map<String, dynamic> j) => LinkCompactResult(
        verdict: (j['verdict'] as String?) ?? '',
        confidence: (j['confidence'] as num?)?.toDouble() ?? 0,
        liveness: (j['liveness'] as num?)?.toDouble() ?? 0,
        warnings: ((j['warnings'] as List<dynamic>?) ?? const [])
            .map((w) => w as String)
            .toList(),
      );
}

/// `GET /v1/links/{token}` — public; the token is the capability.
class LinkInfoResponse {
  LinkInfoResponse({
    required this.status,
    required this.label,
    required this.expired,
    required this.expiresAt,
  });
  final String status; // "pending" | "completed" | "expired"
  final String? label;
  final bool expired;
  final String expiresAt;
  factory LinkInfoResponse.fromJson(Map<String, dynamic> j) => LinkInfoResponse(
        status: j['status'] as String,
        label: j['label'] as String?,
        expired: (j['expired'] as bool?) ?? false,
        expiresAt: (j['expires_at'] as String?) ?? '',
      );
}

/// `POST /v1/links/{token}/verify` — public; charges the link OWNER.
class LinkVerifyResponse {
  LinkVerifyResponse({
    required this.status,
    required this.token,
    required this.requestId,
    required this.result,
  });
  final String status;
  final String token;
  final String requestId;
  final LinkCompactResult result;
  factory LinkVerifyResponse.fromJson(Map<String, dynamic> j) => LinkVerifyResponse(
        status: j['status'] as String,
        token: (j['token'] as String?) ?? '',
        requestId: (j['request_id'] as String?) ?? '',
        result: LinkCompactResult.fromJson(
          (j['result'] as Map<String, dynamic>?) ?? const {},
        ),
      );
}

// ---------- Response signing ----------

/// `GET /v1/verification-key` — the Ed25519 key that signs face-match response
/// bodies (detached signature in `X-Neetix-Signature`). [enabled] is false
/// when signing is not configured on the deployment.
class VerificationKeyResponse {
  VerificationKeyResponse({
    required this.algorithm,
    required this.publicKeyBase64,
    required this.signedHeader,
    required this.enabled,
  });
  final String? algorithm;
  final String? publicKeyBase64;
  final String? signedHeader;
  final bool enabled;
  factory VerificationKeyResponse.fromJson(Map<String, dynamic> j) =>
      VerificationKeyResponse(
        algorithm: j['algorithm'] as String?,
        publicKeyBase64: j['public_key_base64'] as String?,
        signedHeader: j['signed_header'] as String?,
        // The key endpoint omits `enabled` when signing IS configured.
        enabled: (j['enabled'] as bool?) ?? (j['algorithm'] != null),
      );
}
