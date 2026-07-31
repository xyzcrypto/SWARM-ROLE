"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

let cached: Promise<SupabaseClient> | null = null;

/**
 * One shared Supabase Realtime client for the whole browser tab. Every
 * realtime/presence hook in this app (useRealtime, useLivePresence,
 * useUserOnline, RealtimeSession, WhatsNewFeed, ChatClient, NavActivity,
 * DashboardClient) used to call createClient() itself, each opening its own
 * physical WebSocket connection to the same Supabase project - a single page
 * (e.g. any page with the navbar's NavActivity + the global RealtimeSession
 * both mounted) could open several redundant connections for no benefit,
 * since Supabase multiplexes any number of channel subscriptions over one
 * client connection. Reusing this getter collapses that to one connection
 * per tab, which is what actually counts against a Realtime plan's
 * concurrent-connection limit.
 */
export function getRealtimeClient(url: string, anonKey: string): Promise<SupabaseClient> {
  if (!cached) {
    cached = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { reconnectAfterMs: (tries: number) => Math.min(1000 * 2 ** tries, 60_000) },
      })
    );
  }
  return cached;
}
