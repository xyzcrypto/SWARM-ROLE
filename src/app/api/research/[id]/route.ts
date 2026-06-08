import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: { id: string } };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user && (session.user as any).role === "ADMIN" ? session : null;
}

// ── PATCH /api/research/[id] ─────────────────────────────────────────────────
// Lightweight toggle: published and/or featured. Used by the Content tab
// status/featured buttons without requiring the full post payload.
const patchSchema = z.object({
  published: z.boolean().optional(),
  featured:  z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Context) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const post = await prisma.post
    .update({ where: { id: params.id }, data })
    .catch(() => null);

  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ post });
}

// ── PUT /api/research/[id] ───────────────────────────────────────────────────
// Full update. Slug is intentionally immutable — changing it would break
// published URLs and SEO. All other fields are editable.
const editSchema = z.object({
  title:     z.string().trim().min(4, "Title too short").max(160),
  excerpt:   z.string().trim().min(8, "Excerpt too short").max(320),
  content:   z.string().trim().min(20, "Content too short"),
  category:  z.enum(["Research", "Article", "Post"]).default("Research"),
  cover:     z.string().trim().url("Cover must be a valid URL").optional().or(z.literal("")),
  tags:      z.string().trim().max(200).optional(),
  published: z.boolean().optional(),
  featured:  z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: Context) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = editSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const post = await prisma.post
    .update({
      where: { id: params.id },
      data: {
        title:     d.title,
        excerpt:   d.excerpt,
        content:   d.content,
        category:  d.category,
        cover:     d.cover || null,
        tags:      d.tags ?? "",
        published: d.published ?? false,
        featured:  d.featured ?? false,
      },
    })
    .catch(() => null);

  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ post });
}

// ── DELETE /api/research/[id] ────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Context) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.post.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
