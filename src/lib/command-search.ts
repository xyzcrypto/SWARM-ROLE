// Command palette — pure, client-safe search logic (no server imports) so the
// ranking and visibility rules are unit-testable. The panel component supplies
// the viewer context; this module decides what exists and how it ranks.

/** Window event that opens the command palette (dispatched by the navbar button). */
export const XYZ_CMDK_EVENT = "xyz:cmdk";

export type CommandCtx = { loggedIn: boolean; staff: boolean };

export type CommandItem = {
  id: string;
  group: "pages" | "actions";
  label: string;
  hint?: string;
  /** Navigate here when chosen (mutually exclusive with `action`). */
  href?: string;
  /** Client action the panel dispatches ("ai" opens the XYZ AI widget). */
  action?: "ai";
  keywords: string[];
  authOnly?: boolean;
  staffOnly?: boolean;
};

export const STATIC_COMMANDS: CommandItem[] = [
  { id: "home", group: "pages", label: "Home", href: "/", keywords: ["home", "start", "landing"] },
  { id: "markets", group: "pages", label: "Markets", hint: "Live prices, DeFi, perps", href: "/markets", keywords: ["markets", "price", "coins", "charts", "defi", "perp"] },
  { id: "news", group: "pages", label: "News", hint: "Live Web3 news", href: "/news", keywords: ["news", "headlines", "breaking"] },
  { id: "research", group: "pages", label: "Research", hint: "Articles & analysis", href: "/research", keywords: ["research", "articles", "analysis", "posts"] },
  { id: "community", group: "pages", label: "Community", hint: "Live chat", href: "/community", keywords: ["community", "chat", "talk"] },
  { id: "premium", group: "pages", label: "Premium", href: "/premium", keywords: ["premium", "upgrade", "membership", "plans"] },
  { id: "settings", group: "pages", label: "Settings", href: "/settings", keywords: ["settings", "profile", "account"], authOnly: true },
  { id: "dashboard", group: "pages", label: "Admin Dashboard", href: "/dashboard", keywords: ["dashboard", "admin", "manage"], staffOnly: true },
  { id: "ask-ai", group: "actions", label: "Ask XYZ AI", hint: "Open the AI assistant", action: "ai", keywords: ["ai", "ask", "assistant", "xyz ai", "question", "chatbot"] },
];

/** Score a query against a label + keywords. 0 = no match. */
export function scoreCommand(item: Pick<CommandItem, "label" | "keywords">, q: string): number {
  const query = q.trim().toLowerCase();
  if (!query) return 1; // empty query → show all (browse mode)
  const label = item.label.toLowerCase();
  if (label.startsWith(query)) return 4;
  if (label.split(/\s+/).some((w) => w.startsWith(query))) return 3;
  if (label.includes(query)) return 2;
  if (item.keywords.some((k) => k.startsWith(query) || k.includes(query))) return 1;
  return 0;
}

/** Visible, ranked static commands for this viewer + query. */
export function filterCommands(q: string, ctx: CommandCtx, items: CommandItem[] = STATIC_COMMANDS): CommandItem[] {
  return items
    .filter((i) => (!i.authOnly || ctx.loggedIn) && (!i.staffOnly || ctx.staff))
    .map((i) => ({ i, s: scoreCommand(i, q) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .map(({ i }) => i);
}
