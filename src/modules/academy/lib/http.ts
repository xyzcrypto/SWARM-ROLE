import "server-only";
import { NextResponse } from "next/server";
import { fail, handleError } from "@/lib/api";
import { QuizError } from "./quiz";

/** Cache headers used by the Academy routes (see the cost-check skill). */
export const PUBLIC = (sMaxAge: number, swr: number) => `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
export const PRIVATE = "private, no-store";

export function json<T>(data: T, cache: string, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": cache } });
}

/** QuizError carries a user-facing message and status; anything else is a 500 via handleError. */
export function academyError(err: unknown, context: string) {
  if (err instanceof QuizError) {
    const res = fail(err.message, err.status);
    res.headers.set("Cache-Control", PRIVATE);
    return res;
  }
  return handleError(err, context);
}
