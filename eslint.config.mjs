import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Next 16 removed the `next lint` subcommand, so we run ESLint 9 directly
// (`eslint src`). eslint-config-next 16 ships a native flat config, so we
// consume `core-web-vitals` straight (no FlatCompat) - same ruleset we used
// under Next 14's `.eslintrc.json`, so this is a build-tooling migration, not a
// lint-policy change (deliberately not adding the stricter `next/typescript`).
export default [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  {
    // eslint-plugin-react-hooks v6 (from eslint-config-next 16) adds several
    // React-Compiler-era rules that flagged pre-existing patterns when we moved
    // to Next 16. They were all downgraded to warn so the framework upgrade
    // wasn't blocked; each is promoted back to error as its last violation is
    // cleared. `purity` and `static-components` are clean and now enforced -
    // don't demote them again without fixing the code instead.
    //
    // Still on warn (remaining violations tracked in docs/HANDOFF.md §8):
    //
    //   set-state-in-effect - 33 left. The mount-time browser reads and the
    //     reset-on-prop-change cases have been fixed (see docs/changelog.md,
    //     2026-07-25 batches 2 and 3). What remains is mostly FETCH-ON-MOUNT,
    //     which is a DELIBERATE KEEP - reasoning below - plus a handful of
    //     user-writable stored preferences (chat sound, theme, active tab) that
    //     are read *and* written, so fixing those means making localStorage a
    //     subscribable source of truth rather than swapping in a hook.
    //
    //     WHY FETCH-ON-MOUNT IS NOT BEING "FIXED" (decision, 2026-07-25):
    //     The shape is `useEffect(() => { load(); }, [load])` where `load()`
    //     opens with `setLoading(true)`. The rule sees a synchronous setState
    //     inside an effect and calls it a cascading render. In this codebase it
    //     usually isn't one: these components already declare
    //     `useState(true)` for `loading`, so on mount that call sets the value
    //     it already has and React bails out. On later runs (tab switched, query
    //     changed) it is a real and *correct* transition back to a loading
    //     state. Unlike the two groups we did fix, no wrong data is ever
    //     painted - the intermediate state is simply "not loading yet", which is
    //     true. Worst case is a brief flash of empty content before a skeleton.
    //
    //     The rule's real objection is architectural: fetching in effects has no
    //     request dedup, no shared cache and invites waterfalls, so it wants a
    //     data layer. Two ways to satisfy it, both rejected for now:
    //       - Move the fetching into Server Components. This is the Next-native
    //         answer but the WRONG trade here: it converts client fetches of
    //         cached /api routes into per-request server work, pushing Function
    //         Invocations and Fast Origin Transfer up - directly against the
    //         free-tier cost work in docs/HANDOFF.md §7.
    //       - Adopt SWR / TanStack Query (~20 call sites). Legitimate, and its
    //         dedup+cache could actually REDUCE invocations. But that is a
    //         repo-wide architectural commitment that should be scoped on its
    //         own merits, not smuggled in as lint cleanup.
    //     Revisit if either becomes true: we adopt a data-fetching library for
    //     other reasons, or a specific screen shows a visible loading flash (fix
    //     that component, not the group).
    //
    //   refs - 1 left, orbital/Saturn reads an animated ref during render; the
    //     fix needs GlowSprite to animate opacity imperatively, and that scene
    //     is currently gated off (useWebglGate === false).
    //   immutability - 2 left.
    //
    // Consequence of the above: set-state-in-effect stays on `warn` for the
    // foreseeable future, so it will NOT block a newly-introduced instance.
    // That is an accepted trade, not an oversight.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];
