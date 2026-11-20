// Instant placeholder for routes that render on the server. Server component,
// no JS: it paints the moment a link is clicked and is swapped for the page as
// soon as it streams in, so a slow request never looks like a frozen site.
export function PageSkeleton({ variant = "page", framed = true }: { variant?: "page" | "lesson" | "detail"; framed?: boolean }) {
  const body = (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-32 rounded-full bg-white/[0.06]" />
      <div className="mt-5 h-9 w-3/4 max-w-xl rounded-xl bg-white/[0.07] sm:h-11" />
      <div className="mt-3 h-4 w-2/3 max-w-lg rounded-full bg-white/[0.05]" />
      {variant === "lesson" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
          <div className="hidden space-y-2 lg:block">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-10 rounded-xl bg-white/[0.04]" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className={`h-4 rounded-full bg-white/[0.05] ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
            ))}
            <div className="mt-6 h-40 rounded-3xl bg-white/[0.04]" />
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: variant === "detail" ? 3 : 6 }, (_, i) => (
            <div key={i} className="h-36 rounded-3xl bg-white/[0.04]" />
          ))}
        </div>
      )}
    </div>
  );
  if (!framed) return body;
  return (
    <main className="relative min-h-screen pt-24 sm:pt-28">
      <div className="mx-auto max-w-[1200px] px-5 pb-24 sm:px-6 lg:px-8">{body}</div>
    </main>
  );
}
