"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Loader2, Radio, Volume2 } from "lucide-react";
import type { Room } from "livekit-client";
import { cn } from "@/lib/utils";

type Peer = { id: string; name: string; isLocal: boolean; muted: boolean; speaking: boolean };

// Telegram-style community voice room, powered by LiveKit (audio-only). Renders
// a slim "Join voice" bar; on join it expands to show who's talking (speaking
// rings) with mute + leave. livekit-client is dynamically imported so it never
// ships in the first-paint bundle. Gated on `enabled` (LiveKit env present).
export function VoiceRoom({ enabled, loggedIn }: { enabled: boolean; loggedIn: boolean }) {
  const [state, setState] = useState<"idle" | "connecting" | "live">("idle");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [muted, setMuted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const micTrackRef = useRef<{ mute: () => Promise<unknown>; unmute: () => Promise<unknown> } | null>(null);
  const mutedRef = useRef(false);
  const audioBin = useRef<HTMLDivElement>(null);

  const setMutedBoth = (v: boolean) => { mutedRef.current = v; setMuted(v); };

  const snapshot = useCallback((room: Room) => {
    const lp = room.localParticipant;
    const haveMic = !!micTrackRef.current;
    const list: Peer[] = [{ id: lp.identity, name: lp.name || "You", isLocal: true, muted: !haveMic || mutedRef.current, speaking: lp.isSpeaking }];
    room.remoteParticipants.forEach((p) => list.push({ id: p.identity, name: p.name || "Member", isLocal: false, muted: !p.isMicrophoneEnabled, speaking: p.isSpeaking }));
    setPeers(list);
  }, []);

  const leave = useCallback(() => {
    const room = roomRef.current;
    roomRef.current = null;
    micTrackRef.current = null;
    if (room) room.disconnect().catch(() => {});
    if (audioBin.current) audioBin.current.innerHTML = "";
    setPeers([]);
    setMutedBoth(false);
    setState("idle");
  }, []);

  useEffect(() => () => { roomRef.current?.disconnect().catch(() => {}); }, []);

  async function join() {
    if (state !== "idle") return;
    setErr(null);
    setState("connecting");

    // Acquire the mic INSIDE the click gesture and KEEP the stream - we publish
    // this exact track after connecting. Re-acquiring getUserMedia after an
    // await is what iOS/Safari block, so we never do that.
    let micStream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices?.getUserMedia) micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { micStream = null; }

    try {
      const res = await fetch("/api/voice/token", { method: "POST" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.token || !j?.url) {
        micStream?.getTracks().forEach((t) => t.stop());
        setErr(res.status === 401 ? "Please log in to join voice." : res.status === 503 ? "Voice chat isn't set up yet." : "Couldn't join. Try again.");
        setState("idle");
        return;
      }

      const { Room, RoomEvent, Track, LocalAudioTrack } = await import("livekit-client");
      const room = new Room({ adaptiveStream: false, dynacast: false });
      roomRef.current = room;

      room
        .on(RoomEvent.ParticipantConnected, () => snapshot(room))
        .on(RoomEvent.ParticipantDisconnected, () => snapshot(room))
        .on(RoomEvent.ActiveSpeakersChanged, () => snapshot(room))
        .on(RoomEvent.TrackMuted, () => snapshot(room))
        .on(RoomEvent.TrackUnmuted, () => snapshot(room))
        .on(RoomEvent.Disconnected, () => leave())
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio && audioBin.current) {
            const el = track.attach();
            (el as HTMLAudioElement).autoplay = true;
            audioBin.current.appendChild(el);
          }
        });

      await room.connect(j.url, j.token);
      await room.startAudio().catch(() => {}); // unlock autoplay so you can hear others

      if (micStream) {
        const [mst] = micStream.getAudioTracks();
        if (mst) {
          try {
            const track = new LocalAudioTrack(mst);
            await room.localParticipant.publishTrack(track);
            micTrackRef.current = track as unknown as { mute: () => Promise<unknown>; unmute: () => Promise<unknown> };
            setMutedBoth(false);
          } catch {
            micStream.getTracks().forEach((t) => t.stop());
            setErr("Couldn't turn your mic on - you're listening only.");
            setMutedBoth(true);
          }
        }
      } else {
        setErr("Mic blocked. Allow microphone for this site in your browser, then tap the mic to talk.");
        setMutedBoth(true);
      }
      snapshot(room);
      setState("live");
    } catch {
      micStream?.getTracks().forEach((t) => t.stop());
      setErr("Couldn't connect to voice. Try again.");
      leave();
    }
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const track = micTrackRef.current;
    if (track) {
      try {
        if (mutedRef.current) await track.unmute(); else await track.mute();
        setMutedBoth(!mutedRef.current);
        setErr(null);
        snapshot(room);
      } catch { setErr("Couldn't toggle your mic."); }
      return;
    }
    // No mic track yet (blocked on join) - retry from THIS tap gesture, which is
    // a fresh user-activation and usually unblocks getUserMedia.
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      const pub = [...room.localParticipant.audioTrackPublications.values()][0];
      if (pub?.track) micTrackRef.current = pub.track as unknown as { mute: () => Promise<unknown>; unmute: () => Promise<unknown> };
      setMutedBoth(false);
      setErr(null);
      snapshot(room);
    } catch {
      setErr("Couldn't access your mic. Allow microphone access for this site in your browser settings.");
    }
  }

  if (!enabled) return null;

  return (
    <div className="shrink-0">
      <div ref={audioBin} className="hidden" aria-hidden />
      {state === "idle" ? (
        <div className="flex justify-center">
          <button
            onClick={loggedIn ? join : undefined}
            disabled={!loggedIn}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              loggedIn
                ? "border-mint-500/30 bg-mint-500/10 text-mint-600 hover:bg-mint-500/15 dark:text-mint-200"
                : "cursor-not-allowed border-black/10 text-zinc-400 dark:border-white/10"
            )}
            title={loggedIn ? "Join the live voice room" : "Log in to join voice"}
          >
            <Radio className="h-3.5 w-3.5" /> {loggedIn ? "Join voice" : "Log in for voice"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-mint-500/25 bg-mint-500/[0.06] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-mint-600 dark:text-mint-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-400" />
              </span>
              {state === "connecting" ? "Connecting…" : `Live · ${peers.length} in voice`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                disabled={state !== "live"}
                aria-label={muted ? "Unmute" : "Mute"}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full transition-colors",
                  muted ? "bg-red-500/15 text-red-500 dark:text-red-300" : "bg-mint-500/15 text-mint-600 dark:text-mint-200"
                )}
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={leave}
                aria-label="Leave voice"
                className="grid h-9 w-9 place-items-center rounded-full bg-red-500 text-white transition-transform hover:scale-105"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            </div>
          </div>

          {state === "connecting" ? (
            <p className="py-2 text-center text-xs text-zinc-500"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Joining the room…</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {peers.map((p) => (
                <div key={p.id} className="flex w-14 flex-col items-center gap-1">
                  <span
                    className={cn(
                      "relative grid h-11 w-11 place-items-center rounded-full text-sm font-semibold ring-2 transition-all",
                      p.speaking ? "bg-mint-500/25 text-mint-700 ring-mint-400 dark:text-mint-100" : "bg-black/5 text-zinc-600 ring-transparent dark:bg-white/10 dark:text-zinc-200"
                    )}
                  >
                    {p.name.charAt(0).toUpperCase()}
                    <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-white dark:bg-ink-900">
                      {p.muted ? <MicOff className="h-2.5 w-2.5 text-red-500" /> : <Volume2 className="h-2.5 w-2.5 text-mint-500" />}
                    </span>
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-zinc-500">{p.isLocal ? "You" : p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {err && <p className="mt-1.5 text-center text-[11px] text-amber-500">{err}</p>}
    </div>
  );
}
