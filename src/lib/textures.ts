import * as THREE from "three";

/* ------------------------------------------------------------------ utils */

function canvas(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function ctxOf(c: HTMLCanvasElement) {
  return c.getContext("2d")!;
}

function tex(c: HTMLCanvasElement, srgb = true, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  t.anisotropy = 8;
  return t;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, alpha: number, size = 1.6, rgb = "90,84,76") {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(${rgb},${Math.random() * alpha})`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, Math.random() * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Converts a grayscale height canvas into a tangent-space normal map. */
export function heightToNormal(src: HTMLCanvasElement, strength = 2.2): THREE.Texture {
  const w = src.width;
  const h = src.height;
  const data = ctxOf(src).getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const octx = ctxOf(out);
  const img = octx.createImageData(w, h);
  const at = (x: number, y: number) => data[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ------------------------------------------------- pale oak chevron floor */

export function woodFloor(): { map: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture } {
  const S = 1024;
  const c = canvas(S);
  const ctx = ctxOf(c);
  const hc = canvas(S);
  const hctx = ctxOf(hc);
  const rc = canvas(S);
  const rctx = ctxOf(rc);

  // Light nordic oak tones.
  const tones = ["#e4d3bb", "#dccab0", "#e9dac4", "#d6c0a4", "#eadcc8", "#dfceb4"];
  const plankH = 72;

  ctx.fillStyle = "#e4d3bb";
  ctx.fillRect(0, 0, S, S);
  hctx.fillStyle = "#808080";
  hctx.fillRect(0, 0, S, S);
  rctx.fillStyle = "#c8c8c8";
  rctx.fillRect(0, 0, S, S);

  for (let y = 0; y < S; y += plankH) {
    let x = -Math.floor(Math.random() * 260);
    while (x < S) {
      const w = 280 + Math.random() * 230;
      ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
      ctx.fillRect(x, y, w, plankH);

      // fine grain
      for (let g = 0; g < 22; g++) {
        const gy = y + 5 + Math.random() * (plankH - 10);
        ctx.strokeStyle = `rgba(150,124,92,${0.03 + Math.random() * 0.09})`;
        ctx.lineWidth = 0.5 + Math.random() * 1.2;
        ctx.beginPath();
        ctx.moveTo(x + 4, gy);
        ctx.bezierCurveTo(x + w * 0.3, gy + (Math.random() - 0.5) * 6, x + w * 0.65, gy + (Math.random() - 0.5) * 6, x + w - 4, gy);
        ctx.stroke();
      }
      // occasional soft knot
      if (Math.random() < 0.22) {
        const kx = x + 40 + Math.random() * (w - 80);
        const ky = y + plankH / 2;
        const g = ctx.createRadialGradient(kx, ky, 1, kx, ky, 11);
        g.addColorStop(0, "rgba(150,118,80,0.5)");
        g.addColorStop(1, "rgba(150,118,80,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(kx, ky, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // matte satin varnish variance
      const sheen = 186 + Math.floor(Math.random() * 46);
      rctx.fillStyle = `rgb(${sheen},${sheen},${sheen})`;
      rctx.fillRect(x, y, w, plankH);

      // crisp seams
      ctx.strokeStyle = "rgba(170,142,108,0.5)";
      ctx.lineWidth = 1.6;
      ctx.strokeRect(x, y, w, plankH);

      hctx.strokeStyle = "rgba(26,26,26,0.85)";
      hctx.lineWidth = 2.5;
      hctx.strokeRect(x, y, w, plankH);

      x += w;
    }
  }
  speckle(ctx, S, S, 2000, 0.03, 1.1, "150,124,92");

  const map = tex(c, true, 1);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 3);
  const normal = heightToNormal(hc, 1.1);
  normal.repeat.set(4, 3);
  const rough = tex(rc, false, 1);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(4, 3);
  return { map, normal, rough };
}

/* ---------------------------------------------------- white gallery walls */

export function plaster(base = "#f7f6f3"): { map: THREE.Texture; normal: THREE.Texture } {
  const S = 512;
  const c = canvas(S);
  const ctx = ctxOf(c);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  // extremely subtle roller mottling — museum walls are near-flat
  for (let i = 0; i < 160; i++) {
    const r = 30 + Math.random() * 110;
    const x = Math.random() * S;
    const y = Math.random() * S;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${Math.random() < 0.5 ? "255,255,255" : "226,222,214"},${0.03 + Math.random() * 0.045})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(ctx, S, S, 2600, 0.022, 1, "150,146,138");

  const hc = canvas(S);
  const hctx = ctxOf(hc);
  hctx.fillStyle = "#808080";
  hctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2200; i++) {
    const v = 118 + Math.random() * 70;
    hctx.fillStyle = `rgba(${v},${v},${v},0.4)`;
    hctx.beginPath();
    hctx.arc(Math.random() * S, Math.random() * S, Math.random() * 2.6, 0, Math.PI * 2);
    hctx.fill();
  }

  const map = tex(c, true, 3);
  const normal = heightToNormal(hc, 0.5);
  normal.repeat.set(3, 3);
  return { map, normal };
}

/* ------------------------------------------------------ polished terrazzo */

export function terrazzo(): { map: THREE.Texture; normal: THREE.Texture } {
  const S = 512;
  const c = canvas(S);
  const ctx = ctxOf(c);
  ctx.fillStyle = "#f2f0ec";
  ctx.fillRect(0, 0, S, S);

  const chips = ["#d8d3ca", "#c4beb3", "#e8e2d6", "#b9b2a6", "#cfc7ba", "#a9a79f"];
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 2 + Math.random() * 7;
    ctx.fillStyle = chips[Math.floor(Math.random() * chips.length)];
    ctx.globalAlpha = 0.55 + Math.random() * 0.4;
    ctx.beginPath();
    // irregular polygon chip
    const sides = 5 + Math.floor(Math.random() * 3);
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2 + Math.random() * 0.5;
      const rr = r * (0.7 + Math.random() * 0.6);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  speckle(ctx, S, S, 1400, 0.03, 1, "130,126,118");

  const map = tex(c, true, 1);
  const normal = heightToNormal(c, 0.22);
  return { map, normal };
}

/* -------------------------------------------------------------- soft wool */

export function rugTexture(): THREE.Texture {
  const S = 1024;
  const c = canvas(S);
  const ctx = ctxOf(c);

  // Warm greige wool rug — quiet, contemporary.
  ctx.fillStyle = "#ddd6c9";
  ctx.fillRect(0, 0, S, S);

  const cx = S / 2;
  const cy = S / 2;
  const g = ctx.createRadialGradient(cx, cy, 80, cx, cy, S * 0.66);
  g.addColorStop(0, "rgba(255,253,248,0.65)");
  g.addColorStop(1, "rgba(188,178,162,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // concentric hand-loomed rings
  ctx.strokeStyle = "rgba(160,150,134,0.3)";
  for (let r = 110; r < S / 2 - 30; r += 46) {
    ctx.lineWidth = r % 92 === 18 ? 5 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // subtle radial weave
  ctx.strokeStyle = "rgba(170,160,144,0.16)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100);
    ctx.lineTo(cx + Math.cos(a) * (S / 2 - 34), cy + Math.sin(a) * (S / 2 - 34));
    ctx.stroke();
  }

  // pile fuzz
  speckle(ctx, S, S, 10000, 0.05, 1.5, "140,130,114");
  speckle(ctx, S, S, 6000, 0.05, 1.3, "255,252,245");
  return tex(c, true, 1);
}

/* ------------------------------------------------------------------ linen */

export function velvet(color: string): THREE.Texture {
  // Repurposed as upholstery linen — flat, matte, woven.
  const S = 256;
  const c = canvas(S);
  const ctx = ctxOf(c);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < S; i += 3) {
    ctx.fillStyle = i % 6 === 0 ? "#ffffff" : "#000000";
    ctx.fillRect(i, 0, 1.4, S);
    ctx.fillRect(0, i, S, 1.4);
  }
  ctx.globalAlpha = 1;
  speckle(ctx, S, S, 2200, 0.05, 1, "255,255,255");
  return tex(c, true, 3);
}

/* ------------------------------------------------------ labels & signage */

export function plaqueTexture(title: string, artist: string): THREE.Texture {
  const c = canvas(512, 256);
  const ctx = ctxOf(c);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 256);

  // Minimal museum label: thin rule, left-aligned, generous space.
  ctx.fillStyle = "#1c1c1e";
  ctx.fillRect(40, 54, 54, 3);

  ctx.textAlign = "left";
  ctx.fillStyle = "#121214";
  ctx.font = "600 40px Inter, Helvetica, Arial, sans-serif";
  const words = title.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > 420 && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 40, 112 + i * 46));

  ctx.font = "400 30px Inter, Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#86868b";
  ctx.fillText(artist, 40, 112 + Math.min(lines.length, 2) * 46 + 16, 430);

  return tex(c);
}

export function signTexture(title: string, sub: string): THREE.Texture {
  const c = canvas(1600, 420);
  const ctx = ctxOf(c);
  ctx.clearRect(0, 0, 1600, 420);
  ctx.textAlign = "center";

  // Wall-mounted vinyl lettering, dark ink on the white wall.
  ctx.fillStyle = "#1a1a1c";
  ctx.font = "300 170px Inter, Helvetica, Arial, sans-serif";
  ctx.fillText(title, 800, 200);

  ctx.font = "400 44px Inter, Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#8a8a8f";
  ctx.fillText(sub, 800, 288);

  ctx.fillStyle = "#1a1a1c";
  ctx.fillRect(700, 330, 200, 3);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function wallTextTexture(text: string, sub: string): THREE.Texture {
  const c = canvas(1024, 256);
  const ctx = ctxOf(c);
  ctx.clearRect(0, 0, 1024, 256);
  ctx.textAlign = "center";
  ctx.fillStyle = "#1f1f22";
  ctx.font = "300 82px Inter, Helvetica, Arial, sans-serif";
  ctx.fillText(text, 512, 104);
  ctx.font = "400 36px Inter, Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#8a8a8f";
  ctx.fillText(sub, 512, 168);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function nameplateTexture(name: string, color: string, isBot?: boolean): THREE.Texture {
  const label = isBot ? `${name} · guide` : name;
  const c = canvas(512, 128);
  const ctx = ctxOf(c);
  ctx.font = "600 48px Inter, system-ui, sans-serif";
  const w = Math.min(492, ctx.measureText(label).width + 104);
  const x = (512 - w) / 2;

  // Crisp white pill with a soft shadow — reads on any wall.
  ctx.shadowColor = "rgba(20,20,24,0.28)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.beginPath();
  ctx.roundRect(x, 22, w, 84, 42);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 44, 64, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#19191c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 256 + 16, 66, w - 112);
  return tex(c);
}

const EMOTE_GLYPHS: Record<string, string> = {
  wave: "👋",
  dance: "🎶",
  jump: "⭐",
  spin: "💫",
  bow: "❤",
};

export function emoteBubbleTexture(emote: string): THREE.Texture {
  const c = canvas(192, 192);
  const ctx = ctxOf(c);
  ctx.shadowColor = "rgba(20,20,24,0.3)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.beginPath();
  ctx.arc(96, 84, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(76, 136);
  ctx.lineTo(96, 174);
  ctx.lineTo(116, 134);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.font = "62px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(EMOTE_GLYPHS[emote] || "•", 96, 88);
  return tex(c);
}

/* ---------------------------------------------------------------- effects */

export function softDot(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)"): THREE.Texture {
  const S = 128;
  const c = canvas(S);
  const ctx = ctxOf(c);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, "rgba(255,255,255,0.5)");
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return tex(c);
}

/** Vertical gradient used for daylight shafts falling from the skylight. */
export function shaftTexture(): THREE.Texture {
  const c = canvas(64, 256);
  const ctx = ctxOf(c);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgba(255,255,255,0.8)");
  g.addColorStop(0.45, "rgba(246,250,255,0.2)");
  g.addColorStop(1, "rgba(240,246,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, "rgba(0,0,0,1)");
  h.addColorStop(0.5, "rgba(0,0,0,0)");
  h.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bright glazed skylight with slim mullions. */
export function skylightTexture(): THREE.Texture {
  const c = canvas(512, 256);
  const ctx = ctxOf(c);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.55, "#f4f9ff");
  g.addColorStop(1, "#e3edfa");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = "rgba(120,126,136,0.5)";
  ctx.lineWidth = 7;
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 512) / 8, 0);
    ctx.lineTo((i * 512) / 8, 256);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(512, 128);
  ctx.stroke();
  return tex(c);
}

/** Terrazzo kept available under its previous name for the entrance inlay. */
export const marble = terrazzo;
