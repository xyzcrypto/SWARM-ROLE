"use client";

// Last-resort boundary for errors in the root layout itself. Must render its
// own <html>/<body>; uses inline styles (no dependency on globals.css).
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          onClick={() => reset()}
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
