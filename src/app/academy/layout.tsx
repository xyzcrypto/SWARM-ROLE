import "./academy.css";
import { Navbar } from "@/components/Navbar";
import { PageBackground } from "@/components/PageBackground";
import { AcademyNav } from "@modules/academy/components/AcademyNav";
import { GuideDock } from "@modules/academy/components/Guide";
import { AcademyFx } from "@modules/academy/components/AcademyFx";
import { LiveBanner } from "@modules/academy/components/LiveBanner";

// Shared frame for every /academy page: the site header, the Academy's own
// tab bar and AneQue's floating guide. No data is read here, so it never makes
// a page dynamic.
export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="acad-main relative min-h-screen pt-24 sm:pt-28">
        <PageBackground />
        <div className="acad-shell relative mx-auto max-w-[1200px] px-5 pb-28 sm:px-6 lg:px-8 xl:max-w-[1320px]">
          <AcademyNav />
          <LiveBanner />
          {children}
        </div>
      </main>
      <GuideDock />
      <AcademyFx />
    </>
  );
}
