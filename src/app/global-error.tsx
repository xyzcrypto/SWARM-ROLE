"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { isChunkError, reloadForNewDeploy } from "@shared/utils/recover";

// Last-resort boundary for errors in the root layout itself. Must render its
// own <html>/<body>; uses inline styles (no dependency on globals.css).
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    if (isChunkError(error?.message)) reloadForNewDeploy();
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#08080a",
          color: "#e4e4e7",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <p style={{ color: "#e2a72f", letterSpacing: "0.2em", fontSize: 13, textTransform: "uppercase" }}>
          Error
        </p>
        <h1 style={{ fontSize: 30, margin: "12px 0 8px", color: "#fafafa" }}>
          Something went wrong
        </h1>
        <p style={{ color: "#a1a1aa", maxWidth: 420 }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          // The root layout itself failed: a re-render of the same tree cannot fix
          // it, a fresh load (current deployment, fresh server render) can.
          onClick={() => window.location.reload()}
          style={{
            marginTop: 28,
            padding: "10px 22px",
            borderRadius: 9999,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            color: "#08080a",
            background: "linear-gradient(135deg,#22d692,#0bbb7c)",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
