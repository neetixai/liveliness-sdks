# @neetix/liveliness-react-native

React Native SDK for the Neetix Liveliness API (face match, passive/active
liveliness, biometric auth, MRZ). Thin RN ergonomics — a `useLiveliness`
hook and `{ uri }` file helpers — over the shared, framework-agnostic
[`@neetix/liveliness-web`](https://www.npmjs.com/package/@neetix/liveliness-web)
client, which it re-exports in full.

```bash
npm install @neetix/liveliness-react-native
```

Peer deps: `react >= 17`, `react-native >= 0.68`. Camera capture is BYO
(react-native-vision-camera or expo-camera) — pass the captured file `uri`.

## Quick start

```ts
import { useLiveliness } from "@neetix/liveliness-react-native";

const nx = useLiveliness({ baseUrl: "https://api.neetix.in", apiKey });
const res = await nx.liveness(photoUri); // uri from vision-camera / expo-camera
```

Lower-level, without the hook:

```ts
import { NeetixClient, fileFrom } from "@neetix/liveliness-react-native";

const client = new NeetixClient({ baseUrl, apiKey });
const res = await client.faceMatch(fileFrom(selfieUri), fileFrom(cardUri));
```

See the [SDK overview](https://github.com/neetixai/liveliness-sdks) for the
other platforms (Web, iOS, Android, Flutter).

## License

Apache-2.0
