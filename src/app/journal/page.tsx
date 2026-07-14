import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { PageBackground } from "@/components/PageBackground";
import { JournalClient, type SerializedTrade } from "@/components/journal/JournalClient";

export const metadata: Metadata = { title: "Trading Journal" };
export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?callbackUrl=/journal");
  const userId = me.id;
  const isPremium = me.membership === "Premium";

  // Server-fetch avoids a loading flash; tolerates an un-migrated DB (migrations
  // 24/25) so the page never 500s pre-migration, matching the SavedStory pattern.
  const rows = await prisma.trade
    .findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { fills: { orderBy: { executedAt: "asc" } } },
    })
    .catch(() => [] as any[]);

  const riskProfile = await prisma.riskProfile.findUnique({ where: { userId } }).catch(() => null);

  const trades: SerializedTrade[] = rows.map((t: any) => ({
    id: t.id,
    createdAt: t.createdAt.toISOString(),
    symbol: t.symbol,
    side: t.side,
    type: t.type,
    status: t.status,
    platformId: t.platformId,
    leverage: t.leverage,
    stopLoss: t.stopLoss,
    takeProfit: t.takeProfit,
    setup: t.setup,
    marketCondition: t.marketCondition,
    session: t.session,
    timeframe: t.timeframe,
    assetCategory: t.assetCategory,
    tags: t.tags,
    emotions: t.emotions,
    mistakes: t.mistakes,
    lessons: t.lessons,
    notes: t.notes,
    screenshots: t.screenshots,
    visibility: t.visibility,
    fills: t.fills.map((f: any) => ({
      id: f.id,
      kind: f.kind,
      price: f.price,
      size: f.size,
      fee: f.fee,
      executedAt: f.executedAt.toISOString(),
    })),
  }));

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-28">
        <PageBackground />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <JournalClient initialTrades={trades} initialRiskProfile={riskProfile} isPremium={isPremium} userId={userId} />
        </div>
      </main>
    </>
  );
}
