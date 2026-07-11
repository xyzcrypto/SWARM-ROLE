// Instant, layout-shaped skeleton for the admin dashboard - previews the title,
// stat tiles and table rows so the dashboard feels immediate while the server
// gathers analytics. Replaces the generic branded spinner.
export default function Loading() {
  return (
    <main className="relative min-h-screen pt-24">
      <div className="mesh" />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-white/5" />

        {/* stat tiles */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>

        {/* table / list */}
        <div className="mt-6 space-y-2 rounded-2xl border border-white/10 p-4">
          <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="h-4 flex-1 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-16 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-12 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
