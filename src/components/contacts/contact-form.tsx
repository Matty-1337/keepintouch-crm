"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FrequencySlider } from "./frequency-slider";
import { CATEGORY_OPTIONS, RELATIONSHIP_OPTIONS } from "@/lib/utils";
import { Save, Trash2 } from "lucide-react";

interface ContactData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string;
  category: string;
  notes: string;
  frequencyDays: number;
  kitActive: boolean;
  topics: string;
  context: string;
}

export function ContactForm({ contact }: { contact: ContactData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: contact.name,
    phone: contact.phone || "",
    email: contact.email || "",
    relationship: contact.relationship,
    category: contact.category,
    notes: contact.notes,
    frequencyDays: contact.frequencyDays,
    kitActive: contact.kitActive,
    topics: contact.topics,
    context: contact.context,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm("Archive this contact?")) return;
    await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
    router.push("/contacts");
  };

  return (
    <div className="space-y-6">
      {/* KIT Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <p className="font-medium">Keep In Touch</p>
          <p className="text-sm text-muted-foreground">
            Enable automatic contact reminders
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...form, kitActive: !form.kitActive })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            form.kitActive ? "bg-green-500" : "bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              form.kitActive ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Frequency Slider */}
      {form.kitActive && (
        <div className="rounded-lg border border-border bg-card p-4">
          <FrequencySlider
            value={form.frequencyDays}
            onChange={(v) => setForm({ ...form, frequencyDays: v })}
          />
        </div>
      )}

      {/* Basic Info */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 font-medium">Contact Info</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Phone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Relationship
            </label>
            <select
              value={form.relationship}
              onChange={(e) =>
                setForm({ ...form, relationship: e.target.value })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select...</option>
              {RELATIONSHIP_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select...</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Topics & Context */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 font-medium">Topics & Context</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Topics (comma-separated)
            </label>
            <input
              type="text"
              value={form.topics}
              onChange={(e) => setForm({ ...form, topics: e.target.value })}
              placeholder="baseball, umpiring, tech"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Context
            </label>
            <textarea
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={handleArchive}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Archive
        </button>
      </div>
    </div>
  );
}
