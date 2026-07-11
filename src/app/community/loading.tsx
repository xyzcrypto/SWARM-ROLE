// Instant paint for the community route: a chat-shaped skeleton that mirrors the
// app-style frame, so opening /community feels immediate while the server fetches
// history. Replaced by the real chat as soon as the page is ready.
export default function Loading() {
  return (
    <main className="relative flex h-[100svh] flex-col overflow-hidden pt-[4.75rem] sm:pt-20">
      <div className="mesh" />
      <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-2 pb-2 pt-2 sm:px-6 sm:pb-4 sm:pt-3 lg:px-8">
        <div className="mb-2 flex shrink-0 items-center justify-center sm:mb-3">
          <div className="h-6 w-40 animate-pulse rounded-full bg-white/5" />
        </div>

        <div className="glass relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
          {/* header */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-ink-900 px-4 py-3">
            <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-white/5" />
          </div>

          {/* messages */}
          <div className="min-h-0 flex-1 space-y-5 px-3 py-4 sm:px-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className={`flex items-start gap-3 ${i % 3 === 0 ? "opacity-90" : "opacity-70"}`}>
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/10" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                  <div className={`h-4 animate-pulse rounded bg-white/5 ${i % 2 ? "w-2/3" : "w-1/2"}`} />
                </div>
              </div>
            ))}
          </div>

          {/* composer */}
          <div className="border-t border-white/10 bg-ink-900/95 px-3 py-3 sm:px-4">
            <div className="h-11 w-full animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    </main>
  );
}
