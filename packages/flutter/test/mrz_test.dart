import 'dart:convert';
import 'package:neetix_liveliness/neetix_liveliness.dart';
import 'package:test/test.dart';

void main() {
  test('decodes an MRZ response', () {
    final j = jsonDecode('''
      { "status": "success", "valid": true, "format": "TD3",
        "document_number": "L898902C3", "surname": "ERIKSSON",
        "given_names": "ANNA MARIA", "nationality": "UTO",
        "date_of_birth": "740812", "sex": "F", "expiry_date": "120415",
        "checks": { "document_number": true, "date_of_birth": true,
                    "expiry_date": true, "composite": true } }
    ''') as Map<String, dynamic>;
    final r = MrzResponse.fromJson(j);
    expect(r.valid, isTrue);
    expect(r.surname, 'ERIKSSON');
    expect(r.givenNames, 'ANNA MARIA');
    expect(r.checks['composite'], isTrue);
  });

  test('decodes a liveness response', () {
    final j = jsonDecode(
      '{ "status": "Approved", "liveness_score": 88.43, "liveness_status": "genuine", "face_count": 1 }',
    ) as Map<String, dynamic>;
    final r = LivenessResponse.fromJson(j);
    expect(r.approved, isTrue);
    expect(r.livenessScore, closeTo(88.43, 0.001));
  });
}
