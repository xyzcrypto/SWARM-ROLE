import * as THREE from "three";

// Procedural canvas textures - drawn once at mount. No external files, no
// worker/wasm loaders (the site's CSP forbids them), no network. Every heavy
// visual (Saturn bands, ring, moon craters, glow sprites) is generated here.

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

// Soft round glow - tinted white so a sprite's material.color decides the hue.
// Used additively for rim/bloom halos (we fake bloom instead of a post pass).
export function glowTexture(): THREE.Texture {
  const s = 128;
  const { c, ctx } = makeCanvas(s, s);
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(255,255,255,0.6)");
  g.addColorStop(0.5, "rgba(255,255,255,0.2)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A single soft dot - the star / dust sprite point.
export function dotTexture(): THREE.Texture {
  const s = 64;
  const { c, ctx } = makeCanvas(s, s);
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Saturn's gas body: a REALISTIC gas-giant in the brand GOLD ramp only (no new
// hues). Latitudinal gradient with darkened poles, many turbulent bands built
// from layered sines, wavy swirl streaks (also make the spin read), and a couple
// of soft storm ovals. Wraps horizontally.
export function saturnBodyTexture(): THREE.Texture {
  const w = 1024;
  const h = 512;
  const { c, ctx } = makeCanvas(w, h);

  // base vertical (latitudinal) gradient - poles darker, warm gold mid-belts
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, "#5c3a0e");
  grad.addColorStop(0.12, "#b6771f");
  grad.addColorStop(0.28, "#f0cf7e");
  grad.addColorStop(0.44, "#d79b34");
  grad.addColorStop(0.56, "#f2d68f");
  grad.addColorStop(0.72, "#cf8f2a");
  grad.addColorStop(0.88, "#a5651a");
  grad.addColorStop(1.0, "#4e320c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // turbulent latitudinal bands - multi-octave sine field per row
  for (let y = 0; y < h; y++) {
    const lat = y / h;
    const b = Math.sin(lat * 46) * 0.5 + Math.sin(lat * 17 + 1.2) * 0.32 + Math.sin(lat * 91 + 0.6) * 0.18;
    const a = Math.min(0.17, Math.abs(b) * 0.15);
    ctx.fillStyle = b > 0 ? `rgba(255,244,214,${a})` : `rgba(70,44,12,${a})`;
    ctx.fillRect(0, y, w, 1);
  }

  // wavy swirl streaks - gives the gas a sense of flow (and helps spin read)
  for (let i = 0; i < 300; i++) {
    const y0 = (i * 41) % h;
    const light = Math.sin(i * 12.9898) > 0;
    ctx.strokeStyle = light ? "rgba(255,246,222,0.05)" : "rgba(66,42,12,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const amp = 3 + (i % 6);
    for (let x = 0; x <= w; x += 10) {
      const yy = y0 + Math.sin(x * 0.018 + i) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // soft storm ovals (elliptical, warm-light or dark)
  const storms = [
    { x: 0.62, y: 0.4, rx: 70, ry: 26, col: "rgba(255,239,196,0.5)" },
    { x: 0.26, y: 0.6, rx: 52, ry: 20, col: "rgba(120,74,18,0.42)" },
    { x: 0.82, y: 0.66, rx: 40, ry: 16, col: "rgba(255,232,180,0.4)" },
  ];
  for (const s of storms) {
    const cxp = s.x * w;
    const cyp = s.y * h;
    const g = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, s.rx);
    g.addColorStop(0, s.col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.translate(cxp, cyp);
    ctx.scale(1, s.ry / s.rx);
    ctx.beginPath();
    ctx.arc(0, 0, s.rx, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Saturn's ring, drawn RADIALLY. three's RingGeometry maps UVs planar (center =
// 0.5,0.5), so a concentric texture lands as real rings. Includes multiple bands
// and the dark Cassini division; alpha fades at the inner hole + outer edge.
export function saturnRingTexture(): THREE.Texture {
  const s = 512;
  const { c, ctx } = makeCanvas(s, s);
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2;
  const cy = s / 2;
  const maxR = s / 2;
  for (let r = maxR; r >= 0; r -= 1) {
    const t = r / maxR; // 0 center .. 1 outer edge
    if (t < 0.42) continue; // inner hole (planet sits here)
    // base envelope: rise from inner edge, fade at outer edge
    let a = Math.min(1, (t - 0.42) / 0.06) * Math.min(1, (1 - t) / 0.05);
    // fine banding
    a *= 0.55 + 0.45 * (Math.sin(t * 90) * 0.5 + 0.5);
    // Cassini division (main) + a fainter inner division - a real ring system
    const gap = Math.exp(-Math.pow((t - 0.7) / 0.022, 2));
    const gap2 = Math.exp(-Math.pow((t - 0.56) / 0.014, 2));
    a *= 1 - 0.85 * gap;
    a *= 1 - 0.5 * gap2;
    a *= 0.85;
    // colour: warm amber, brightening a touch toward the outer edge (inner→outer shift)
    const mix = 0.5 + 0.5 * Math.sin(t * 40);
    const warm = (t - 0.42) / 0.56; // 0 inner .. 1 outer
    const cr = Math.round(238 - mix * 55 + warm * 14);
    const cg = Math.round(204 - mix * 66 + warm * 10);
    const cb = Math.round(132 - mix * 58);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${a})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Angular particle specks + faint arcs so the ring's rotation is VISIBLE (a
  // purely concentric ring looks static when it spins). Deterministic positions.
  for (let i = 0; i < 90; i++) {
    const ang = i * 2.399963; // golden angle, even spread
    const frac = 0.46 + Math.abs(Math.sin(i * 12.9898)) * 0.5; // 0.46 - 0.96 of radius
    const rr = frac * maxR;
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    const a = 0.25 + Math.abs(Math.sin(i * 7.71)) * 0.55;
    ctx.fillStyle = `rgba(255,240,205,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Moon surface + matching bump map: grey rock with darker maria and a scatter of
// craters (bright rim + dark floor). Returned pair shares the crater layout.
export function moonTextures(): { map: THREE.Texture; bump: THREE.Texture } {
  const w = 512;
  const h = 256;
  const base = makeCanvas(w, h);
  const bump = makeCanvas(w, h);

  // base grey with a couple of darker maria
  base.ctx.fillStyle = "#b9b9c4";
  base.ctx.fillRect(0, 0, w, h);
  bump.ctx.fillStyle = "#808080";
  bump.ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = 30 + Math.random() * 60;
    const g = base.ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, "rgba(120,120,132,0.5)");
    g.addColorStop(1, "rgba(120,120,132,0)");
    base.ctx.fillStyle = g;
    base.ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // craters
  const craters = 70;
  for (let i = 0; i < craters; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = 3 + Math.random() * 14;
    // colour map: dark floor, faint bright rim
    const g = base.ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, "rgba(70,70,82,0.55)");
    g.addColorStop(0.7, "rgba(150,150,162,0.15)");
    g.addColorStop(0.85, "rgba(225,225,235,0.35)");
    g.addColorStop(1, "rgba(150,150,162,0)");
    base.ctx.fillStyle = g;
    base.ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    // bump: depression (dark) with raised rim (light)
    const bg = bump.ctx.createRadialGradient(x, y, 0, x, y, rr);
    bg.addColorStop(0, "rgba(40,40,40,0.9)");
    bg.addColorStop(0.75, "rgba(120,120,120,0.2)");
    bg.addColorStop(0.9, "rgba(230,230,230,0.7)");
    bg.addColorStop(1, "rgba(128,128,128,0)");
    bump.ctx.fillStyle = bg;
    bump.ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  const map = new THREE.CanvasTexture(base.c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  const bumpTex = new THREE.CanvasTexture(bump.c);
  bumpTex.wrapS = THREE.RepeatWrapping;
  return { map, bump: bumpTex };
}

// A soft elliptical nebula cloud (one colour), for the depth layer behind stars.
export function nebulaTexture(hex: string): THREE.Texture {
  const s = 256;
  const { c, ctx } = makeCanvas(s, s);
  const col = new THREE.Color(hex);
  const r = Math.round(col.r * 255);
  const g = Math.round(col.g * 255);
  const b = Math.round(col.b * 255);
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},0.16)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The XYZ robot face, redrawn on a transparent canvas (mirrors RobotIcon.tsx's
// 48x48 recipe: mint gradient head + gloss + eyes + mouth + antenna + ears) so
// it can sit as a billboard on the crescent moon inside the 3D scene.
export function robotFaceTexture(): THREE.Texture {
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  const k = S / 48; // scale from the 48-unit viewBox
  const rr = (x: number, y: number, wd: number, ht: number, r: number) => {
    const X = x * k;
    const Y = y * k;
    const W = wd * k;
    const H = ht * k;
    const R = Math.min(r * k, W / 2, H / 2);
    ctx.beginPath();
    // Prefer native roundRect, but fall back to arcTo so older canvas engines
    // never throw (a throw here would blank the whole WebGL scene).
    const anyCtx = ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
    if (typeof anyCtx.roundRect === "function") {
      anyCtx.roundRect(X, Y, W, H, R);
      return;
    }
    ctx.moveTo(X + R, Y);
    ctx.arcTo(X + W, Y, X + W, Y + H, R);
    ctx.arcTo(X + W, Y + H, X, Y + H, R);
    ctx.arcTo(X, Y + H, X, Y, R);
    ctx.arcTo(X, Y, X + W, Y, R);
    ctx.closePath();
  };

  // head gradient (mint identity)
  const face = ctx.createLinearGradient(0, 10 * k, 0, 42 * k);
  face.addColorStop(0, "#7ef2c6");
  face.addColorStop(0.45, "#22d692");
  face.addColorStop(1, "#037a54");

  // ears + head, with a soft drop shadow for depth
  ctx.save();
  ctx.shadowColor = "rgba(2,92,63,0.55)";
  ctx.shadowBlur = 3 * k;
  ctx.shadowOffsetY = 1.4 * k;
  ctx.fillStyle = "#0a8f66";
  rr(5, 22, 4.5, 9, 2.25);
  ctx.fill();
  rr(38.5, 22, 4.5, 9, 2.25);
  ctx.fill();
  ctx.fillStyle = face;
  rr(9, 13, 30, 27, 9);
  ctx.fill();
  ctx.restore();

  // antenna
  ctx.strokeStyle = "#0bbb7c";
  ctx.lineWidth = 2 * k;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(24 * k, 8 * k);
  ctx.lineTo(24 * k, 14 * k);
  ctx.stroke();
  ctx.fillStyle = "#9bf7d0";
  ctx.beginPath();
  ctx.arc(24 * k, 6.5 * k, 2.6 * k, 0, Math.PI * 2);
  ctx.fill();

  // top gloss
  const gloss = ctx.createRadialGradient(24 * k, 20 * k, 0, 24 * k, 20 * k, 16 * k);
  gloss.addColorStop(0, "rgba(255,255,255,0.6)");
  gloss.addColorStop(0.6, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  rr(12, 15.5, 24, 15, 7.5);
  ctx.fill();

  // eyes (glossy) + highlight
  const eye = (ex: number, ey: number) => {
    const g = ctx.createRadialGradient(ex * k, ey * k, 0, ex * k, ey * k, 3.4 * k);
    g.addColorStop(0, "#eafff6");
    g.addColorStop(1, "#0a3f2c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex * k, ey * k, 3.4 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc((ex - 0.9) * k, (ey - 1.1) * k, 1.05 * k, 0, Math.PI * 2);
    ctx.fill();
  };
  eye(18.5, 26.5);
  eye(29.5, 26.5);

  // mouth
  ctx.fillStyle = "rgba(10,63,44,0.55)";
  rr(17.5, 33, 13, 3.2, 1.6);
  ctx.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
