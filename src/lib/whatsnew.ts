// "What's New" feed types + seed/fallback content. Live entries are now stored in
// the DB (model WhatsNewEntry) and managed from the dashboard (auto-created on
// research publish + manual staff entries). This array seeds the DB and is shown
// as a graceful fallback if the table is empty or not migrated yet.

export const WHATS_NEW_TAGS = [
  "New",
  "Improved",
  "Fixed",
  "Announcement",
  "Security",
  "Roadmap",
] as const;

export type WhatsNewTag = (typeof WHATS_NEW_TAGS)[number];

export type WhatsNewEntry = {
  id?: string;
  date: string; // ISO date/datetime
  tag: WhatsNewTag;
  title: string;
  body: string;
};

export function isWhatsNewTag(v: unknown): v is WhatsNewTag {
  return typeof v === "string" && (WHATS_NEW_TAGS as readonly string[]).includes(v);
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    date: "2026-06-14",
    tag: "New",
    title: "In-app notifications",
    body: "A bell in the navbar now alerts you to new research and replies, with unread badges on the bell and community chat.",
  },
  {
    date: "2026-06-14",
    tag: "Improved",
    title: "Faster, smoother navigation",
    body: "Pages now open instantly with polished transitions and tactile button animations across the site.",
  },
  {
    date: "2026-06-14",
    tag: "New",
    title: "Clickable member profiles",
    body: "Tap any name or avatar in the community chat or post comments to view that member's public profile.",
  },
  {
    date: "2026-06-14",
    tag: "Improved",
    title: "Refined orbital ecosystem",
    body: "The signature ecosystem showcase has a richer, smoother animation on desktop.",
  },
];
