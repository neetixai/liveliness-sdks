# neetix_liveliness

Neetix Liveliness API client for Dart and Flutter: face match, passive/active
liveliness (PAD), biometric authentication and passport/ID MRZ parsing.

Pure-Dart, transport-only client — capture image bytes with your camera
plugin of choice (`camera` / `image_picker`) and pass them in.

```yaml
dependencies:
  neetix_liveliness: ^0.1.0
```

## Quick start

```dart
import 'package:neetix_liveliness/neetix_liveliness.dart';

final client = NeetixClient(baseUrl: 'https://api.neetix.in', apiKey: key);

// jpegBytes from the `camera` plugin (XFile.readAsBytes()).
final live = await client.liveness(jpegBytes);

final match = await client.faceMatch(selfieBytes, cardBytes);

final mrz = await client.parseMrz(mrzText);
```

## API surface

- `liveness(bytes)` — passive presentation-attack detection on a selfie
- `faceMatch(selfie, card, {fields})` — 1:1 match + liveliness + signals
- `authEnroll(userId, selfie)` / `authVerify(userId, selfie)` — biometric login
- `parseMrz(text)` — passport / ID MRZ parse + checksum validation

See the [SDK overview](https://github.com/neetixai/liveliness-sdks) for the
other platforms (Web, React Native, iOS, Android).

## License

Apache-2.0
