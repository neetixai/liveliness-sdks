/** Self-contained CSS, injected once into <head>. No external stylesheet. */

const STYLE_ID = "neetix-edge-widget-styles";

export const CSS = `
.nx-root{
  --nx-bg:#0b0f14; --nx-card:#0e141b; --nx-border:#1c2430; --nx-fg:#e6edf3;
  --nx-muted:#9aa7b4; --nx-accent:#1f6feb; --nx-ok:#22c55e; --nx-warn:#f59e0b;
  --nx-bad:#ef4444;
  box-sizing:border-box; width:100%; max-width:420px; margin:0 auto;
  font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--nx-fg); background:var(--nx-card); border:1px solid var(--nx-border);
  border-radius:16px; padding:14px; -webkit-user-select:none; user-select:none;
}
.nx-root *{box-sizing:border-box}
.nx-stage{position:relative; width:100%; aspect-ratio:3/4; border-radius:12px;
  overflow:hidden; background:#000;}
.nx-video{position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  display:block;}
.nx-video.nx-mirror{transform:scaleX(-1)}
.nx-overlay{position:absolute; inset:0; width:100%; height:100%; pointer-events:none;}
.nx-guide{position:absolute; left:12px; right:12px; bottom:12px; text-align:center;
  font-size:14px; font-weight:600; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.7);
  background:rgba(0,0,0,.38); border-radius:10px; padding:8px 10px; backdrop-filter:blur(2px);}
.nx-chips{position:absolute; top:10px; left:10px; right:10px; display:flex; gap:6px;
  flex-wrap:wrap;}
.nx-chip{font-size:12px; font-weight:600; padding:4px 9px; border-radius:999px;
  background:rgba(0,0,0,.5); color:#fff; display:inline-flex; align-items:center; gap:5px;
  border:1px solid rgba(255,255,255,.14);}
.nx-chip .nx-dot{width:8px; height:8px; border-radius:50%; background:var(--nx-muted);}
.nx-chip.ok{background:rgba(16,40,26,.85); border-color:#1f5133}
.nx-chip.ok .nx-dot{background:var(--nx-ok)}
.nx-chip.warn{background:rgba(42,30,16,.85); border-color:#52401f}
.nx-chip.warn .nx-dot{background:var(--nx-warn)}
.nx-chip.bad{background:rgba(40,16,16,.85); border-color:#5b2323}
.nx-chip.bad .nx-dot{background:var(--nx-bad)}
.nx-meter{margin:12px 2px 4px; height:8px; border-radius:999px; background:#161b22;
  overflow:hidden;}
.nx-meter-fill{height:100%; width:0%; border-radius:999px; background:var(--nx-warn);
  transition:width .12s linear, background .2s linear;}
.nx-actions{display:flex; gap:10px; margin-top:12px;}
.nx-btn{flex:1; border:0; border-radius:10px; padding:11px 14px; font-size:14px;
  font-weight:650; cursor:pointer; color:#fff; background:var(--nx-accent);}
.nx-btn.secondary{background:#21262d}
.nx-btn:disabled{opacity:.45; cursor:default}
.nx-btn[hidden]{display:none}
.nx-privacy{margin-top:10px; text-align:center; font-size:11.5px; color:var(--nx-muted);}
.nx-error{position:absolute; inset:0; display:flex; flex-direction:column; gap:12px;
  align-items:center; justify-content:center; text-align:center; padding:22px;
  background:rgba(6,9,13,.94); color:var(--nx-fg);}
.nx-error[hidden]{display:none}
.nx-error .nx-error-ico{font-size:30px}
.nx-error .nx-error-msg{font-size:14px; color:var(--nx-muted); max-width:280px}
.nx-error .nx-btn{flex:0 0 auto; padding:9px 18px}
.nx-badge{position:absolute; bottom:10px; right:10px; font-size:10px; letter-spacing:.04em;
  text-transform:uppercase; color:var(--nx-muted); background:rgba(0,0,0,.4);
  padding:3px 7px; border-radius:6px;}
`;

export function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}
