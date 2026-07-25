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
    //   set-state-in-effect - 44 left, concentrated in the chat/dashboard/news/
    //     messages clients; most are mount-time browser reads, fetch-on-mount,
    //     or reset-on-prop-change, which need real refactors (useSyncExternal-
    //     Store, key-remount, or a data layer), not mechanical edits.
    //   refs - 1 left, orbital/Saturn reads an animated ref during render; the
    //     fix needs GlowSprite to animate opacity imperatively, and that scene
    //     is currently gated off (useWebglGate === false).
    //   immutability - 2 left.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];
