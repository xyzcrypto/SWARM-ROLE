import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

// DELETE /api/research/:id — admin only
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.post.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

const editSchema = z.object({
  title: z.string().trim().min(4).max(160).optional(),
  excerpt: z.string().trim().min(8).max(320).optional(),
  content: z.string().trim().min(20).optional(),
  category: z.enum(["Research", "Article", "Post"]).optional(),
  cover: z.string().trim().url().optional().or(z.literal("")).optional(),
  tags: z.string().trim().max(200).optional(),
  published: z.boolean().optional(),
});

// PATCH /api/research/:id — admin only (edit post)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = editSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // If title is changing, regenerate slug (handle collisions)
  let slugUpdate: string | undefined;
  if (data.title) {
    let base = slugify(data.title) || "post";
    let slug = base;
    let i = 1;
    while (true) {
      const existing = await prisma.post.findUnique({ where: { slug } });
      if (!existing || existing.id === params.id) break;
      slug = `${base}-${i++}`;
    }
    slugUpdate = slug;
  }

  // Set publishedAt when publishing for the first time
  let publishedAt: Date | undefined;
  if (data.published === true) {
    const existing = await prisma.post.findUnique({
      where: { id: params.id },
      select: { publishedAt: true },
    });
    if (!existing?.publishedAt) {
      publishedAt = new Date();
    }
  }

  const post = await prisma.post
    .update({
      where: { id: params.id },
      data: {
        ...data,
        cover: data.cover === "" ? null : data.cover,
        ...(slugUpdate ? { slug: slugUpdate } : {}),
        ...(publishedAt ? { publishedAt } : {}),
      },
    })
    .catch(() => null);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ post });
}
