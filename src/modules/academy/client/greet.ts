// What AneQue says when an Academy page opens. Pure (no audio, no clock, no
// randomness of its own), so the tests can pin it.

import type { Piece } from "./audio";
import { VOICE_LINES, type VoiceLine } from "./voice-lines";
import { nameClip } from "./name-bank";

export type GreetPage = "home" | "learn" | "leaderboard" | "live" | "certificates" | "other";

export function greetPage(path: string | null | undefined): GreetPage {
  if (!path || path === "/academy") return "home";
  if (path.startsWith("/academy/learn")) return "learn";
  if (path.startsWith("/academy/leaderboard")) return "leaderboard";
  if (path === "/academy/live") return "live";
  if (path.startsWith("/academy/certificates")) return "certificates";
  return "other"; // quizzes, lessons and the arena have their own lines
}

const v = (k: VoiceLine): Piece => ({ url: `/academy/voice/${k}.mp3`, text: VOICE_LINES[k] });

/** "Hey Rahul!" in her recorded voice when the name is in the bank, else the browser voice. */
export function hey(name: string | null): Piece {
  if (!name) return v("hey_there");
  return { url: nameClip(name), text: `Hey ${name}!` };
}

const PAGE_LINE: Partial<Record<GreetPage, VoiceLine>> = {
  learn: "greet_learn",
  leaderboard: "greet_leaderboard",
  live: "greet_live",
  certificates: "greet_cert",
};

export type GreetInput = {
  name: string | null;
  signedIn: boolean;
  page: GreetPage;
  /** Local hour 0-23, read after mount. */
  hour: number;
  /** First Academy page this browser session: the full greeting. */
  first: boolean;
  streak?: number;
  learnedToday?: boolean;
  dailyDone?: boolean | null;
  /** 0..1, picks between equivalent variants. */
  r?: number;
};

/** The pieces to play, or [] when this page has nothing to add. */
export function greeting(g: GreetInput): Piece[] {
  const pageLine = PAGE_LINE[g.page];
  if (!g.first) return pageLine ? [hey(g.name), v(pageLine)] : [];
  const out: Piece[] = [hey(g.name)];
  if (g.page !== "home" && pageLine) {
    out.push(v(pageLine));
    return out;
  }
  if (g.page !== "home") return out.concat(v(g.signedIn ? "welcome_back" : "welcome"));
  out.push(v(g.hour < 5 ? "good_evening" : g.hour < 12 ? "good_morning" : g.hour < 17 ? "good_afternoon" : "good_evening"));
  if (!g.signedIn) {
    out.push(v("greet_guest"));
    return out;
  }
  if ((g.streak ?? 0) > 0 && !g.learnedToday) out.push(v("greet_streak"));
  else if (g.dailyDone) out.push(v("greet_daily_done"));
  else out.push(v("daily_new"));
  if ((g.r ?? 0) < 0.5) out.push(v("greet_talk"));
  return out;
}
