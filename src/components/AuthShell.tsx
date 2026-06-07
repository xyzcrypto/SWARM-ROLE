import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="glow-orb left-[15%] top-[10%] h-64 w-64 bg-gold-600/20" />
      <div className="glow-orb right-[12%] bottom-[10%] h-72 w-72 bg-gold-400/15" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-5 inline-flex">
            <span className="relative inline-flex h-16 w-16 overflow-hidden rounded-full ring-2 ring-gold-500/40">
              <Image src="/logo.jpg" alt="XYZ Crypto" fill className="object-cover" sizes="64px" />
            </span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-zinc-50">{title}</h1>
          <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
        </div>

        <div className="glass rounded-3xl p-7 shadow-gold-sm">{children}</div>

        <p className="mt-6 text-center text-sm text-zinc-500">{footer}</p>
        <p className="mt-4 text-center">
          <Link href="/" className="text-xs text-zinc-600 transition-colors hover:text-gold-200">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
