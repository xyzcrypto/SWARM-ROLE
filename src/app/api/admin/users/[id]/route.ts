import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  role: z.enum(["USER", "PREMIUM", "ADMIN"]).optional(),
  membership: z.enum(["standard", "premium", "enterprise"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

// PATCH /api/admin/users/:id — update role, membership, or status
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Prevent admin from disabling or demoting themselves
  const adminId = (session.user as any).id;
  if (params.id === adminId) {
    if (parsed.data.status === "disabled" || parsed.data.role === "USER") {
      return NextResponse.json(
        { error: "You cannot modify your own admin account." },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user
    .update({
      where: { id: params.id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        membership: true,
        status: true,
      },
    })
    .catch(() => null);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
