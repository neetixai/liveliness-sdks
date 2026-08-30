/**
 * @neetix/liveliness-react-native
 *
 * React Native wrapper around the Neetix Liveliness API. The API client is
 * shared with the web SDK (`@neetix/liveliness-web`, framework-agnostic —
 * accepts `{ uri }` file parts and RN's fetch). This package adds RN-specific
 * ergonomics: a hook and camera-agnostic capture helpers.
 *
 * Peer deps: react, react-native. Camera capture is BYO (react-native-vision-
 * camera or expo-camera) — pass the captured file `uri` to the client.
 */
import { useCallback, useMemo, useState } from "react";
import {
  NeetixClient,
  type ClientOptions,
  type ImageInput,
  type FaceMatchResponse,
  type LivenessResponse,
  type AuthVerifyResponse,
} from "@neetix/liveliness-web";

export * from "@neetix/liveliness-web";

/** An RN image file part from a camera/library uri. */
export function fileFrom(uri: string, type = "image/jpeg"): ImageInput {
  return { uri, name: "capture.jpg", type };
}

export interface UseLiveliness {
  client: NeetixClient;
  loading: boolean;
  error?: Error;
  liveness: (selfieUri: string) => Promise<LivenessResponse>;
  faceMatch: (
    selfieUri: string,
    cardUri: string,
    fields?: Record<string, string>,
  ) => Promise<FaceMatchResponse>;
  authVerify: (userId: string, selfieUri: string) => Promise<AuthVerifyResponse>;
}

/**
 * Hook that wires a `NeetixClient` and tracks loading/error for the common
 * flows. Uses RN's global fetch.
 */
export function useLiveliness(opts: ClientOptions): UseLiveliness {
  const client = useMemo(() => new NeetixClient(opts), [opts.baseUrl, opts.apiKey]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const run = useCallback(async function <T>(fn: () => Promise<T>): Promise<T> {
    setLoading(true);
    setError(undefined);
    try {
      return await fn();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    client,
    loading,
    error,
    liveness: (uri) => run(() => client.liveness(fileFrom(uri))),
    faceMatch: (selfieUri, cardUri, fields) =>
      run(() => client.faceMatch(fileFrom(selfieUri), fileFrom(cardUri), fields)),
    authVerify: (userId, selfieUri) =>
      run(() => client.authVerify(userId, fileFrom(selfieUri))),
  };
}
