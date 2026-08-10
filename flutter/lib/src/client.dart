import 'dart:convert';
import 'package:http/http.dart' as http;

import 'models.dart';

const String kDefaultBaseUrl = 'https://liveliness.neetix.in';

/// Neetix Liveliness API client for Dart/Flutter. Pure Dart (uses `http`),
/// so it works on Flutter mobile, web, desktop, and server-side Dart.
/// Provide captured image bytes from your camera plugin
/// (`camera` / `image_picker`) as `List<int>` JPEG bytes.
///
/// Every billable call deducts prepaid credits (face-match 2, stream 5,
/// KYB 2, document-id 2, others 1). An exhausted balance throws [NeetixApiException] with
/// `statusCode == 402` / `messageCode == 'insufficient_credits'`.
class NeetixClient {
  NeetixClient({String baseUrl = kDefaultBaseUrl, this.apiKey, http.Client? httpClient})
      : baseUrl = baseUrl.endsWith('/')
            ? baseUrl.substring(0, baseUrl.length - 1)
            : baseUrl,
        _http = httpClient ?? http.Client();

  final String baseUrl;
  final String? apiKey;
  final http.Client _http;

  Map<String, String> get _headers =>
      apiKey != null ? {'Authorization': 'Bearer $apiKey'} : {};

  // ---------- Account ----------

  /// Self-serve trial signup — no auth needed. Grants 500 free credits.
  /// The returned `apiKey` is shown ONCE; persist it.
  Future<SignupResponse> signup(String email) async {
    final json = await _postJson('/v1/signup', {'email': email}, auth: false);
    return SignupResponse.fromJson(json);
  }

  // ---------- Face & liveliness ----------

  /// Passive liveliness on a single selfie (JPEG bytes). Cost: 1 credit.
  Future<LivenessResponse> liveness(List<int> person) async {
    final json = await _multipart('/v1/liveness', {'person': person});
    return LivenessResponse.fromJson(json);
  }

  /// Face match + liveliness (selfie vs ID/reference). Cost: 2 credits.
  /// Inspect `verdict` (`approved | review | declined`) and `warnings`.
  Future<FaceMatchResponse> faceMatch(
    List<int> person,
    List<int> card, {
    String? clientRefId,
    String? customerId,
    Map<String, String> extraFields = const {},
  }) async {
    final fields = <String, String>{
      if (clientRefId != null) 'client_ref_id': clientRefId,
      if (customerId != null) 'customer_id': customerId,
      ...extraFields,
    };
    final json = await _multipart(
      '/v1/face/face-match',
      {'person': person, 'card': card},
      fields: fields,
    );
    return FaceMatchResponse.fromJson(json);
  }

  /// Selfie age estimation. Cost: 1 credit.
  /// New endpoint — older deployments return 404 (`messageCode: not_found`).
  Future<AgeCheckResponse> ageCheck(List<int> person) async {
    final json = await _multipart('/v1/age', {'person': person});
    return AgeCheckResponse.fromJson(json);
  }

  // ---------- Active-challenge liveliness ----------

  /// Start an active-challenge liveliness session.
  Future<SessionStartResponse> sessionStart() async {
    final json = await _multipart('/v1/session/start', const {});
    return SessionStartResponse.fromJson(json);
  }

  /// Submit the ordered challenge frames (`frame_0, frame_1, …`).
  Future<Map<String, dynamic>> sessionVerify(
    String sessionId,
    List<List<int>> frames,
  ) {
    final images = <String, List<int>>{
      for (var i = 0; i < frames.length; i++) 'frame_$i': frames[i],
    };
    return _multipart('/v1/session/${Uri.encodeComponent(sessionId)}/verify', images);
  }

  // ---------- Biometric auth ----------

  /// Enroll a user's face for biometric authentication.
  Future<Map<String, dynamic>> authEnroll(String userId, List<int> person) =>
      _multipart('/v1/auth/enroll', {'person': person}, fields: {'user_id': userId});

  /// Authenticate a returning user by face + liveliness.
  Future<AuthVerifyResponse> authVerify(String userId, List<int> person) async {
    final json = await _multipart(
      '/v1/auth/verify',
      {'person': person},
      fields: {'user_id': userId},
    );
    return AuthVerifyResponse.fromJson(json);
  }

  // ---------- Screening & documents ----------

  /// AML / sanctions & PEP screening by name (+ optional `dob` "YYYY-MM-DD").
  /// Cost: 1 credit.
  Future<AmlScreenResponse> amlScreen(String name, {String? dob, double? threshold}) async {
    final json = await _postJson('/v1/aml/screen', {
      'name': name,
      if (dob != null) 'dob': dob,
      if (threshold != null) 'threshold': threshold,
    });
    return AmlScreenResponse.fromJson(json);
  }

  /// KYB: validate Indian business identifiers (GSTIN / PAN / CIN). Cost: 2 credits.
  Future<KybValidateResponse> kybValidate({String? gstin, String? pan, String? cin}) async {
    final json = await _postJson('/v1/kyb/validate', {
      if (gstin != null) 'gstin': gstin,
      if (pan != null) 'pan': pan,
      if (cin != null) 'cin': cin,
    });
    return KybValidateResponse.fromJson(json);
  }

  /// Parse + checksum-validate a passport/ID MRZ (2 or 3 lines). Cost: 1 credit.
  Future<MrzResponse> mrzParse(String mrz) async {
    final json = await _postJson('/v1/document/mrz', {'mrz': mrz});
    return MrzResponse.fromJson(json);
  }

  /// US/CA driver's-license / state-ID parsing. [back] (the side with the
  /// PDF417 barcode) is decoded and AAMVA-parsed into `aamva` + `checks`;
  /// [front] (portrait side) runs face detection (`faceFound`) + document
  /// forensics. Send at least one image (400 otherwise). A back image with
  /// no readable barcode is NOT an error: you get a 200 with
  /// `checks.barcodeDecoded == false` and a `BARCODE_UNREADABLE` warning.
  /// Cost: 2 credits.
  Future<DocumentIdResponse> documentId({List<int>? back, List<int>? front}) async {
    final json = await _multipart('/v1/document/id', {
      if (back != null) 'back': back,
      if (front != null) 'front': front,
    });
    return DocumentIdResponse.fromJson(json);
  }

  // ---------- Billing (prepaid credits) ----------

  /// Current prepaid-credit balance.
  Future<BalanceResponse> balance() async =>
      BalanceResponse.fromJson(await _getJson('/v1/billing/balance'));

  /// Credit ledger, newest first.
  Future<LedgerResponse> ledger({int limit = 50}) async =>
      LedgerResponse.fromJson(await _getJson('/v1/billing/ledger?limit=$limit'));

  /// Purchasable credit packs.
  Future<Map<String, dynamic>> packs() => _getJson('/v1/billing/packs');

  /// Create a hosted-checkout top-up; open `checkout_url` from the result.
  Future<Map<String, dynamic>> topup(String pack, {String? email}) =>
      _postJson('/v1/billing/topup', {
        'pack': pack,
        if (email != null) 'email': email,
      });

  // ---------- Transport ----------

  Future<Map<String, dynamic>> _multipart(
    String path,
    Map<String, List<int>> images, {
    Map<String, String> fields = const {},
  }) async {
    final req = http.MultipartRequest('POST', Uri.parse('$baseUrl$path'));
    req.headers.addAll(_headers);
    req.fields.addAll(fields);
    images.forEach((name, bytes) {
      req.files.add(http.MultipartFile.fromBytes(name, bytes, filename: 'image.jpg'));
    });
    final streamed = await _http.send(req);
    final res = await http.Response.fromStream(streamed);
    return _decode(res);
  }

  Future<Map<String, dynamic>> _postJson(
    String path,
    Map<String, dynamic> body, {
    bool auth = true,
  }) async {
    final res = await _http.post(
      Uri.parse('$baseUrl$path'),
      headers: {if (auth) ..._headers, 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> _getJson(String path) async {
    final res = await _http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    return _decode(res);
  }

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> json;
    try {
      json = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw NeetixApiException(
        res.statusCode,
        'Non-JSON response: ${res.body.length > 200 ? res.body.substring(0, 200) : res.body}',
      );
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      // Standard envelope carries `message` + `message_code`; face-match
      // domain errors carry a Digitap-style `error` string instead.
      final message = (json['message'] as String?) ??
          (json['error'] is String ? json['error'] as String : null) ??
          'HTTP ${res.statusCode}';
      throw NeetixApiException(
        res.statusCode,
        message,
        messageCode: json['message_code'] as String?,
        body: json,
      );
    }
    return json;
  }

  void close() => _http.close();
}
