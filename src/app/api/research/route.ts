import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

// GET /api/research — public list (optionally filter by category)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const includeDrafts = searchParams.get("drafts") === "1";

  // Only admins can request drafts
  let showDrafts = false;
  if (includeDrafts) {
    const session = await getServerSession(authOptions);
    showDrafts = (session?.user as any)?.role === "ADMIN";
  }

  const posts = await prisma.post.findMany({
    where: {
      ...(showDrafts ? {} : { published: true }),
      ...(category && category !== "All" ? { category } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });

  return NextResponse.json({ posts });
}

const createSchema = z.object({
  title: z.string().trim().min(4).max(160),
  excerpt: z.string().trim().min(8).max(320),
  content: z.string().trim().min(20),
  category: z.enum(["Research", "Article", "Post"]).default("Research"),
  cover: z.string().trim().url().optional().or(z.literal("")),
  tags: z.string().trim().max(200).optional(),
  published: z.boolean().optional().default(true),
});

// POST /api/research — admin only
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  let base = slugify(data.title) || "post";
  let slug = base;
  let i = 1;
  while (await prisma.post.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }

  const post = await prisma.post.create({
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt,
      content: data.content,
      category: data.category,
      cover: data.cover || null,
      tags: data.tags || "",
      published: data.published ?? true,
      publishedAt: data.published ? new Date() : null,
      authorId: (session.user as any).id ?? null,
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}
