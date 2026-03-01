import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default settings
  const settings = [
    { key: "defaultFrequency", value: "14" },
    { key: "aiProvider", value: "openrouter" },
    { key: "messageWindowStart", value: "09:00" },
    { key: "messageWindowEnd", value: "20:00" },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  console.log("Settings seeded.");

  // Check if contacts already exist
  const count = await prisma.contact.count();
  if (count > 0) {
    console.log(`${count} contacts already exist. Skipping contact seed.`);
    return;
  }

  // Seed a few sample contacts for testing
  const sampleContacts = [
    {
      name: "Sample Contact",
      phone: "+15551234567",
      relationship: "friend",
      category: "Friend",
      notes: "This is a sample contact for testing",
      frequencyDays: 14,
      kitActive: true,
      nextDue: new Date(),
    },
  ];

  for (const c of sampleContacts) {
    await prisma.contact.create({ data: c });
  }

  console.log(`Seeded ${sampleContacts.length} sample contacts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
