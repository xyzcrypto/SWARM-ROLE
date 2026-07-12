# Community Voice Rooms (LiveKit)

Telegram-style **live voice chat** in the community lounge — one shared room
("xyz-lounge") where members join, talk, and listen. Audio-only, powered by
[LiveKit](https://livekit.io). Off until configured; the "Join voice" bar only
appears once the env below is set.

## How it works
- **`/api/voice/token`** (server, logged-in + rate-limited) mints a short-lived
  LiveKit access token signed with the API key/secret, granting the member
  publish + subscribe on the room. The secret never leaves the server.
- **`VoiceRoom.tsx`** (client) connects to LiveKit with that token using
  `livekit-client` (dynamically imported, so it isn't in the first-paint bundle),
  turns the mic on, renders who's talking (speaking rings + mute state), and
  handles mute / leave. Remote audio is attached to hidden `<audio>` elements.
- Gated on `voiceEnabled` (`src/lib/env.ts`) — all three vars must be set.

## Owner setup (one-time, ~5 min)

### 1. Create a LiveKit Cloud project (free tier)
1. Go to **[cloud.livekit.io](https://cloud.livekit.io)** → sign up → **Create Project**.
2. Open the project → **Settings → Keys** → **Create Key** (or use the default).
3. Copy three values:
   - **API Key** (starts `API...`)
   - **API Secret**
   - **Project URL / WebSocket URL** (`wss://<your-project>.livekit.cloud`)

### 2. Add to Vercel env (Production)
Vercel → xyzcrypto → **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `LIVEKIT_API_KEY` | the API Key |
| `LIVEKIT_API_SECRET` | the API Secret 🔒 |
| `NEXT_PUBLIC_LIVEKIT_URL` | `wss://<your-project>.livekit.cloud` |

Then **redeploy**. The "Join voice chat" bar appears on `/community`.

## Notes
- **No database / migration** needed — voice is entirely LiveKit + a token route.
- **Free tier** covers a lot of monthly minutes; heavy usage may incur cost (see
  LiveKit pricing). The room name is fixed (`xyz-lounge`) in `api/voice/token`.
- **CSP** already allows `wss://*.livekit.cloud` + blob workers (`next.config.mjs`).
- Mic permission is asked on join; if denied, the member stays connected as a
  **listener** (a clear message shows).
