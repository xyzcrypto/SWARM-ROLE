// Voice commands for the Academy. Pure parsing, unit-tested; the dock turns a
// recognised command into a window event that the open page acts on.

export type Command = "help" | "start" | "next" | "repeat" | "explain" | "leaderboard" | "live" | "learn" | "pause" | "resume" | "mute" | "unmute" | "stop" | "answer";

export type Parsed = { cmd: Command; option?: number } | null;

const OPTION_WORDS: Record<string, number> = { a: 0, one: 0, first: 0, "1": 0, b: 1, two: 1, second: 1, "2": 1, c: 2, three: 2, third: 2, "3": 2, d: 3, four: 3, fourth: 3, "4": 3 };

// Said before a command and meaning nothing: "hey Aneq, could you please ..."
const POLITE = /^(?:(?:hey|hi|ok|okay|hello)\s+)?(?:aneq(?:ue)?\s*)?(?:(?:can|could|would|will)\s+you\s+|please\s+|kya\s+(?:aap|tum)\s+|zara\s+)*(?:please\s+)?/;

// A real question for the tutor, not an instruction for the app.
const QUESTION = /^(?:what|whats|what's|why|how|when|where|who|whom|whose|which|is|are|was|were|does|do|did|can|could|should|would|will|explain\s+(?:to\s+me\s+)?(?:what|why|how)|tell\s+me|kya|kyu|kyun|kyon|kaise|kab|kaun|kahan|matlab)\b/;

/**
 * Turn what the learner said into an app command, or null when it should go
 * to AneQue as a question.
 *
 * ⚠️ This used to match single keywords anywhere in the sentence, so real
 * questions were swallowed as commands and never reached the AI: "why is
 * funding rate negative?" ran the Explain command, "how do live quizzes work?"
 * opened the Live page, "can you read about staking" repeated the quiz
 * question, "what's my rank" opened the leaderboard. Live Talk felt like it
 * was not listening. Now a question is a question unless it is a short,
 * explicit instruction.
 */
export function parseCommand(raw: string): Parsed {
  const asked = raw.includes("?");
  const t0 = raw.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  if (!t0) return null;
  // Picking an option is always a command, however it is phrased.
  const opt = /\b(?:option|answer|choose|pick|select)\s+(a|b|c|d|one|two|three|four|first|second|third|fourth|[1-4])\b/.exec(t0);
  if (opt) return { cmd: "answer", option: OPTION_WORDS[opt[1]] };
  const t = t0.replace(POLITE, "").trim();
  if (!t) return null;
  const words = t.split(" ").length;
  // Instructions are short. Anything long is a question or a remark for the AI.
  if (words > 6) return null;
  // Every command below must match the WHOLE utterance (anchored), so a
  // question that merely contains a command word falls through to the AI.
  if (asked && QUESTION.test(t) && words > 1) return null;
  if (/^(help|what can i say|commands)$/.test(t)) return { cmd: "help" };
  if (/^(?:start|begin|play)(?:\s+(?:a|the|new|another))*(?:\s+(?:quiz|challenge|game))?(?:\s+now)?$/.test(t)) return { cmd: "start" };
  if (/^(?:next|continue|skip ahead|go on)(?:\s+(?:question|one|please))?$/.test(t)) return { cmd: "next" };
  if (/^(?:repeat|again|say (?:that|it) again|read (?:it|that|the question)(?: again)?)(?:\s+(?:question|that|it|please))?$/.test(t)) return { cmd: "repeat" };
  if (/^(?:explain|why|explanation)(?:\s+(?:it|that|the answer|answer|this|please))?$/.test(t)) return { cmd: "explain" };
  if (/^(?:open|show|go to|take me to)?\s*(?:the\s+)?(?:leaderboard|leaderboards|ranking|rankings)$/.test(t)) return { cmd: "leaderboard" };
  if (/^(?:open|show|go to|take me to|join)?\s*(?:the\s+|a\s+)?live(?:\s+(?:quiz|quizzes|arena|room))?$/.test(t)) return { cmd: "live" };
  if (/^(?:open|show|go to|take me to)?\s*(?:the\s+)?(?:learn|lessons?|library|courses?)$/.test(t)) return { cmd: "learn" };
  if (/^(?:unmute|sound on)$/.test(t)) return { cmd: "unmute" };
  if (/^(?:mute|sound off|quiet)$/.test(t)) return { cmd: "mute" };
  if (/^resume$/.test(t)) return { cmd: "resume" };
  if (/^pause$/.test(t)) return { cmd: "pause" };
  if (/^(?:stop|cancel|be quiet|bye|goodbye|that's all|thats all)$/.test(t)) return { cmd: "stop" };
  return null;
}

export const COMMAND_EVENT = "academy:command";

export function dispatchCommand(p: NonNullable<Parsed>) {
  window.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: p }));
}
