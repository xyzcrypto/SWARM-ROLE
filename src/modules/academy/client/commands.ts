// Voice commands for the Academy. Pure parsing, unit-tested; the dock turns a
// recognised command into a window event that the open page acts on.

export type Command = "start" | "next" | "repeat" | "explain" | "leaderboard" | "live" | "learn" | "pause" | "resume" | "mute" | "unmute" | "stop" | "answer";

export type Parsed = { cmd: Command; option?: number } | null;

const OPTION_WORDS: Record<string, number> = { a: 0, one: 0, first: 0, "1": 0, b: 1, two: 1, second: 1, "2": 1, c: 2, three: 2, third: 2, "3": 2, d: 3, four: 3, fourth: 3, "4": 3 };

export function parseCommand(raw: string): Parsed {
  const t = raw.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const opt = /\b(?:option|answer|choose|pick|select)\s+(a|b|c|d|one|two|three|four|first|second|third|fourth|[1-4])\b/.exec(t);
  if (opt) return { cmd: "answer", option: OPTION_WORDS[opt[1]] };
  if (/\b(start|begin|play)\b.*\b(quiz|challenge|game)\b|^(start|begin)$/.test(t)) return { cmd: "start" };
  if (/\b(next|continue|skip ahead)\b/.test(t)) return { cmd: "next" };
  if (/\b(repeat|again|say that|read)\b/.test(t)) return { cmd: "repeat" };
  if (/\b(explain|why|explanation)\b/.test(t)) return { cmd: "explain" };
  if (/\b(leaderboard|ranking|rankings|rank)\b/.test(t)) return { cmd: "leaderboard" };
  if (/\blive\b/.test(t)) return { cmd: "live" };
  if (/\b(learn|lesson|library|course)\b/.test(t)) return { cmd: "learn" };
  if (/\bunmute\b|\bsound on\b/.test(t)) return { cmd: "unmute" };
  if (/\bmute\b|\bsound off\b|\bquiet\b/.test(t)) return { cmd: "mute" };
  if (/\bresume\b/.test(t)) return { cmd: "resume" };
  if (/\bpause\b/.test(t)) return { cmd: "pause" };
  if (/\b(stop|cancel|be quiet)\b/.test(t)) return { cmd: "stop" };
  return null;
}

export const COMMAND_EVENT = "academy:command";

export function dispatchCommand(p: NonNullable<Parsed>) {
  window.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: p }));
}
