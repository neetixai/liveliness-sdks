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
