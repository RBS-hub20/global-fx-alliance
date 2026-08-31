"use client";

import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { Card, CardHead, PanelHeader, Pills, Select, Toast, Toggle } from "@/components/ui/Primitives";
import { KEYS, usePersistentState } from "@/lib/storage";

const SECTIONS = ["General", "Notifications", "Privacy", "Appearance"] as const;

interface SettingsShape {
  language: string;
  timezone: string;
  currency: string;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifyCommunity: boolean;
  notifyMarket: boolean;
  profilePublic: boolean;
  showTrades: boolean;
  showChapters: boolean;
  accent: "blue" | "green";
}

const DEFAULTS: SettingsShape = {
  language: "English",
  timezone: "UTC+08:00 — Manila",
  currency: "USD",
  notifyEmail: true,
  notifyPush: false,
  notifyCommunity: true,
  notifyMarket: true,
  profilePublic: true,
  showTrades: false,
  showChapters: true,
  accent: "blue",
};

export function SettingsPanel() {
  const { value: settings, setValue: setSettings } = usePersistentState<SettingsShape>(
    KEYS.settings,
    DEFAULTS
  );
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("General");
  const [toast, setToast] = useState<string | null>(null);

  const set = <K extends keyof SettingsShape>(key: K, value: SettingsShape[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    setToast("Settings saved");
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="space-y-6">
      <PanelHeader title="Settings" />
      <Pills options={SECTIONS} value={section} onChange={setSection} />

      <div className="max-w-3xl space-y-5">
        {section === "General" ? (
          <Card>
            <CardHead title="General" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
              <Select label="Language" value={settings.language} onChange={(e) => set("language", e.target.value)}>
                {["English", "Filipino", "Bahasa Indonesia", "日本語", "العربية"].map((l) => <option key={l}>{l}</option>)}
              </Select>
              <Select label="Timezone" value={settings.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {[
                  "UTC+00:00 — London",
                  "UTC+04:00 — Dubai",
                  "UTC+08:00 — Manila",
                  "UTC+08:00 — Singapore",
                  "UTC+09:00 — Tokyo",
                  "UTC−05:00 — New York",
                ].map((t) => <option key={t}>{t}</option>)}
              </Select>
              <Select label="Display Currency" value={settings.currency} onChange={(e) => set("currency", e.target.value)}>
                {["USD", "EUR", "GBP", "JPY", "PHP", "AED", "SGD"].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </div>
          </Card>
        ) : null}

        {section === "Notifications" ? (
          <Card>
            <CardHead title="Notifications" />
            <div className="divide-y divide-white/[0.06] px-5">
              <Toggle label="Email" hint="Weekly digest and account notices" checked={settings.notifyEmail} onChange={(v) => set("notifyEmail", v)} />
              <Toggle label="Push" hint="Browser notifications on this device" checked={settings.notifyPush} onChange={(v) => set("notifyPush", v)} />
              <Toggle label="Community" hint="Replies to your posts and threads" checked={settings.notifyCommunity} onChange={(v) => set("notifyCommunity", v)} />
              <Toggle label="Market Alerts" hint="High-impact calendar events and large moves on your watchlist" checked={settings.notifyMarket} onChange={(v) => set("notifyMarket", v)} />
            </div>
          </Card>
        ) : null}

        {section === "Privacy" ? (
          <Card>
            <CardHead title="Privacy" />
            <div className="divide-y divide-white/[0.06] px-5">
              <Toggle label="Public profile" hint="Anyone in the Alliance can view your profile" checked={settings.profilePublic} onChange={(v) => set("profilePublic", v)} />
              <Toggle label="Show trades" hint="Display journal entries on your profile. Off by default." checked={settings.showTrades} onChange={(v) => set("showTrades", v)} />
              <Toggle label="Show chapters" hint="List the chapters you've joined" checked={settings.showChapters} onChange={(v) => set("showChapters", v)} />
            </div>
            <p className="border-t border-white/[0.08] px-5 py-4 text-[11.5px] leading-relaxed text-ink-muted/70">
              Your journal, watchlist and settings are stored in this browser and are never uploaded.
            </p>
          </Card>
        ) : null}

        {section === "Appearance" ? (
          <Card>
            <CardHead title="Appearance" icon={Palette} />
            <div className="space-y-6 p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Theme</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-brand-blue/40 bg-brand-blue/[0.08] p-4 shadow-glow">
                    <p className="text-[13px] font-semibold text-white">Dark</p>
                    <p className="mt-1 text-[11.5px] text-ink-muted">Deep navy — the only theme</p>
                  </div>
                  <div className="cursor-not-allowed rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 opacity-40">
                    <p className="text-[13px] font-semibold text-ink-muted">Light</p>
                    <p className="mt-1 text-[11.5px] text-ink-muted">Not available</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Accent colour</p>
                <div className="mt-3 flex gap-3">
                  {([
                    { key: "blue" as const, label: "Electric Blue", hex: "#2A7FFF" },
                    { key: "green" as const, label: "Trading Green", hex: "#00D094" },
                  ]).map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => set("accent", a.key)}
                      aria-pressed={settings.accent === a.key}
                      className={`flex flex-1 items-center gap-3 rounded-lg border p-4 transition-all duration-200 ${
                        settings.accent === a.key
                          ? "border-white/25 bg-white/[0.05]"
                          : "border-white/[0.08] hover:border-white/20"
                      }`}
                    >
                      <span className="h-6 w-6 shrink-0 rounded-full" style={{ background: a.hex }} />
                      <span className="min-w-0 flex-1 text-left text-[13px] font-medium text-ink">{a.label}</span>
                      {settings.accent === a.key ? (
                        <Check className="h-4 w-4 shrink-0 text-brand-green" strokeWidth={2.6} />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        <button type="button" onClick={save} className="btn-primary !px-6">
          Save changes
        </button>
      </div>

      <Toast message={toast} />
    </div>
  );
}
