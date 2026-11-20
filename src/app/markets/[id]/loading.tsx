import { Navbar } from "@/components/Navbar";
import { PageSkeleton } from "@shared/components/PageSkeleton";

// The page renders its own Navbar, so the placeholder does too (no header flash).
export default function Loading() {
  return (
    <>
      <Navbar />
      <PageSkeleton variant="detail" />
    </>
  );
}
