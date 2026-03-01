"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";
import { CATEGORY_OPTIONS } from "@/lib/utils";

export function SearchFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      params.delete("page");
      return params.toString();
    },
    [searchParams]
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search contacts..."
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => {
            router.push(`/contacts?${createQueryString("search", e.target.value)}`);
          }}
          className="w-full rounded-md border border-input bg-background px-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <select
        defaultValue={searchParams.get("category") ?? ""}
        onChange={(e) => {
          router.push(`/contacts?${createQueryString("category", e.target.value)}`);
        }}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All Categories</option>
        {CATEGORY_OPTIONS.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("kit") ?? ""}
        onChange={(e) => {
          router.push(`/contacts?${createQueryString("kit", e.target.value)}`);
        }}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All Status</option>
        <option value="active">KIT Active</option>
        <option value="inactive">KIT Inactive</option>
      </select>
    </div>
  );
}
