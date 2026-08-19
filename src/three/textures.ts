import * as THREE from "three";

/* ------------------------- window facade ------------------------- */

export function makeWindowTexture(
  cols: number,
  rows: number,
  litRatio: number,
  base: string,
  lit: string
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = Math.max(4, cols) * 16;
  c.height = Math.max(4, rows) * 16;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (Math.random() < litRatio) {
        g.fillStyle = Math.random() < 0.75 ? lit : "#8fb4ff";
        g.globalAlpha = 0.55 + Math.random() * 0.45;
      } else {
        g.fillStyle = "#0a0e16";
        g.globalAlpha = 0.9;
      }
      g.fillRect(x * 16 + 4, y * 16 + 5, 8, 7);
      g.globalAlpha = 1;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* --------------------------- road --------------------------- */

export function makeRoadTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0d1118";
  g.fillRect(0, 0, 256, 512);
  // subtle asphalt noise
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2);
  }
  // edge lines
  g.fillStyle = "#2c3644";
  g.fillRect(6, 0, 3, 512);
  g.fillRect(247, 0, 3, 512);
  // center dashes
  g.fillStyle = "#54617a";
  for (let y = 0; y < 512; y += 96) g.fillRect(125, y, 6, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeSidewalkTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#161c26";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#232c3a";
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * 32, 0);
    g.lineTo(i * 32, 128);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i * 32);
    g.lineTo(128, i * 32);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* --------------------------- clouds --------------------------- */

export function makeCloudTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 9; i++) {
    const x = 60 + Math.random() * 136;
    const y = 90 + Math.random() * 76;
    const r = 34 + Math.random() * 52;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(190,205,230,0.55)");
    grad.addColorStop(1, "rgba(190,205,230,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSoftDot(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.4)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* --------------------------- billboard --------------------------- */

export interface BoardDrawOpts {
  bg?: string;
  fg?: string;
  accent?: string;
  small?: boolean;
  alert?: boolean;
  glitch?: number; // 0..1 amount
}

export interface BoardSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  draw: (lines: string[], opts: BoardDrawOpts) => void;
}

export function makeBoardSurface(w = 512, h = 288): BoardSurface {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const draw = (lines: string[], opts: BoardDrawOpts) => {
    const bg = opts.alert ? "#14040a" : opts.bg ?? "#0d1117";
    const fg = opts.alert ? "#ffe3ea" : opts.fg ?? "#e8edf4";
    const accent = opts.alert ? "#ff003c" : opts.accent ?? "#5c8dff";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // frame
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.globalAlpha = 1;
    // corner ticks
    ctx.fillStyle = accent;
    [[6, 6], [w - 22, 6], [6, h - 14], [w - 22, h - 14]].forEach(([x, y]) =>
      ctx.fillRect(x, y, 16, 3)
    );
    // municipal strip
    ctx.font = "500 15px 'IBM Plex Mono', monospace";
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.85;
    ctx.fillText("NOVA MUNICIPAL MEDIA — CH 07", 22, 32);
    ctx.globalAlpha = 1;

    // main lines
    const size = opts.small ? 34 : 46;
    ctx.font = `${size}px 'Michroma', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = fg;
    const total = lines.length;
    const lh = size * 1.28;
    const y0 = h / 2 - ((total - 1) * lh) / 2 + size * 0.18 + 8;
    lines.forEach((ln, i) => {
      ctx.fillText(ln, w / 2, y0 + i * lh, w - 48);
    });
    ctx.textAlign = "left";
    ctx.font = "400 13px 'IBM Plex Mono', monospace";
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.5;
    ctx.fillText(opts.alert ? "PRIORITY BROADCAST" : "NOVA-01 // PUBLIC FEED", 22, h - 18);
    ctx.globalAlpha = 1;

    // glitch: slice + RGB smear
    const gl = opts.glitch ?? 0;
    if (gl > 0.01) {
      const slices = Math.floor(2 + gl * 6);
      for (let i = 0; i < slices; i++) {
        const sy = Math.random() * h;
        const sh = 4 + Math.random() * 14 * gl;
        const dx = (Math.random() - 0.5) * 60 * gl;
        ctx.drawImage(canvas, 0, sy, w, sh, dx, sy, w, sh);
      }
      ctx.globalAlpha = 0.16 * gl + 0.04;
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "#00ffe1";
      ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 3);
      ctx.fillStyle = "#ff003c";
      ctx.fillRect(0, Math.random() * h, w, 1 + Math.random() * 2);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    texture.needsUpdate = true;
  };

  return { canvas, ctx, texture, draw };
}

/* --------------------------- server rack --------------------------- */

export function makeServerTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#05080d";
  g.fillRect(0, 0, 128, 512);
  for (let y = 12; y < 512; y += 24) {
    g.fillStyle = Math.random() < 0.5 ? "#0c1a22" : "#081018";
    g.fillRect(8, y, 112, 14);
    for (let x = 14; x < 118; x += 12) {
      const on = Math.random() < 0.4;
      g.fillStyle = on ? (Math.random() < 0.8 ? "#00ffe1" : "#ff003c") : "#12222c";
      g.globalAlpha = on ? 0.5 + Math.random() * 0.5 : 0.6;
      g.fillRect(x, y + 5, 5, 3);
      g.globalAlpha = 1;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* --------------------------- big numeral --------------------------- */

export function makeNumberTexture(text: string, color = "#e8edf4"): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#10151d";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#2c3644";
  g.lineWidth = 4;
  g.strokeRect(8, 8, 240, 240);
  g.font = "150px 'Michroma', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(text, 128, 138);
  g.font = "16px 'IBM Plex Mono', monospace";
  g.fillStyle = "#5c8dff";
  g.fillText("BLOCK 17 — MUNICIPAL", 128, 226);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
