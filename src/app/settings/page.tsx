"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";

interface Settings {
  defaultFrequency: string;
  aiProvider: string;
  apiKeyMasked: string;
  messageWindowStart: string;
  messageWindowEnd: string;
}

const DEFAULT_SETTINGS: Settings = {
  defaultFrequency: "14",
  aiProvider: "openrouter",
  apiKeyMasked: "",
  messageWindowStart: "09:00",
  messageWindowEnd: "20:00",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(() => setLoaded(true))
      .catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    // Settings would be saved via API in production
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
  };

  if (!loaded) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Default Frequency */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 font-medium">Defaults</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Default Frequency (days)
            </label>
            <select
              value={settings.defaultFrequency}
              onChange={(e) =>
                setSettings({ ...settings, defaultFrequency: e.target.value })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="7">Weekly (7 days)</option>
              <option value="14">Bi-weekly (14 days)</option>
              <option value="30">Monthly (30 days)</option>
              <option value="60">Bi-monthly (60 days)</option>
              <option value="90">Quarterly (90 days)</option>
            </select>
          </div>
        </div>
      </div>

      {/* AI Provider */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 font-medium">AI Provider</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Provider
            </label>
            <select
              value={settings.aiProvider}
              onChange={(e) =>
                setSettings({ ...settings, aiProvider: e.target.value })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="openrouter">OpenRouter</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              API Key
            </label>
            <input
              type="password"
              value={settings.apiKeyMasked}
              onChange={(e) =>
                setSettings({ ...settings, apiKeyMasked: e.target.value })
              }
              placeholder="sk-..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Message Window */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 font-medium">Message Window</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Only send messages during these hours
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Start Time
            </label>
            <input
              type="time"
              value={settings.messageWindowStart}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  messageWindowStart: e.target.value,
                })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              End Time
            </label>
            <input
              type="time"
              value={settings.messageWindowEnd}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  messageWindowEnd: e.target.value,
                })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 font-medium">System</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Version: 1.0.0</p>
          <p>Database: PostgreSQL (Railway)</p>
          <p>Sync Agent: Mac LaunchAgent</p>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
