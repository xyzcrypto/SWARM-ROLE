"use client";

import { signIn } from "next-auth/react";
import { GoogleIcon, GitHubIcon, XIcon } from "@/components/BrandIcons";

export type SocialProviders = { google: boolean; github: boolean; twitter: boolean };

const BTN =
  "flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 transition-all hover:border-white/20 hover:bg-white/10";

/**
 * One-tap OAuth logins (Google / GitHub / X). Each button renders only when
 * its provider is configured (env-gated server-side), so an unconfigured
 * provider simply doesn't exist in the UI.
 */
export function SocialButtons({
  providers,
  mode = "in",
  callbackUrl = "/",
}: {
  providers: SocialProviders;
  mode?: "in" | "up";
  callbackUrl?: string;
}) {
  const verb = mode === "up" ? "Sign up" : "Sign in";
  const any = providers.google || providers.github || providers.twitter;
  if (!any) return null;
  return (
    <div className="space-y-2.5">
      {providers.google && (
        <button type="button" onClick={() => signIn("google", { callbackUrl })} className={BTN}>
          <GoogleIcon className="h-5 w-5" />
          {verb} with Google
        </button>
      )}
      {providers.github && (
        <button type="button" onClick={() => signIn("github", { callbackUrl })} className={BTN}>
          <GitHubIcon className="h-5 w-5" />
          {verb} with GitHub
        </button>
      )}
      {providers.twitter && (
        <button type="button" onClick={() => signIn("twitter", { callbackUrl })} className={BTN}>
          <XIcon className="h-5 w-5" />
          {verb} with X
        </button>
      )}
    </div>
  );
}
