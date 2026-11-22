"use client";

import { startTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { isChunkError, reloadForNewDeploy } from "@shared/utils/recover";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const tries = useRef(0);
  useEffect(() => {
    console.error(error);
    // Report nested-route errors to Sentry (no-op until a DSN is configured).
    Sentry.captureException(error);
    // A chunk from the previous deployment: only a full load can fix it, so
    // do it now instead of showing a button that cannot work.
    if (isChunkError(error?.message)) reloadForNewDeploy();
  }, [error]);

  // ⚠️ `reset()` alone only re-renders the client segment. When the error came
  // from the server (a cold function that failed, a dropped RSC request) the
  // same failed payload is rendered again and "Try again" does nothing, which
  // is how a visitor ends up refreshing by hand. Refetch from the server first,
  // and after two failed tries fall back to a full page load.
  const retry = () => {
    tries.current += 1;
    if (tries.current > 2) {
      window.location.reload();
      return;
    }
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="mono text-sm uppercase tracking-[0.22em] text-gold-300">Error</p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-zinc-50 sm:text-4xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-zinc-400">
        An unexpected error occurred. You can try again or head back home.
      </p>
      <div className="mt-8 flex gap-3">
        <button onClick={retry} className="btn-primary">Try again</button>
        <Link href="/" className="btn-secondary">Back home</Link>
      </div>
    </main>
  );
}
