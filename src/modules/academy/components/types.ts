// Response shapes of the public Academy endpoints, for client components.
// Type-only imports: nothing server-side reaches the browser bundle.
import type { getPulse, getBoard, BoardRow } from "@modules/academy/lib/board";
import type { CatalogCategory } from "@modules/academy/lib/store";
import type { listLive, publicLiveState, myLiveState, liveResults } from "@modules/academy/lib/live";
import type { QuizResult, getQuizState, answerQuiz } from "@modules/academy/lib/quiz";

export type Pulse = Awaited<ReturnType<typeof getPulse>>;
export type Board = Awaited<ReturnType<typeof getBoard>>;
export type { BoardRow, CatalogCategory, QuizResult };
export type LiveListItem = Awaited<ReturnType<typeof listLive>>[number];
export type LiveState = Awaited<ReturnType<typeof publicLiveState>>;
export type LiveMe = Awaited<ReturnType<typeof myLiveState>>;
export type LiveResults = Awaited<ReturnType<typeof liveResults>>;
export type QuizState = Awaited<ReturnType<typeof getQuizState>>;
export type AnswerResult = Awaited<ReturnType<typeof answerQuiz>>;
