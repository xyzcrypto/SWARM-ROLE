// "What's New" homepage feed. Add an entry to the TOP of this array whenever a
// new feature ships - the homepage section updates automatically. Keep it short
// (the section shows the most recent few). Dates are ISO yyyy-mm-dd.
export type WhatsNewEntry = {
  date: string;
  tag: "New" | "Improved" | "Fixed";
  title: string;
  body: string;
};

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
