import { prisma } from "@/lib/prisma";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { SearchFilter } from "@/components/contacts/search-filter";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    search?: string;
    category?: string;
    kit?: string;
    sort?: string;
  };
}

async function getContacts(searchParams: PageProps["searchParams"]) {
  const where: Record<string, unknown> = { archived: false };

  if (searchParams.search) {
    where.name = { contains: searchParams.search, mode: "insensitive" };
  }
  if (searchParams.category) {
    where.category = searchParams.category;
  }
  if (searchParams.kit === "active") {
    where.kitActive = true;
  } else if (searchParams.kit === "inactive") {
    where.kitActive = false;
  }

  const orderBy: Record<string, string> = {};
  switch (searchParams.sort) {
    case "due":
      orderBy.nextDue = "asc";
      break;
    case "last":
      orderBy.lastContact = "desc";
      break;
    default:
      orderBy.name = "asc";
  }

  return prisma.contact.findMany({
    where,
    orderBy,
  });
}

export default async function ContactsPage({ searchParams }: PageProps) {
  const contacts = await getContacts(searchParams);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Contacts ({contacts.length})
        </h1>
      </div>

      <Suspense fallback={<div>Loading filters...</div>}>
        <SearchFilter />
      </Suspense>

      <ContactsTable contacts={contacts} />
    </div>
  );
}
