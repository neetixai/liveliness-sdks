import 'dart:convert';
import 'package:http/http.dart' as http;

import 'models.dart';

/// Neetix Liveliness API client for Dart/Flutter. Pure Dart (uses `http`), so
/// it works on Flutter mobile, web, and server. Provide captured image bytes
/// from your camera plugin (camera / image_picker) as `List<int>`.
class NeetixClient {
  NeetixClient({required String baseUrl, this.apiKey, http.Client? httpClient})
      : baseUrl = baseUrl.endsWith('/')
            ? baseUrl.substring(0, baseUrl.length - 1)
            : baseUrl,
        _http = httpClient ?? http.Client();

  final String baseUrl;
  final String? apiKey;
  final http.Client _http;

  Map<String, String> get _headers =>
      apiKey != null ? {'Authorization': 'Bearer $apiKey'} : {};

  /// Passive liveliness on a single selfie (JPEG bytes).
  Future<LivenessResponse> liveness(List<int> selfie) async {
    final json = await _multipart('/v1/liveness', {'person': selfie});
    return LivenessResponse.fromJson(json);
  }

  /// Face match + liveliness.
  Future<FaceMatchResponse> faceMatch(
    List<int> selfie,
    List<int> card, {
    Map<String, String> fields = const {},
  }) async {
    final json = await _multipart(
      '/v1/face/face-match',
      {'person': selfie, 'card': card},
      fields: fields,
    );
    return FaceMatchResponse.fromJson(json);
  }

  /// Enroll a user's face for biometric authentication.
  Future<Map<String, dynamic>> authEnroll(String userId, List<int> selfie) =>
      _multipart('/v1/auth/enroll', {'person': selfie}, fields: {'user_id': userId});

  /// Authenticate a returning user by face + liveliness.
  Future<AuthVerifyResponse> authVerify(String userId, List<int> selfie) async {
    final json = await _multipart(
      '/v1/auth/verify',
      {'person': selfie},
      fields: {'user_id': userId},
    );
    return AuthVerifyResponse.fromJson(json);
  }

  /// Parse + validate a passport/ID MRZ.
  Future<MrzResponse> parseMrz(String mrz) async {
    final json = await _postJson('/v1/document/mrz', {'mrz': mrz});
    return MrzResponse.fromJson(json);
  }

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

  Future<Map<String, dynamic>> _postJson(String path, Map<String, dynamic> body) async {
    final res = await _http.post(
      Uri.parse('$baseUrl$path'),
      headers: {..._headers, 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Map<String, dynamic> _decode(http.Response res) {
    final json = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw NeetixApiException(
        res.statusCode,
        (json['message'] as String?) ?? 'HTTP ${res.statusCode}',
      );
    }
    return json;
  }

  void close() => _http.close();
}
