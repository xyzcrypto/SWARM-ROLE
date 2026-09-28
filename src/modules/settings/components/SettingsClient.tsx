"use client";

import { useEffect, useRef, useState } from "react";
import { chatPressFeedback } from "@shared/utils/chat-feedback";
import { ChatFeelSections } from "@modules/community/components/ChatFeelSections";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, MapPin, Globe, ExternalLink, ShieldAlert, ImageUp } from "lucide-react";
import { XIcon, GitHubIcon, TelegramIcon, DiscordIcon, YouTubeIcon, LinkedInIcon, InstagramIcon } from "@/components/BrandIcons";
import { Avatar } from "@/components/Avatar";
import { AvatarUploader } from "@/components/AvatarUploader";
import { PasswordField } from "@/components/PasswordField";
import { Badge } from "@/components/ui/primitives";
import { USERNAME_RE, normalizeUsername } from "@/lib/profile";
import { compressImage } from "@/lib/image";
import { uploadFileWithProgress } from "@/lib/upload";
import { formatDate } from "@/lib/utils";

type SettingsUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  bannerImage: string | null;
  username: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  twitter: string | null;
  github: string | null;
  telegram: string | null;
  dmPrivacy?: string | null;
  discord: string | null;
  youtube: string | null;
  linkedin: string | null;
  instagram: string | null;
  role: string;
  membership: string;
  provider: string;
  hasPassword: boolean;
  createdAt: string;
};

type Tab = "profile" | "account" | "security" | "feel";

export function SettingsClient({ user }: { user: SettingsUser }) {
  const [tab, setTab] = useState<Tab>("profile");

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "account", label: "Account" },
    { id: "security", label: "Security" },
    { id: "feel", label: "Haptics & sound" },
  ];

  const isPremium = user.membership === "Premium";
  const isAdmin = user.role === "ADMIN";

  return (
    // Every control here gets the member's haptic / sound press feedback.
    <div onPointerDownCapture={chatPressFeedback}>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-mint-400">Your dashboard</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-zinc-50 sm:text-4xl">
          Account &amp; profile
        </h1>
      </div>

      {/* Identity card */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-mint-500/20 bg-gradient-to-br from-mint-500/[0.07] via-white/[0.02] to-transparent p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.name} image={user.image} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-zinc-50">{user.name ?? "Member"}</h2>
              {isAdmin ? (
                <Badge tone="mint">Team</Badge>
              ) : isPremium ? (
                <Badge tone="gold">★ Premium</Badge>
              ) : (
                <Badge tone="neutral">Free</Badge>
              )}
            </div>
            <p className="mono text-sm text-zinc-500">
              {user.username ? `@${user.username}` : "Set a handle below"} · Member since {formatDate(user.createdAt)}
            </p>
          </div>
          {user.username && (
            <Link
              href={`/u/${user.username}`}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-mint-500/30 bg-mint-500/10 px-3 py-2 text-[13px] font-medium text-mint-200 transition-colors hover:bg-mint-500/20"
            >
              View public profile <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2 border-b border-white/10 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-b-2 border-mint-400 text-mint-100 shadow-[0_6px_16px_-8px_rgba(11,187,124,0.6)]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "profile" && <ProfilePanel user={user} />}
          {tab === "account" && <AccountPanel user={user} />}
          {tab === "security" && <SecurityPanel user={user} />}
          {tab === "feel" && (
            <div className="glass rounded-3xl p-5 sm:p-6">
              <p className="font-display text-lg font-semibold text-zinc-50">Haptics, sounds &amp; chat style</p>
              <p className="mt-1 text-[13px] text-zinc-500">Saved on this device. Also in any chat under 🎨 Chat appearance.</p>
              <ChatFeelSections />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------- Profile ------------------------------- */
function ProfilePanel({ user }: { user: SettingsUser }) {
  const { update } = useSession();
  const [image, setImage] = useState(user.image);
  const [banner, setBanner] = useState(user.bannerImage ?? "");
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [bannerProgress, setBannerProgress] = useState(0);
  const [bannerErr, setBannerErr] = useState("");
  const [name, setName] = useState(user.name ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [location, setLocation] = useState(user.location ?? "");
  const [website, setWebsite] = useState(user.website ?? "");
  const [twitter, setTwitter] = useState(user.twitter ?? "");
  const [github, setGithub] = useState(user.github ?? "");
  const [telegram, setTelegram] = useState(user.telegram ?? "");
  const [dmPrivacy, setDmPrivacy] = useState(user.dmPrivacy ?? "everyone");
  const [discord, setDiscord] = useState(user.discord ?? "");
  const [youtube, setYoutube] = useState(user.youtube ?? "");
  const [linkedin, setLinkedin] = useState(user.linkedin ?? "");
  const [instagram, setInstagram] = useState(user.instagram ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Live handle availability check (debounced).
  const [handleState, setHandleState] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const normalizedHandle = normalizeUsername(username);
  const handleChanged = normalizedHandle !== (user.username ?? "");

  useEffect(() => {
    if (!handleChanged || normalizedHandle === "") {
      setHandleState("idle");
      return;
    }
    if (!USERNAME_RE.test(normalizedHandle)) {
      setHandleState("invalid");
      return;
    }
    setHandleState("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile/username?handle=${encodeURIComponent(normalizedHandle)}`);
        const data = await res.json().catch(() => ({}));
        setHandleState(data.available ? "ok" : "taken");
      } catch {
        setHandleState("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [normalizedHandle, handleChanged]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    // Only block on locally-knowable problems; "taken" may be stale, so the
    // server's uniqueness check (409) stays the source of truth on save.
    if (handleState === "invalid") {
      setError("Please choose a valid handle.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username: normalizedHandle || undefined,
          // A directly-uploaded banner is already saved server-side by
          // /api/profile/banner (and may be a data: URL the profile schema would
          // reject) — so only send a pasted https link through this form save.
          bannerImage: banner.trim() && !banner.trim().startsWith("data:") ? banner.trim() : undefined,
          bio,
          location,
          website,
          twitter,
          github,
          telegram,
          discord,
          youtube,
          linkedin,
          instagram,
          dmPrivacy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save changes.");
        return;
      }
      setSaved(true);
      fetch("/api/xp/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "profile_update" }),
      }).catch(() => {});
      await update(); // refresh session so navbar/name/avatar update immediately
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onPickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setBannerErr("");
    setBannerBusy(true);
    setBannerProgress(0);
    try {
      const upload = await compressImage(file, 1280);
      if (upload.size > 5 * 1024 * 1024) {
        setBannerErr("Image is too large (max 5 MB).");
        return;
      }
      const { ok, status, data } = await uploadFileWithProgress("/api/profile/banner", upload, setBannerProgress);
      if (!ok) {
        const hint = status === 501 ? " You can paste an image URL instead." : "";
        setBannerErr((data.error || "Upload failed.") + hint);
        return;
      }
      setBanner(data.url); // banner saved server-side already; reflect it here
    } catch {
      setBannerErr("Network error. Please try again.");
    } finally {
      setBannerBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="surface rounded-2xl p-5 sm:p-6">
        <AvatarUploader
          name={name}
          image={image}
          onUploaded={async (url) => {
            setImage(url);
            await update();
          }}
        />
      </div>

      <div className="surface space-y-3 rounded-2xl p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Profile cover image</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Upload an image from your device, or paste a direct https link. It shows as the banner on your
            public profile. JPG, PNG, WebP or GIF · max 5 MB.
          </p>
        </div>
        <div
          className="h-24 w-full overflow-hidden rounded-xl border border-white/10 bg-gold-shine"
          style={
            banner.trim()
              ? { backgroundImage: `url(${banner.trim()})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={bannerBusy}
            className="btn-secondary inline-flex items-center gap-2 !py-2 text-[13px] disabled:opacity-60"
          >
            {bannerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
            {bannerBusy ? `Uploading… ${bannerProgress}%` : "Upload cover"}
          </button>
        </div>
        {bannerBusy && (
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-mint-shine transition-all duration-200" style={{ width: `${bannerProgress}%` }} />
          </div>
        )}
        {bannerErr && <p className="text-[11px] text-red-300">{bannerErr}</p>}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Or paste a link</label>
          <input
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
            placeholder="https://…"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-mint-500/50 focus:ring-2 focus:ring-mint-500/20"
          />
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          onChange={onPickBanner}
          className="hidden"
        />
      </div>

      <div className="surface space-y-4 rounded-2xl p-5 sm:p-6">
        <Field label="Display name" value={name} onChange={setName} placeholder="Satoshi Nakamoto" />

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Handle
          </span>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-700/60 px-3 transition-colors focus-within:border-gold-500/50 focus-within:ring-2 focus-within:ring-gold-500/30">
            <span className="text-sm text-zinc-500">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourhandle"
              autoCapitalize="none"
              autoComplete="off"
              className="w-full bg-transparent py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            {handleChanged && (
              <span className="shrink-0 text-xs">
                {handleState === "checking" && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
                {handleState === "ok" && <span className="text-mint-300">Available</span>}
                {handleState === "taken" && <span className="text-red-300">Taken</span>}
                {handleState === "invalid" && <span className="text-amber-300">Invalid</span>}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-600">
            3-20 chars: lowercase letters, numbers or _. Your public profile lives at{" "}
            <span className="mono text-zinc-500">/u/{normalizedHandle || "handle"}</span>.
          </p>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Bio
          </span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Web3 builder, trader, researcher…"
            className="w-full resize-none rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
          />
          <p className="mt-1 text-right text-[11px] text-zinc-600">{bio.length}/500</p>
        </label>

        <Field label="Location" value={location} onChange={setLocation} placeholder="Dubai, UAE" icon={<MapPin className="h-4 w-4" />} />
        <Field label="Website" value={website} onChange={setWebsite} placeholder="https://yoursite.com" icon={<Globe className="h-4 w-4" />} />
      </div>

      <div className="surface space-y-4 rounded-2xl p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Social links</p>
        <Field label="X (Twitter)" value={twitter} onChange={setTwitter} placeholder="handle" icon={<XIcon className="h-3.5 w-3.5" />} prefix="x.com/" />
        <Field label="Telegram" value={telegram} onChange={setTelegram} placeholder="handle" icon={<TelegramIcon className="h-4 w-4" />} prefix="t.me/" />
        <Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="handle" icon={<InstagramIcon className="h-4 w-4" />} prefix="instagram.com/" />
        <Field label="YouTube" value={youtube} onChange={setYoutube} placeholder="handle" icon={<YouTubeIcon className="h-4 w-4" />} prefix="youtube.com/@" />
        <Field label="Discord" value={discord} onChange={setDiscord} placeholder="invite code" icon={<DiscordIcon className="h-4 w-4" />} prefix="discord.gg/" />
        <Field label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="slug" icon={<LinkedInIcon className="h-4 w-4" />} prefix="linkedin.com/in/" />
        <Field label="GitHub" value={github} onChange={setGithub} placeholder="handle" icon={<GitHubIcon className="h-4 w-4" />} prefix="github.com/" />
      </div>

      {/* Privacy - who may start a DM with you. Only gates NEW conversations:
          tightening this does not cut off threads already open, because that is
          what blocking is for. */}
      <div className="surface space-y-3 rounded-2xl p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Privacy</p>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-zinc-300">Who can message me</span>
          <select
            value={dmPrivacy}
            onChange={(e) => setDmPrivacy(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 text-[14px] text-zinc-100 outline-none focus:border-gold-500/40"
          >
            <option value="everyone">Everyone</option>
            <option value="following">Only people I follow</option>
            <option value="nobody">Nobody</option>
          </select>
        </label>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          This decides who can start a new conversation with you. Conversations
          you already have keep working - use Block in a thread to end one.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>
      )}
      {saved && !error && (
        <p className="inline-flex items-center gap-2 rounded-lg bg-mint-500/10 px-3 py-2 text-sm text-mint-200 ring-1 ring-mint-500/20">
          <Check className="h-4 w-4" /> Profile saved.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
          {saving ? "Saving…" : "Save changes"}
        </button>
        {user.username && (
          <Link
            href={`/u/${user.username}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-200 hover:underline"
          >
            View public profile <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </form>
  );
}

/* ------------------------------- Account ------------------------------- */
function AccountPanel({ user }: { user: SettingsUser }) {
  const isPremium = user.membership === "Premium";
  return (
    <div className="space-y-5">
      <div className="surface rounded-2xl p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Membership</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge tone={isPremium ? "gold" : "neutral"}>{isPremium ? "★ Premium" : "Free"}</Badge>
            <span className="text-sm text-zinc-400">
              {isPremium ? "You have full access to premium research." : "Upgrade to unlock premium research & tools."}
            </span>
          </div>
          {!isPremium && (
            <Link href="/premium" className="btn-gold !py-2 text-[13px]">
              Upgrade to Premium
            </Link>
          )}
        </div>
      </div>

      <div className="surface rounded-2xl p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Account details</p>
        <dl className="mt-3 space-y-2.5 text-sm">
          <Row label="Email" value={user.email} />
          <Row label="Sign-in method" value={user.provider === "google" ? "Google" : "Email & password"} />
          <Row label="Member since" value={formatDate(user.createdAt)} />
          {user.role === "ADMIN" && <Row label="Role" value="Admin" />}
        </dl>
      </div>
    </div>
  );
}

/* ------------------------------- Security ------------------------------ */
function SecurityPanel({ user }: { user: SettingsUser }) {
  return (
    <div className="space-y-6">
      {user.hasPassword ? (
        <ChangePassword />
      ) : (
        <div className="surface rounded-2xl p-5 text-sm text-zinc-400 sm:p-6">
          You sign in with Google, so there&apos;s no password to change. You can set one
          anytime via{" "}
          <Link href="/forgot-password" className="font-medium text-gold-200 hover:underline">
            Forgot password
          </Link>
          .
        </div>
      )}
      <DangerZone />
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);
    setSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not change password.");
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 rounded-2xl p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Change password</p>
      <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" strength />
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>
      )}
      {done && !error && (
        <p className="inline-flex items-center gap-2 rounded-lg bg-mint-500/10 px-3 py-2 text-sm text-mint-200 ring-1 ring-mint-500/20">
          <Check className="h-4 w-4" /> Password updated.
        </p>
      )}
      <button type="submit" disabled={saving} className="btn-gold disabled:opacity-60">
        {saving ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not delete account.");
        setBusy(false);
        return;
      }
      await signOut({ redirect: false });
      router.push("/");
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-5 sm:p-6">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-300">
        <ShieldAlert className="h-4 w-4" /> Danger zone
      </p>
      <p className="mt-2 text-sm text-zinc-400">
        Permanently delete your account, profile, comments and likes. This cannot be undone.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-ghost mt-4 !border-red-500/30 text-red-200">
          Delete account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs text-zinc-400">
              Type <span className="mono text-red-300">DELETE</span> to confirm
            </span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={remove}
              disabled={confirm !== "DELETE" || busy}
              className="btn-ghost !border-red-500/40 bg-red-500/10 text-red-200 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button onClick={() => { setOpen(false); setConfirm(""); setError(""); }} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- shared -------------------------------- */
function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-700/60 px-3 transition-colors focus-within:border-gold-500/50 focus-within:ring-2 focus-within:ring-gold-500/30">
        {icon && <span className="shrink-0 text-zinc-500">{icon}</span>}
        {prefix && <span className="shrink-0 text-sm text-zinc-600">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-transparent py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </div>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-200">{value}</dd>
    </div>
  );
}
