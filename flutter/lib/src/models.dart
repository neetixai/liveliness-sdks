/// Response models for the Neetix Liveliness API.

class LivenessResponse {
  LivenessResponse({
    required this.status,
    required this.livenessScore,
    required this.livenessStatus,
    required this.faceCount,
  });

  final String status;
  final double livenessScore;
  final String livenessStatus;
  final int faceCount;

  factory LivenessResponse.fromJson(Map<String, dynamic> j) => LivenessResponse(
        status: j['status'] as String,
        livenessScore: (j['liveness_score'] as num).toDouble(),
        livenessStatus: j['liveness_status'] as String,
        faceCount: j['face_count'] as int,
      );

  bool get approved => status == 'Approved';
}

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

class Warning {
  Warning({required this.code, required this.severity, required this.description});
  final String code;
  final String severity;
  final String description;
  factory Warning.fromJson(Map<String, dynamic> j) => Warning(
        code: j['code'] as String,
        severity: j['severity'] as String,
        description: j['description'] as String,
      );
}

class FaceMatchResponse {
  FaceMatchResponse({
    required this.status,
    required this.verdict,
    required this.warnings,
    required this.result,
  });

  final String status;
  final String verdict;
  final List<Warning> warnings;
  final Map<String, dynamic> result;

  factory FaceMatchResponse.fromJson(Map<String, dynamic> j) => FaceMatchResponse(
        status: j['status'] as String,
        verdict: j['verdict'] as String,
        warnings: (j['warnings'] as List<dynamic>)
            .map((w) => Warning.fromJson(w as Map<String, dynamic>))
            .toList(),
        result: j['result'] as Map<String, dynamic>,
      );

  bool get approved => verdict == 'approved';
}

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
  final String format;
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
        checks: j['checks'] as Map<String, dynamic>,
      );
}

class NeetixApiException implements Exception {
  NeetixApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;
  @override
  String toString() => 'NeetixApiException($statusCode): $message';
}
