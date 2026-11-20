import { PageSkeleton } from "@shared/components/PageSkeleton";

// Inside the Academy layout (header, tabs and AneQue stay put): only the page area waits.
export default function Loading() {
  return <PageSkeleton framed={false} />;
}
