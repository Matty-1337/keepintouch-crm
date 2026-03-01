import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const { searchParams } = request.nextUrl;
    const contactId = searchParams.get("contactId");

    const where: Record<string, unknown> = {};
    if (contactId) {
      where.contactId = contactId;
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        contact: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error listing messages:", error);
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
    const { contactId, message, status } = body;

    if (!contactId || !message) {
      return NextResponse.json(
        { error: "contactId and message are required" },
        { status: 400 }
      );
    }

    // Verify contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });
    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    const isSent = status === "sent";

    // Create the message
    const created = await prisma.message.create({
      data: {
        contactId,
        message,
        status: status ?? "draft",
        sentAt: isSent ? now : null,
      },
      include: {
        contact: {
          select: { name: true },
        },
      },
    });

    // If the message is sent, update the contact's lastContact and recalculate nextDue
    if (isSent) {
      const nextDue = new Date(
        now.getTime() + contact.frequencyDays * 24 * 60 * 60 * 1000
      );

      await prisma.contact.update({
        where: { id: contactId },
        data: {
          lastContact: now,
          nextDue,
        },
      });
    }

    return NextResponse.json({ message: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
