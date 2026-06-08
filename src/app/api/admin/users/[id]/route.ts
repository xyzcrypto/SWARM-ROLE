import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { isMember } = body;

  if (typeof isMember !== "boolean") {
    return NextResponse.json({ error: "isMember must be a boolean" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { isMember },
    select: { id: true, isMember: true },
  });

  return NextResponse.json(user);
}
