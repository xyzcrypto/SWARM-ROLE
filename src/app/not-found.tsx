import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="mono text-sm uppercase tracking-[0.22em] text-gold-300">404</p>
      <h1 className="mt-4 font-display text-4xl font-semibold text-zinc-50 sm:text-5xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-zinc-400">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn-primary">Back home</Link>
        <Link href="/academy/research" className="btn-secondary">Browse research</Link>
      </div>
    </main>
  );
}
