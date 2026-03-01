import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const contacts = await prisma.contact.findMany({
      where: { kitActive: true, archived: false },
      select: {
        id: true,
        name: true,
        frequencyDays: true,
        lastContact: true,
        nextDue: true,
        notes: true,
      },
      orderBy: { nextDue: "asc" },
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Error fetching frequencies:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
