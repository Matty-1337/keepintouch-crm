import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const { searchParams } = request.nextUrl;
    const since = searchParams.get("since");
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const kitActive = searchParams.get("kitActive");
    const archived = searchParams.get("archived");

    const where: Record<string, unknown> = {};

    if (since) {
      where.updatedAt = { gte: new Date(since) };
    }

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    if (category) {
      where.category = category;
    }

    if (kitActive !== null && kitActive !== undefined) {
      where.kitActive = kitActive === "true";
    }

    if (archived !== null && archived !== undefined) {
      where.archived = archived === "true";
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: { secondaryPhones: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Error listing contacts:", error);
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

    const {
      name,
      phone,
      email,
      relationship,
      category,
      notes,
      frequencyDays,
      lastContact,
      kitActive,
      appleContactId,
      localSqliteId,
      topics,
      context,
      secondaryPhones,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Calculate nextDue from lastContact and frequencyDays
    let nextDue: Date | null = null;
    const freqDays = frequencyDays ?? 14;
    if (lastContact) {
      const last = new Date(lastContact);
      nextDue = new Date(last.getTime() + freqDays * 24 * 60 * 60 * 1000);
    }

    const contact = await prisma.contact.create({
      data: {
        name,
        phone: phone ?? null,
        email: email ?? null,
        relationship: relationship ?? "",
        category: category ?? "",
        notes: notes ?? "",
        frequencyDays: freqDays,
        lastContact: lastContact ? new Date(lastContact) : null,
        nextDue,
        kitActive: kitActive ?? false,
        appleContactId: appleContactId ?? null,
        localSqliteId: localSqliteId ?? null,
        topics: topics ?? "",
        context: context ?? "",
        secondaryPhones: secondaryPhones
          ? {
              create: secondaryPhones.map(
                (sp: { phone: string; label?: string }) => ({
                  phone: sp.phone,
                  label: sp.label ?? "mobile",
                })
              ),
            }
          : undefined,
      },
      include: { secondaryPhones: true },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
