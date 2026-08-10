// Neetix Liveliness — Dart quickstart: signup -> age check -> face match.
//
// From a repo clone (this file is mirrored at flutter/example/):
//   cd flutter && dart pub get
//   dart run example/flutter_example.dart selfie.jpg id.jpg
// (or copy this file into a project depending on package:neetix_liveliness)
//
// Set NEETIX_API_KEY to reuse an existing key instead of signing up.
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:neetix_liveliness/neetix_liveliness.dart';

Future<void> main(List<String> args) async {
  if (args.length < 2) {
    stderr.writeln('usage: dart flutter_example.dart <selfie.jpg> <id-card.jpg> [signup-email]');
    exit(1);
  }
  final selfie = await File(args[0]).readAsBytes();
  final card = await File(args[1]).readAsBytes();

  // 1. Get a key: env var, or self-serve signup (500 free credits).
  var apiKey = Platform.environment['NEETIX_API_KEY'];
  if (apiKey == null || apiKey.isEmpty) {
    final email = args.length > 2
        ? args[2]
        : 'sdk-demo+${DateTime.now().millisecondsSinceEpoch}@example.com';
    final s = await NeetixClient().signup(email);
    apiKey = s.apiKey;
    print('signed up $email: ${s.credits} free credits (key shown once — save it!)');
  }

  final nx = NeetixClient(apiKey: apiKey);
  try {
    // 2. Age check (1 credit). New endpoint — tolerate deployments that don't
    // serve it yet (404, or a connection reset while the body uploads).
    try {
      final age = await nx.ageCheck(selfie);
      print('age check: ${age.raw}');
    } on NeetixApiException catch (e) {
      if (e.statusCode == 404) {
        print('age check: /v1/age not available on this deployment yet, skipping');
      } else {
        rethrow;
      }
    } on http.ClientException catch (e) {
      print('age check: transport error (${e.message}) — endpoint likely not rolled out, skipping');
    }

    // 3. Face match + liveliness (2 credits).
    final res = await nx.faceMatch(selfie, card, clientRefId: 'quickstart-1');
    print('verdict: ${res.verdict}');
    print('same face: ${res.isSameFace} (${res.sameFaceConfidence})');
    print('liveness: ${res.livenessScore}');
    for (final w in res.warnings) {
      print('warning [${w.severity}] ${w.code}: ${w.description}');
    }

    // 4. What did that cost?
    final bal = await nx.balance();
    print('credits left: ${bal.balance}');
  } on NeetixApiException catch (e) {
    stderr.writeln('API error ${e.statusCode} (${e.messageCode}): ${e.message}');
    if (e.isInsufficientCredits) {
      stderr.writeln('-> top up via POST /v1/billing/topup');
    }
    exit(2);
  } finally {
    nx.close();
  }
}
