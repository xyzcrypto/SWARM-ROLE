// Instant, layout-shaped skeleton for a profile - previews the banner, avatar,
// name and stat tiles the moment you navigate, so the profile feels immediate
// while the server renders. Replaces the generic branded spinner.
export default function Loading() {
  return (
    <main className="relative min-h-screen pt-20">
      <div className="mesh" />
      <div className="relative mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* banner */}
        <div className="mt-6 h-40 w-full animate-pulse rounded-3xl bg-white/5 sm:h-52" />
        {/* avatar + name */}
        <div className="-mt-12 flex flex-col items-start gap-3 px-2 sm:-mt-14">
          <div className="h-24 w-24 animate-pulse rounded-full bg-white/10 ring-4 ring-ink-950 sm:h-28 sm:w-28" />
          <div className="space-y-2">
            <div className="h-6 w-44 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-28 animate-pulse rounded bg-white/5" />
          </div>
        </div>
        {/* stat tiles */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
        {/* content cards */}
        <div className="mt-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    </main>
  );
}
