import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("Academy UI step 5: leaderboard and certificates", () => {
  const lb = read("src/modules/academy/components/Leaderboard.tsx");
  const cv = read("src/modules/academy/components/CertificateView.tsx");
  const css = read("src/app/academy/academy.css");

  it("rank changes are measured only between two loads of the same period, and only my climb plays a sound", () => {
    expect(lb).toMatch(/const before = seen\.current\?\.period === p \? seen\.current\.ranks : null;/);
    expect(lb).toMatch(/if \(mine && mine > 0\) sfx\("rankup"\);/);
    expect(lb).toMatch(/setTimeout\(\(\) => setMoves\(\{\}\), 2600\)/);
  });

  it("no framer layout animation on the board (it would re-measure every row on each refresh)", () => {
    expect(lb).not.toMatch(/\blayout(Id)?=/);
  });

  it("the certificate reveal is CSS, so the card shows even if JS never runs, and hands the transform back to the tilt", () => {
    expect(cv).toMatch(/acad-cert-stage acad-cert-reveal/);
    expect(cv).not.toMatch(/<motion\.div initial=\{\{ opacity: 0, scale: 0\.98 \}\}/);
    expect(css).toMatch(/acad-cert-unfold 1\.1s cubic-bezier\(0\.22, 1, 0\.36, 1\) 0\.1s backwards;/);
    expect(css).toMatch(/to \{ opacity: 1; transform: rotate\(-8deg\) scale\(1\); \}/); // seal ends where it started
  });

  it("confetti only the first time this device opens a certificate, never with animations off", () => {
    expect(cv).toMatch(/xyz:academy:cert-seen:\$\{cert\.code\}/);
    expect(cv).toMatch(/if \(!valid \|\| document\.documentElement\.classList\.contains\("motion-off"\)\) return;/);
  });

  it("every new animation is switched off by Animations: Off", () => {
    for (const c of ["acad-row-in", "acad-rank-up", "acad-podium-sheen", "acad-crown", "acad-cert-sweep"]) {
      expect(css, c).toMatch(new RegExp(`html\\.motion-off \\.${c}`));
    }
  });
});
