// No-op stand-in for Next's built-in `server-only` module.
//
// `server-only` is resolved by Next at build time (it is NOT an npm package in
// node_modules), so vitest cannot resolve it and any test importing a module
// that uses it fails to load with "Cannot find package 'server-only'".
//
// A no-op is the semantically correct stub here: vitest runs in a Node
// environment, which IS the server, so the guard has nothing to reject. The
// real enforcement happens where it matters - `next build` fails with
// "'server-only' cannot be imported from a Client Component module" if a
// `"use client"` component reaches one of these modules. Verified by
// deliberately reintroducing that import and confirming the build exits 1.
export {};
