import type { StreamFrameUpdate, StreamMessage, StreamVerdictMessage } from "./types";

export interface StreamCallbacks {
  onFrame?: (u: StreamFrameUpdate) => void;
  onVerdict?: (v: StreamVerdictMessage) => void;
  onError?: (e: Event | Error) => void;
}

/**
 * Drives a continuous-liveliness (V-CIP) WebSocket: send JPEG frames, receive
 * per-frame status and a final verdict. Framework-agnostic; use with the
 * browser camera helper or any frame source.
 */
export class StreamSession {
  private ws: WebSocket;
  private closed = false;

  constructor(streamUrl: string, private cb: StreamCallbacks = {}) {
    this.ws = new WebSocket(streamUrl);
    this.ws.binaryType = "arraybuffer";
    this.ws.onmessage = (ev) => this.onMessage(ev);
    this.ws.onerror = (e) => this.cb.onError?.(e);
    this.ws.onclose = () => {
      this.closed = true;
    };
  }

  /** Resolves once the socket is open. */
  ready(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e instanceof Error ? e : new Error("ws error"));
    });
  }

  /** Send one JPEG frame. */
  async sendFrame(frame: Blob): Promise<void> {
    if (this.closed) throw new Error("stream closed");
    const buf = await frame.arrayBuffer();
    this.ws.send(buf);
  }

  /** Signal end of stream; the server replies with the final verdict. */
  end(): void {
    if (!this.closed) this.ws.send("end");
  }

  close(): void {
    this.closed = true;
    this.ws.close();
  }

  private onMessage(ev: MessageEvent): void {
    let msg: StreamMessage;
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "") as StreamMessage;
    } catch {
      return;
    }
    if (msg.type === "frame") this.cb.onFrame?.(msg);
    else if (msg.type === "verdict") this.cb.onVerdict?.(msg);
  }
}
