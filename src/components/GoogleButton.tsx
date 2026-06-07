"use client";

import { signIn } from "next-auth/react";
import { GoogleIcon } from "./BrandIcons";

export function GoogleButton({
  enabled,
  label = "Continue with Google",
}: {
  enabled: boolean;
  label?: string;
}) {
  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/" })}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 transition-all hover:border-white/20 hover:bg-white/10"
    >
      <GoogleIcon className="h-5 w-5" />
      {label}
    </button>
  );
}
