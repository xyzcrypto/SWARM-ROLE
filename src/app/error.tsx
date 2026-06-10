"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
        <button onClick={() => reset()} className="btn-primary">Try again</button>
        <Link href="/" className="btn-secondary">Back home</Link>
      </div>
    </main>
  );
}
