import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";

// Per-article social share image — a branded card with the post title. Uses the
// Node runtime (Prisma can't run on edge) and falls back to a generic card if the
// post can't be loaded, so it never breaks sharing.
export const runtime = "nodejs";
export const alt = "XYZ Crypto research";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  let title = "Web3 Research & Market Intelligence";
  let category = "Research";
  try {
    const post = await prisma.post.findUnique({
      where: { slug: params.slug },
      select: { title: true, category: true },
    });
    if (post) {
      title = post.title;
      category = post.category;
    }
  } catch {
    /* keep the generic fallback */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #08080a 0%, #0e0e12 60%, #15110a 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#e2a72f",
            }}
          >
            XYZ
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#fafafa" }}>Crypto</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 18px",
              borderRadius: "999px",
              border: "1px solid rgba(226,167,47,0.4)",
              color: "#f3d488",
              fontSize: 24,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            {category}
          </div>
          <div
            style={{
              fontSize: title.length > 80 ? 56 : 68,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: "1000px",
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#a1a1aa" }}>{site.slogan}</div>
      </div>
    ),
    { ...size }
  );
}
