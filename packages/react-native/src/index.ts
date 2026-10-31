/**
 * @neetix/liveliness-react-native
 *
 * React Native wrapper around the Neetix Liveliness API. The transport client
 * is shared with the web SDK (`@neetix/liveliness` — framework-agnostic:
 * accepts `{ uri }` file parts and RN's fetch), so the full method surface
 * (signup, faceMatch, liveness, ageCheck, amlScreen, mrzParse, balance,
 * ledger, sessions, streaming, billing) is available on `client`.
 *
 * This package adds RN ergonomics: `fileFrom(uri)` and a `useLiveliness`
 * hook with loading/error state for the common camera flows. Camera capture
 * is BYO (react-native-vision-camera or expo-camera) — pass the captured
 * file `uri`.
 */
import { useCallback, useMemo, useState } from "react";
import {
  NeetixClient,
  type ClientOptions,
  type ImageInput,
  type AgeCheckResponse,
  type AuthVerifyResponse,
  type DocumentIdResponse,
  type FaceMatchResponse,
  type FaceMatchOptions,
  type LivenessResponse,
} from "@neetix/liveliness";

export * from "@neetix/liveliness";

/** An RN image file part from a camera/library uri. */
export function fileFrom(uri: string, type = "image/jpeg"): ImageInput {
  return { uri, name: "capture.jpg", type };
}

export interface UseLiveliness {
  /** Full API client — every SDK method lives here. */
  client: NeetixClient;
  loading: boolean;
  error?: Error;
  liveness: (selfieUri: string) => Promise<LivenessResponse>;
  ageCheck: (selfieUri: string) => Promise<AgeCheckResponse>;
  faceMatch: (
    selfieUri: string,
    cardUri: string,
    opts?: FaceMatchOptions,
  ) => Promise<FaceMatchResponse>;
  authVerify: (userId: string, selfieUri: string) => Promise<AuthVerifyResponse>;
  /** US/CA DL/state-ID parsing — pass the back (barcode) and/or front uri. */
  documentId: (images: {
    backUri?: string;
    frontUri?: string;
  }) => Promise<DocumentIdResponse>;
}

/**
 * Hook that wires a `NeetixClient` and tracks loading/error for the common
 * camera flows. Uses RN's global fetch.
 */
export function useLiveliness(opts: ClientOptions): UseLiveliness {
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    ageCheck: (uri) => run(() => client.ageCheck(fileFrom(uri))),
    faceMatch: (selfieUri, cardUri, opts) =>
      run(() => client.faceMatch(fileFrom(selfieUri), fileFrom(cardUri), opts)),
    authVerify: (userId, selfieUri) =>
      run(() => client.authVerify(userId, fileFrom(selfieUri))),
    documentId: ({ backUri, frontUri }) =>
      run(() =>
        client.documentId({
          back: backUri ? fileFrom(backUri) : undefined,
          front: frontUri ? fileFrom(frontUri) : undefined,
        }),
      ),
  };
}
