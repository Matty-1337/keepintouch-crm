import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { contacts } = body;

    if (!Array.isArray(contacts)) {
      return NextResponse.json(
        { error: "contacts must be an array" },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];

      try {
        // Try to find an existing contact by localSqliteId or phone
        let existing = null;

        if (c.localSqliteId) {
          existing = await prisma.contact.findFirst({
            where: { localSqliteId: c.localSqliteId },
          });
        }

        if (!existing && c.phone) {
          existing = await prisma.contact.findFirst({
            where: { phone: c.phone },
          });
        }

        // Calculate nextDue
        const freqDays = c.frequencyDays ?? 14;
        let nextDue: Date | null = null;
        if (c.lastContact) {
          const last = new Date(c.lastContact);
          nextDue = new Date(last.getTime() + freqDays * 24 * 60 * 60 * 1000);
        }

        const contactData = {
          name: c.name,
          phone: c.phone ?? null,
          email: c.email ?? null,
          relationship: c.relationship ?? "",
          category: c.category ?? "",
          notes: c.notes ?? "",
          frequencyDays: freqDays,
          lastContact: c.lastContact ? new Date(c.lastContact) : null,
          nextDue,
          kitActive: c.kitActive ?? false,
          appleContactId: c.appleContactId ?? null,
          localSqliteId: c.localSqliteId ?? null,
          topics: c.topics ?? "",
          context: c.context ?? "",
        };

        if (existing) {
          // If existing nextDue is already set and lastContact didn't change, preserve it
          const updateData = { ...contactData };
          if (!c.lastContact && existing.nextDue) {
            updateData.nextDue = existing.nextDue;
          }

          await prisma.contact.update({
            where: { id: existing.id },
            data: updateData,
          });
          updated++;
        } else {
          if (!c.name) {
            errors.push({ index: i, error: "Name is required" });
            continue;
          }

          await prisma.contact.create({ data: contactData });
          created++;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        errors.push({ index: i, error: message });
      }
    }

    return NextResponse.json({ created, updated, errors });
  } catch (error) {
    console.error("Error syncing contacts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
