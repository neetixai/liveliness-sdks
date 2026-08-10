/**
 * Browser camera helpers (getUserMedia). Import only in a DOM environment;
 * the API client itself has no DOM dependency.
 */

export interface CameraHandle {
  readonly video: HTMLVideoElement;
  /** Capture the current frame as a JPEG Blob. */
  capture(quality?: number): Promise<Blob>;
  stop(): void;
}

/** Open the front camera and stream it into `video`. */
export async function openCamera(
  video: HTMLVideoElement,
  constraints: MediaStreamConstraints = { video: { facingMode: "user" } },
): Promise<CameraHandle> {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play();

  return {
    video,
    async capture(quality = 0.92): Promise<Blob> {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2d canvas context unavailable");
      ctx.drawImage(video, 0, 0);
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          quality,
        );
      });
    },
    stop() {
      for (const track of stream.getTracks()) track.stop();
      video.srcObject = null;
    },
  };
}
