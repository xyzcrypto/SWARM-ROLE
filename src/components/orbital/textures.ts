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

// Saturn's gas body: a vertical (latitudinal) gradient - gold at the lit top,
// through amber/beige, to deep brown - with fine horizontal bands and faint
// longitudinal streaks so the slow spin reads. Wraps horizontally.
export function saturnBodyTexture(): THREE.Texture {
  const w = 512;
  const h = 256;
  const { c, ctx } = makeCanvas(w, h);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, "#fbe6ad");
  grad.addColorStop(0.22, "#ecc063");
  grad.addColorStop(0.5, "#cf8f2a");
  grad.addColorStop(0.78, "#9a611a");
  grad.addColorStop(1.0, "#5c3a0e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // latitudinal bands - subtle lighter/darker horizontal streaks
  for (let y = 0; y < h; y += 2) {
    const n = Math.sin(y * 0.16) * 0.5 + Math.sin(y * 0.043 + 1.3) * 0.5;
    const a = 0.05 + Math.abs(n) * 0.06;
    ctx.fillStyle = n > 0 ? `rgba(255,240,205,${a})` : `rgba(90,58,14,${a})`;
    ctx.fillRect(0, y, w, 2);
  }
  // faint longitudinal variation so axial spin is perceptible
  for (let x = 0; x < w; x += 3) {
    const a = (Math.sin(x * 0.08) * 0.5 + 0.5) * 0.04;
    ctx.fillStyle = `rgba(255,236,190,${a})`;
    ctx.fillRect(x, 0, 2, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
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
    // Cassini division - a darker gap
    const gap = Math.exp(-Math.pow((t - 0.7) / 0.022, 2));
    a *= 1 - 0.85 * gap;
    a *= 0.85;
    // colour: warm amber outer, paler mid
    const mix = 0.5 + 0.5 * Math.sin(t * 40);
    const cr = Math.round(240 - mix * 60);
    const cg = Math.round(206 - mix * 70);
    const cb = Math.round(132 - mix * 60);
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
