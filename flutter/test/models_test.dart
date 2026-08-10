import 'package:neetix_liveliness/neetix_liveliness.dart';
import 'package:test/test.dart';

void main() {
  test('FaceMatchResponse parses verdict, warnings and result', () {
    final res = FaceMatchResponse.fromJson({
      'status': 'success',
      'verdict': 'review',
      'warnings': [
        {
          'code': 'LOW_LIVENESS_SCORE',
          'severity': 'review',
          'description': 'liveness below threshold',
        }
      ],
      'result': {
        'is_same_face': true,
        'same_face_confidence': 0.93,
        'liveness_score': 0.41,
      },
    });
    expect(res.approved, isFalse);
    expect(res.isSameFace, isTrue);
    expect(res.sameFaceConfidence, closeTo(0.93, 1e-9));
    expect(res.warnings.single.code, 'LOW_LIVENESS_SCORE');
  });

  test('AmlScreenResponse parses hits', () {
    final res = AmlScreenResponse.fromJson({
      'status': 'success',
      'hit': true,
      'screened_against': 18000,
      'threshold': 0.85,
      'matches': [
        {
          'matched_name': 'JOHN DOE',
          'score': 0.91,
          'list': 'OFAC-SDN',
          'program': 'SDGT',
          'dob_match': null,
        }
      ],
    });
    expect(res.hit, isTrue);
    expect(res.matches.single.list, 'OFAC-SDN');
  });

  test('NeetixApiException surfaces status + message_code', () {
    final e = NeetixApiException(402, 'insufficient credits',
        messageCode: 'insufficient_credits');
    expect(e.isInsufficientCredits, isTrue);
    expect(e.toString(), contains('insufficient_credits'));
  });

  test('MrzResponse parses checks', () {
    final res = MrzResponse.fromJson({
      'status': 'success',
      'valid': true,
      'format': 'TD3',
      'document_number': 'L898902C3',
      'surname': 'ERIKSSON',
      'given_names': 'ANNA MARIA',
      'nationality': 'UTO',
      'date_of_birth': '1974-08-12',
      'expiry_date': '2012-04-15',
      'checks': {
        'document_number': true,
        'date_of_birth': true,
        'expiry_date': true,
        'composite': true,
      },
    });
    expect(res.valid, isTrue);
    expect(res.checks['composite'], isTrue);
  });
}
