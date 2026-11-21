import { VOICE_LINES_HI } from "./voice-lines-hi";

/** The Hinglish switch only appears once AneQue's Hinglish lines are in. */
export const HINGLISH_READY = Object.keys(VOICE_LINES_HI).length > 0;
