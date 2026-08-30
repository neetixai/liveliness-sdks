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

  test('DocumentIdResponse parses the aamva JSON shape', () {
    final res = DocumentIdResponse.fromJson({
      'status': 'success',
      'aamva': {
        'version': 8,
        'issuer_id': '636014',
        'doc_type': 'DL',
        'first_name': 'JANE',
        'middle_name': null,
        'last_name': 'DOE',
        'dob': '1986-06-06',
        'expiry': '2031-06-06',
        'issue_date': '2023-06-06',
        'license_number': 'D1234562',
        'address': {
          'street': '2570 24TH STREET',
          'city': 'SACRAMENTO',
          'state': 'CA',
          'postal': '95818',
        },
        'sex': 'F',
        'height': null,
        'eye_color': 'BRO',
        'country': 'USA',
        'real_id_compliant': true,
      },
      'checks': {
        'barcode_decoded': true,
        'aamva_parsed': true,
        'expired': false,
        'underage_18': false,
        'underage_21': false,
        'dates_valid': true,
      },
      'face_found': null,
      'forensics': null,
      'warnings': [],
    });
    final a = res.aamva!;
    expect(a.version, 8);
    expect(a.issuerId, '636014');
    expect(a.docType, 'DL');
    expect(a.firstName, 'JANE');
    expect(a.middleName, isNull);
    expect(a.lastName, 'DOE');
    expect(a.dob, '1986-06-06');
    expect(a.expiry, '2031-06-06');
    expect(a.licenseNumber, 'D1234562');
    expect(a.address.city, 'SACRAMENTO');
    expect(a.address.state, 'CA');
    expect(a.country, 'USA');
    expect(a.realIdCompliant, isTrue);
    expect(res.checks.barcodeDecoded, isTrue);
    expect(res.checks.aamvaParsed, isTrue);
    expect(res.checks.expired, isFalse);
    expect(res.faceFound, isNull);
    expect(res.forensics, isNull);
    expect(res.warnings, isEmpty);
  });

  test('DocumentIdResponse handles an unreadable barcode (no aamva)', () {
    final res = DocumentIdResponse.fromJson({
      'status': 'success',
      'aamva': null,
      'checks': {
        'barcode_decoded': false,
        'aamva_parsed': false,
        'expired': null,
        'underage_18': null,
        'underage_21': null,
        'dates_valid': null,
      },
      'face_found': true,
      'forensics': {'screen_replay_score': 0.12, 'synthetic_score': 0.03},
      'warnings': [
        {
          'code': 'BARCODE_UNREADABLE',
          'severity': 'review',
          'description': 'back image given but no PDF417 decoded',
        }
      ],
    });
    expect(res.aamva, isNull);
    expect(res.checks.barcodeDecoded, isFalse);
    expect(res.checks.expired, isNull);
    expect(res.faceFound, isTrue);
    expect(res.forensics!['screen_replay_score'], closeTo(0.12, 1e-9));
    expect(res.warnings.single.code, 'BARCODE_UNREADABLE');
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
