import { BrandLoader } from "./BrandLoader";

// Shown instantly during route transitions (via each route's loading.tsx). A
// branded XYZ Crypto logo loader on the ambient mesh backdrop so navigation
// always feels intentional rather than blank.
export function RouteSkeleton() {
  return (
    <main className="relative min-h-screen pt-20">
      <div className="mesh" />
      <div className="relative">
        <BrandLoader />
      </div>
    </main>
  );
}
