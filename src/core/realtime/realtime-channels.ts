// Realtime channel / topic names, shared by the server (which broadcasts) and
// by `"use client"` components (which subscribe).
//
// These live in their own module, apart from `realtime.ts`, for one reason:
// **they must be importable from the browser, and `realtime.ts` must not be.**
//
// `realtime.ts` imports `@/lib/env` in order to reach `SUPABASE_SERVICE_ROLE_KEY`
// for `broadcastEvent`. Before this split, three client components imported
// `userChannel` from `realtime.ts`, which pulled the whole env module into the
// browser bundle: a zod schema, the server env's shape (including the
// service-role key's NAME), and a module-level `console.error` loop that the
// bundler stripped the `NODE_ENV` guard from — so every visitor to /journal and
// any profile page got two console errors reading like a production outage.
//
// `env.ts` now carries `import "server-only"`, so that regression is a build
// failure rather than something to notice in a console months later.
//
// Keep this file free of imports. The moment it needs one, check that the
// dependency is browser-safe first.

export const CH_SITE = "site-visitors"; // global presence → live-online count
export const CH_MEMBERS = "members"; // admin member-list live updates
export const CH_NOTIFY = "notifications"; // global "new notification" ping → bell refetch
export const userChannel = (userId: string) => `user:${userId}`; // per-user events
