// Instant, layout-shaped skeleton for the Trading Journal - previews the tab
// bar, stat tiles and trade rows so the page feels immediate while the server
// does its (relatively heavy) trade + risk-profile fetch. Replaces the
// generic branded spinner.
export default function Loading() {
  return (
    <main className="relative min-h-screen pt-28">
      <div className="mesh" />
      <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="h-8 w-56 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-white/5" />

        {/* tab bar */}
        <div className="mt-6 flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>

        {/* stat tiles */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>

        {/* trade rows */}
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
