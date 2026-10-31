// Parsing tests for the models added alongside the gallery, template,
// validation, risk, workflow, stream and hosted-link endpoints. These catch
// the failure that actually happens: a JSON key renamed or mistyped.

import 'package:neetix_liveliness/neetix_liveliness.dart';
import 'package:test/test.dart';

void main() {
  test('FaceSearchResponse parses ranked matches and the blocklist flag', () {
    final res = FaceSearchResponse.fromJson({
      'status': 'success',
      'request_id': 'r1',
      'match_count': 2,
      'blocklist_hit': true,
      'matches': [
        {
          'subject_id': 's1',
          'confidence': 91.2,
          'cosine_similarity': 0.71,
          'blocklisted': true,
        },
        {'subject_id': 's2', 'confidence': 40.0},
      ],
    });
    expect(res.blocklistHit, isTrue);
    expect(res.matchCount, 2);
    expect(res.matches.first.subjectId, 's1');
    expect(res.matches.first.cosineSimilarity, 0.71);
    // Absent optional fields fall back instead of throwing.
    expect(res.matches.last.blocklisted, isFalse);
  });

  test('FaceEnrollResponse parses the enrollment id', () {
    final res = FaceEnrollResponse.fromJson({
      'status': 'success',
      'enrollment_id': 'e1',
      'subject_id': 's1',
      'blocklisted': false,
    });
    expect(res.enrollmentId, 'e1');
    expect(res.blocklisted, isFalse);
  });

  test('template responses parse similarity, threshold and revocation', () {
    final protect = TemplateProtectResponse.fromJson({
      'status': 'success',
      'version': 2,
      'template': 'BASE64',
      'bits': 256,
    });
    expect(protect.version, 2);
    expect(protect.template, 'BASE64');

    final verify = TemplateVerifyResponse.fromJson({
      'status': 'success',
      'similarity': 0.758,
      'is_match': true,
      'match_threshold': 0.6,
      'revoked': false,
    });
    expect(verify.isMatch, isTrue);
    expect(verify.similarity, 0.758);
    expect(verify.revoked, isFalse);
  });

  test('ValidateResponse keeps the open-ended per-field payload', () {
    final res = ValidateResponse.fromJson({
      'status': 'success',
      'fields': {
        'aadhaar': {'valid': true, 'masked': 'XXXXXXXX1234'},
        'pan': {'valid': false},
      },
    });
    final aadhaar = res.fields['aadhaar'] as Map<String, dynamic>;
    expect(aadhaar['masked'], 'XXXXXXXX1234');
    expect((res.fields['pan'] as Map<String, dynamic>)['valid'], isFalse);
  });

  test('DeviceAnalyzeResponse parses score, level and weighted flags', () {
    final res = DeviceAnalyzeResponse.fromJson({
      'status': 'success',
      'risk_score': 72.5,
      'risk_level': 'high',
      'ip_class': 'datacenter',
      'flags': [
        {'code': 'VIRTUAL_CAMERA', 'weight': 30, 'description': 'virtual camera'},
      ],
    });
    expect(res.riskLevel, 'high');
    expect(res.ipClass, 'datacenter');
    expect(res.flags.single.code, 'VIRTUAL_CAMERA');
    expect(res.flags.single.weight, 30);
  });

  test('DeviceAnalyzeResponse tolerates a null ip_class', () {
    final res = DeviceAnalyzeResponse.fromJson({
      'status': 'success',
      'risk_score': 0,
      'risk_level': 'low',
      'ip_class': null,
      'flags': <dynamic>[],
    });
    expect(res.ipClass, isNull);
    expect(res.flags, isEmpty);
  });

  test('WorkflowRunResponse exposes the folded verdict and per-check map', () {
    final res = WorkflowRunResponse.fromJson({
      'status': 'success',
      'verdict': 'review',
      'checks': {
        'liveness': {'score': 81.2},
        'aml': {'hit': false},
      },
    });
    expect(res.approved, isFalse);
    expect(res.verdict, 'review');
    expect((res.checks['liveness'] as Map<String, dynamic>)['score'], 81.2);
  });

  test('StreamStartResponse parses the WebSocket URL and challenge script', () {
    final res = StreamStartResponse.fromJson({
      'status': 'success',
      'session_id': 's',
      'stream_url': 'wss://liveliness.neetix.in/v1/stream/s',
      'challenges': ['center', 'turn_left'],
      'expires_at': '2026-11-01T00:00:00Z',
      'instructions': 'hold still',
    });
    expect(res.streamUrl.startsWith('wss://'), isTrue);
    expect(res.challenges, ['center', 'turn_left']);
  });

  test('hosted-link responses parse status and the compact result', () {
    final info = LinkInfoResponse.fromJson({
      'status': 'pending',
      'label': 'KYC for Asha',
      'expired': false,
      'expires_at': '2026-11-03T00:00:00Z',
    });
    expect(info.status, 'pending');
    expect(info.label, 'KYC for Asha');

    final done = LinkVerifyResponse.fromJson({
      'status': 'success',
      'token': 't',
      'request_id': 'r',
      'result': {
        'verdict': 'approved',
        'confidence': 98.9,
        'liveness': 95.0,
        'warnings': ['EDITED_IMAGE'],
      },
    });
    expect(done.result.verdict, 'approved');
    expect(done.result.warnings, ['EDITED_IMAGE']);
  });

  test('VerificationKeyResponse infers enabled when the key is present', () {
    final on = VerificationKeyResponse.fromJson({
      'algorithm': 'ed25519',
      'public_key_base64': 'AAAA',
      'signed_header': 'X-Neetix-Signature',
    });
    expect(on.enabled, isTrue);
    expect(on.publicKeyBase64, 'AAAA');

    // Signing switched off: the server says so explicitly.
    final off = VerificationKeyResponse.fromJson({
      'algorithm': null,
      'enabled': false,
    });
    expect(off.enabled, isFalse);
  });
}
