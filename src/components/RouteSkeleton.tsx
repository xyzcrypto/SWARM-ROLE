// Lightweight loading skeleton shown instantly during route transitions (via
// each route's loading.tsx). Server component, no JS - paints immediately so
// navigation never feels blocked.
export function RouteSkeleton() {
  return (
    <main className="relative min-h-screen pt-28">
      <div className="mesh" />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        <div className="h-9 w-3/4 animate-pulse rounded-lg bg-white/5" />
        <div className="mt-4 h-4 w-1/3 animate-pulse rounded bg-white/5" />
        <div className="mt-8 aspect-[16/9] w-full animate-pulse rounded-2xl bg-white/5" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-white/5"
              style={{ width: `${100 - i * 6}%` }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
