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

  // ---------- Gallery (1:N face search) ----------

  /// Enroll a face in the tenant's 1:N gallery under [subjectId].
  /// [blocklisted] subjects flag future [faceSearch] hits. Cost: 1 credit.
  Future<FaceEnrollResponse> faceEnroll(
    String subjectId,
    List<int> person, {
    bool blocklisted = false,
  }) async {
    final json = await _multipart(
      '/v1/face/enroll',
      {'person': person},
      fields: {
        'subject_id': subjectId,
        if (blocklisted) 'blocklisted': 'true',
      },
    );
    return FaceEnrollResponse.fromJson(json);
  }

  /// Search the tenant gallery for the closest enrolled subjects (best first).
  /// Check `blocklistHit` for dedupe/blocklist flows. Cost: 1 credit.
  Future<FaceSearchResponse> faceSearch(List<int> person, {int topK = 5}) async {
    final json = await _multipart(
      '/v1/face/search',
      {'person': person},
      fields: {'top_k': '$topK'},
    );
    return FaceSearchResponse.fromJson(json);
  }

  // ---------- Revocable templates ----------

  /// Turn a face into a revocable, non-invertible template (ISO/IEC 24745).
  /// Store the returned `template` instead of an embedding — bumping
  /// [keyVersion] revokes every template issued under the old version.
  /// Cost: 1 credit.
  Future<TemplateProtectResponse> templateProtect(
    List<int> person, {
    int keyVersion = 1,
  }) async {
    final json = await _multipart(
      '/v1/template/protect',
      {'person': person},
      fields: {'key_version': '$keyVersion'},
    );
    return TemplateProtectResponse.fromJson(json);
  }

  /// Compare two protected templates. Templates from different key versions
  /// never match (`revoked == true`). Cost: 1 credit.
  Future<TemplateVerifyResponse> templateVerify(
    String templateA,
    String templateB,
  ) async {
    final json = await _postJson('/v1/template/verify', {
      'template_a': templateA,
      'template_b': templateB,
    });
    return TemplateVerifyResponse.fromJson(json);
  }

  // ---------- Validation ----------

  /// Format + checksum validation for Indian identity numbers (Aadhaar via
  /// Verhoeff, PAN, Voter ID, DL). Aadhaar comes back MASKED only.
  /// Cost: 1 credit.
  Future<ValidateResponse> validateIdentity({
    String? aadhaar,
    String? pan,
    String? voter,
    String? dl,
  }) async {
    final json = await _postJson('/v1/validate/identity', {
      if (aadhaar != null) 'aadhaar': aadhaar,
      if (pan != null) 'pan': pan,
      if (voter != null) 'voter': voter,
      if (dl != null) 'dl': dl,
    });
    return ValidateResponse.fromJson(json);
  }

  /// Email validation (disposable / role-based flags) and phone normalization
  /// to E.164. Cost: 1 credit.
  Future<ValidateResponse> validateContact({String? email, String? phone}) async {
    final json = await _postJson('/v1/validate/contact', {
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
    });
    return ValidateResponse.fromJson(json);
  }

  // ---------- Device & IP risk ----------

  /// Score device-integrity and network signals (emulator, root, tampering,
  /// virtual camera, VPN/proxy/Tor/datacenter IP) into a risk score + flags.
  /// Your app collects the signals; this SDK only forwards them.
  /// Cost: 1 credit.
  Future<DeviceAnalyzeResponse> deviceAnalyze(Map<String, dynamic> signals) async {
    final json = await _postJson('/v1/device/analyze', signals);
    return DeviceAnalyzeResponse.fromJson(json);
  }

  // ---------- Workflows ----------

  /// Run several checks in one call and get a single folded verdict. Pass
  /// either inline [checks] or a saved [workflowId] (inline wins).
  /// Supply only the parts the requested checks need. Cost: 3 credits.
  Future<WorkflowRunResponse> workflowRun({
    List<String>? checks,
    String? workflowId,
    List<int>? person,
    List<int>? card,
    String? mrz,
    String? name,
    String? dob,
    Map<String, dynamic>? device,
  }) async {
    final json = await _multipart(
      '/v1/workflow/run',
      {
        if (person != null) 'person': person,
        if (card != null) 'card': card,
      },
      fields: {
        if (checks != null && checks.isNotEmpty) 'checks': checks.join(','),
        if ((checks == null || checks.isEmpty) && workflowId != null)
          'workflow_id': workflowId,
        if (mrz != null) 'mrz': mrz,
        if (name != null) 'name': name,
        if (dob != null) 'dob': dob,
        if (device != null) 'device': jsonEncode(device),
      },
    );
    return WorkflowRunResponse.fromJson(json);
  }

  // ---------- Continuous liveliness (V-CIP) ----------

  /// Start a continuous-liveliness stream session. Open the returned
  /// `streamUrl` as a WebSocket and push JPEG frames; the server answers with
  /// per-frame updates and a final verdict. Cost: 5 credits.
  Future<StreamStartResponse> streamStart() async {
    final json = await _multipart('/v1/stream/start', const {});
    return StreamStartResponse.fromJson(json);
  }

  // ---------- Hosted verification links ----------

  /// Public link status — no auth, the token is the capability (rate limited
  /// per IP, 30/hour). Use it to build your own applicant screen.
  Future<LinkInfoResponse> linkInfo(String token) async {
    final json = await _getJson(
      '/v1/links/${Uri.encodeComponent(token)}',
      auth: false,
    );
    return LinkInfoResponse.fromJson(json);
  }

  /// Complete a link as the end user (public, no auth): selfie + ID run the
  /// standard face-match pipeline and the link OWNER is charged. Single-use —
  /// a duplicate answers 410 `link_gone`; a bad-image 422 keeps the link
  /// pending so the user can retry.
  Future<LinkVerifyResponse> linkVerify(
    String token,
    List<int> person,
    List<int> card,
  ) async {
    final json = await _multipart(
      '/v1/links/${Uri.encodeComponent(token)}/verify',
      {'person': person, 'card': card},
      auth: false,
    );
    return LinkVerifyResponse.fromJson(json);
  }

  // ---------- Response signing ----------

  /// The Ed25519 public key that signs face-match response bodies (detached
  /// signature in the `X-Neetix-Signature` header). Public — no auth.
  Future<VerificationKeyResponse> verificationKey() async =>
      VerificationKeyResponse.fromJson(
        await _getJson('/v1/verification-key', auth: false),
      );

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
    bool auth = true,
  }) async {
    final req = http.MultipartRequest('POST', Uri.parse('$baseUrl$path'));
    if (auth) req.headers.addAll(_headers);
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

  Future<Map<String, dynamic>> _getJson(String path, {bool auth = true}) async {
    final res = await _http.get(
      Uri.parse('$baseUrl$path'),
      headers: auth ? _headers : const {},
    );
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
