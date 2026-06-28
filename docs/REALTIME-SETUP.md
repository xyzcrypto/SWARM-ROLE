# Realtime setup — live "who's online" + instant sound

This is the **one-time ops step** that turns on the Community Chat's live presence
(the "who's online" avatar strip + online count) and **instant** message/reaction
sound. Without it the chat still works, but it quietly falls back to 10-second
polling: no presence, no instant push, and the blip can't play in real time.

> **Why a setup step at all?** Presence and broadcast are powered by **Supabase
> Realtime**. The browser subscribes to the public `community` channel; the server
> pushes events to it. Both halves need Supabase keys in the environment. The code
> is already shipped and degrades gracefully — it's just waiting for these keys.

You already have a Supabase project (the database lives there), so this is only
about copying keys into Vercel. ~5 minutes.

---

## Step 1 — Copy the keys from Supabase

Supabase dashboard → your project → **Settings → API**. Copy three values:

| In Supabase (Settings → API) | What it is |
| --- | --- |
| **Project URL** | e.g. `https://abcdxyz.supabase.co` |
| **Project API keys → `anon` `public`** | public, client-safe key |
| **Project API keys → `service_role`** | **secret** server key — never expose client-side |

> **Already handled in code — don't remove it:** the site's Content-Security-Policy
> (`next.config.mjs`, `connect-src`) must allow `https://*.supabase.co` and
> `wss://*.supabase.co`, or the browser silently blocks the Realtime WebSocket and
> presence/sound never connect (symptom: header stuck on "Connecting…", console shows
> a `Refused to connect to 'wss://…supabase.co'` CSP error). This is configured —
> just don't tighten `connect-src` back without re-adding Supabase.

## Step 2 — Confirm Realtime is on (usually nothing to do)

Supabase enables **Broadcast** and **Presence** by default. This app uses two
**public** channels — `community` (chat) and `site-visitors` (global online count)
— which need **no RLS policy** to work.

- On a standard project: nothing to toggle. Skip to Step 3.
- Only if someone has turned on **Realtime Authorization / private channels** for
  this project (Database → Realtime settings): these channels are used as public
  (`private: false`), so leave public broadcast/presence allowed, or they won't
  connect.

## Step 3 — Add the env vars in Vercel

Vercel → your project → **Settings → Environment Variables**. Add all four for
**Production** (and Preview/Development if you want it there too). Use these exact
names — the code reads them verbatim:

| Name | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | the Project URL | public — used by the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon` `public` key | public by design |
| `SUPABASE_URL` | the **same** Project URL | server — used to broadcast |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key | **secret** — server only |

Notes:
- The two `NEXT_PUBLIC_*` keys are **meant** to be public; the `anon` key only
  grants what channel/RLS policy allows.
- **Never** prefix the `service_role` key with `NEXT_PUBLIC_` — that would leak a
  full-access key into the browser bundle.
- If you already set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for image
  uploads, you only need to add the two `NEXT_PUBLIC_*` ones. (Mirrors
  `.env.example`.)

## Step 4 — Redeploy

The `NEXT_PUBLIC_*` values are **baked into the build**, so they only take effect
on a fresh build. After saving the vars, trigger a new deploy (Vercel →
Deployments → **Redeploy**, or push any commit). Saving alone is not enough.

## Step 5 — Verify it works

Open `/community` in **two** different browsers (or a phone + laptop), logged in as
**two different users**:

1. **Live online** — the header dot reads **"Live"** (not "Connecting…"), the
   **avatar strip** shows both members, and the pill shows **"2 online"**.
2. **Sound** — tap the **speaker icon** in the chat header to turn sound on. That
   tap unlocks audio and plays a short confirmation **blip** (browsers require a
   tap before any sound — this is normal).
3. **Message sound** — have the other user send a message → you hear a blip.
4. **Emoji sound** — have the other user **react** to a message with an emoji →
   you hear a blip. (You never hear your own messages/reactions — by design.)

### Troubleshooting
- **Header stuck on "Connecting…" / "0 online":** the four env vars aren't all set,
  or you saved them but haven't **redeployed**. Re-check Step 3 + Step 4.
- **Presence works but no sound:** the speaker toggle is off, or your device/tab is
  muted, or you haven't tapped anything on the page yet (audio stays locked until a
  user gesture). Tap the speaker once.
- **Only one person shows as online:** both tabs must be logged in and on
  `/community`; presence de-dupes the same user across tabs to one.
- **Messages arrive but slowly (~10s) with no presence:** you're in the polling
  fallback → env vars not active yet. Same fix as the first item.

---

_Code references: client subscribe `src/components/ChatClient.tsx`; server
broadcast `src/lib/realtime.ts` (`broadcastEvent`) + `src/lib/chat.ts`; realtime
flag `src/lib/env.ts` (`realtimeEnabled`); config passed in
`src/app/community/page.tsx`._
