import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const { id } = params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        secondaryPhones: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error("Error fetching contact:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const { id } = params;
    const body = await request.json();

    // Check if the contact exists
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Build update data from allowed fields
    const data: Record<string, unknown> = {};
    const allowedFields = [
      "name",
      "phone",
      "email",
      "relationship",
      "category",
      "notes",
      "frequencyDays",
      "lastContact",
      "nextDue",
      "kitActive",
      "archived",
      "appleContactId",
      "localSqliteId",
      "topics",
      "context",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    // Parse date fields if provided as strings
    if (data.lastContact && typeof data.lastContact === "string") {
      data.lastContact = new Date(data.lastContact);
    }
    if (data.nextDue && typeof data.nextDue === "string") {
      data.nextDue = new Date(data.nextDue);
    }

    // Recalculate nextDue if frequencyDays or lastContact changed
    const freqChanged = data.frequencyDays !== undefined;
    const lastChanged = data.lastContact !== undefined;

    if (freqChanged || lastChanged) {
      const freq = (data.frequencyDays as number) ?? existing.frequencyDays;
      const last = (data.lastContact as Date | null) ?? existing.lastContact;

      if (last) {
        const lastDate = last instanceof Date ? last : new Date(last as string);
        data.nextDue = new Date(
          lastDate.getTime() + freq * 24 * 60 * 60 * 1000
        );
      } else {
        data.nextDue = null;
      }
    }

    const contact = await prisma.contact.update({
      where: { id },
      data,
      include: { secondaryPhones: true },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const { id } = params;

    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Soft delete: set archived to true
    await prisma.contact.update({
      where: { id },
      data: { archived: true },
    });

    return NextResponse.json({ message: "Contact archived" });
  } catch (error) {
    console.error("Error archiving contact:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
