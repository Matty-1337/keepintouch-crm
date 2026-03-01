import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const logs = await prisma.syncLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error listing sync logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { direction, source, status, details, contacts } = body;

    if (!direction || !source || !status) {
      return NextResponse.json(
        { error: "direction, source, and status are required" },
        { status: 400 }
      );
    }

    const log = await prisma.syncLog.create({
      data: {
        direction,
        source,
        status,
        details: details ?? "",
        contacts: contacts ?? 0,
      },
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error("Error creating sync log:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
