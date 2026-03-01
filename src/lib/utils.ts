import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInDays, addDays, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDaysOverdue(nextDue: Date | null): number {
  if (!nextDue) return 0;
  return differenceInDays(new Date(), nextDue);
}

export function getNextDueDate(
  lastContact: Date | null,
  frequencyDays: number
): Date {
  if (!lastContact) return new Date();
  return addDays(lastContact, frequencyDays);
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "Never";
  return format(new Date(date), "MMM d, yyyy");
}

export function formatRelativeDate(date: Date | string | null): string {
  if (!date) return "Never";
  const days = differenceInDays(new Date(), new Date(date));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export const CATEGORY_COLORS: Record<string, string> = {
  Baseball: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  WHAM: "bg-green-500/20 text-green-400 border-green-500/30",
  Professional: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Friend: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Student: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  Hospitality: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export const CATEGORY_CHART_COLORS: Record<string, string> = {
  Baseball: "#3b82f6",
  WHAM: "#22c55e",
  Professional: "#a855f7",
  Friend: "#f97316",
  Student: "#6b7280",
  Hospitality: "#f59e0b",
  "": "#71717a",
};

export const FREQUENCY_OPTIONS = [
  { value: 1, label: "Daily" },
  { value: 7, label: "Weekly" },
  { value: 14, label: "Bi-weekly" },
  { value: 30, label: "Monthly" },
  { value: 60, label: "Bi-monthly" },
  { value: 90, label: "Quarterly" },
];

export const RELATIONSHIP_OPTIONS = [
  "partner",
  "friend",
  "professional",
  "family",
  "mentor",
  "student",
  "colleague",
];

export const CATEGORY_OPTIONS = [
  "Baseball",
  "WHAM",
  "Professional",
  "Friend",
  "Student",
  "Hospitality",
];
