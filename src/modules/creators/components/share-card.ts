"use client";

import type { Profile } from "@modules/creators/lib/x-index";
import { compact, full } from "@modules/creators/lib/game";

// Draws the shareable "Proof of Variational" card in the browser (canvas ->
// PNG). Client-side on purpose: an OG-image route would burn Fluid CPU on
// every share, this costs the server nothing.

const W = 1200;
const H = 630;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function drawShareCard(p: Profile): Promise<string> {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0b0f");
  bg.addColorStop(1, "#15151a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, 700);
  glow.addColorStop(0, "rgba(226,167,47,0.28)");
  glow.addColorStop(1, "rgba(226,167,47,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(0, H, 0, 0, H, 600);
  glow2.addColorStop(0, "rgba(34,214,146,0.18)");
  glow2.addColorStop(1, "rgba(34,214,146,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  const font = (w: number, s: number) => `${w} ${s}px Inter, "Geist", system-ui, sans-serif`;

  // Header
  ctx.fillStyle = "#e2a72f";
  ctx.font = font(700, 22);
  ctx.fillText("XYZ CRYPTO  ·  CREATOR LEADERBOARD", 64, 76);
  ctx.fillStyle = "#f4f4f5";
  ctx.font = font(800, 54);
  ctx.fillText("Proof of Variational", 64, 140);

  // Avatar
  const av = p.avatar ? await loadImage(p.avatar) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(124, 260, 60, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (av) ctx.drawImage(av, 64, 200, 120, 120);
  else {
    ctx.fillStyle = "#25252c";
    ctx.fillRect(64, 200, 120, 120);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(226,167,47,0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(124, 260, 61, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#f4f4f5";
  ctx.font = font(700, 40);
  ctx.fillText(p.name.slice(0, 26), 212, 252);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = font(500, 26);
  ctx.fillText(`@${p.handle}  ·  L${p.level.level.n} ${p.level.level.name}${p.rank ? `  ·  Rank #${p.rank}` : ""}`, 212, 296);

  // Stat tiles
  const tiles: [string, string][] = [
    ["POINTS", full(p.totals.points)],
    ["XYZ SCORE", String(p.score.total)],
    ["VIEWS", compact(p.totals.views)],
    ["POSTS", full(p.totals.posts)],
  ];
  tiles.forEach(([label, value], i) => {
    const x = 64 + i * 272;
    const y = 380;
    roundRect(ctx, x, y, 248, 150, 22);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#71717a";
    ctx.font = font(700, 18);
    ctx.fillText(label, x + 24, y + 46);
    ctx.fillStyle = i === 0 ? "#ebbd52" : "#f4f4f5";
    ctx.font = font(800, 50);
    ctx.fillText(value, x + 24, y + 112);
  });

  ctx.fillStyle = "#71717a";
  ctx.font = font(500, 20);
  ctx.fillText("xyzcrypto.io/creators", 64, 588);
  ctx.textAlign = "right";
  const nb = p.badges.filter((b) => b.earned).length;
  ctx.fillText(`${nb} badge${nb === 1 ? "" : "s"}${p.streak ? `  ·  ${p.streak}-week streak` : ""}`, W - 64, 588);

  try {
    return c.toDataURL("image/png");
  } catch {
    // A cross-origin avatar without CORS headers taints the canvas. Redraw
    // without it rather than fail the download.
    return drawShareCard({ ...p, avatar: null });
  }
}
