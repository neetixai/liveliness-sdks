// Input normalization: turn ImageData | Canvas | Video into ImageData, drawing
// through a single reused offscreen canvas so the hot path allocates nothing.

import type { EdgeImage } from "./types";
import { EdgeError } from "./types";

export class ImageNormalizer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  /** Normalize any accepted source to `ImageData` (RGBA, original size). */
  toImageData(image: EdgeImage): ImageData {
    if (isImageData(image)) return image;

    let sw: number;
    let sh: number;
    if (isVideo(image)) {
      sw = image.videoWidth;
      sh = image.videoHeight;
    } else {
      // HTMLCanvasElement
      sw = image.width;
      sh = image.height;
    }
    if (sw < 1 || sh < 1) {
      throw new EdgeError("image has zero dimensions (video not ready or empty canvas)");
    }

    const ctx = this.context(sw, sh);
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(image as CanvasImageSource, 0, 0, sw, sh);
    return ctx.getImageData(0, 0, sw, sh);
  }

  private context(w: number, h: number): CanvasRenderingContext2D {
    if (!this.canvas) {
      if (typeof document === "undefined") {
        throw new EdgeError(
          "no DOM available: pass an ImageData directly in non-browser environments",
        );
      }
      this.canvas = document.createElement("canvas");
    }
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    if (!this.ctx) {
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
      if (!this.ctx) throw new EdgeError("2d canvas context unavailable");
    }
    return this.ctx;
  }
}

/** Zero-copy `Uint8Array` view over an `ImageData`'s RGBA bytes. */
export function rgbaOf(image: ImageData): Uint8Array {
  const d = image.data; // Uint8ClampedArray
  return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
}

function isImageData(x: EdgeImage): x is ImageData {
  return typeof ImageData !== "undefined" && x instanceof ImageData;
}

function isVideo(x: EdgeImage): x is HTMLVideoElement {
  return typeof HTMLVideoElement !== "undefined" && x instanceof HTMLVideoElement;
}
