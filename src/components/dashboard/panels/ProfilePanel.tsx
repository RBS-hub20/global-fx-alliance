"use client";

import { useEffect, useState } from "react";
import { Activity, BadgeCheck, Pencil } from "lucide-react";
import { Card, CardHead, Field, Modal, PanelHeader, Select, Toast } from "@/components/ui/Primitives";
import { PROFILE } from "@/lib/content";
import { useAuth } from "@/lib/AuthContext";
import { displayName, initials, splitName } from "@/lib/displayName";
import { supabaseBrowser } from "@/lib/supabaseClient";

/**
 * The member's own profile.
 *
 * Identity — name, initials, handle, joined date — comes from the signed-in
 * `profiles` row. It used to come from the PROFILE fixture, which is why every
 * account in the app introduced itself as the same person.
 *
 * The rest (bio, country, style, the counters, the activity list) has no column
 * behind it yet and is still fixture copy; only the name is written back.
 */

export function ProfilePanel() {
  const { user, profile: row, refresh } = useAuth();
  const who = row ?? (user?.email ? { email: user.email } : null);

  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: displayName(who),
    bio: PROFILE.bio,
    country: PROFILE.country,
    style: PROFILE.style,
  });
  const [draft, setDraft] = useState(profile);

  // The session resolves after the first paint, so the name arrives late.
  useEffect(() => {
    setProfile((p) => ({ ...p, name: displayName(who) }));
  }, [row, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };

  const save = async () => {
    setProfile(draft);
    setEditing(false);

    const supabase = supabaseBrowser();
    const named = draft.name.trim();
    if (!supabase || !row || !named || named === displayName(who)) { flash("Profile updated"); return; }

    /*
     * Only the name is persisted, and only through the column grant in
     * supabase/profiles_add_name_columns.sql — `status` is not grantable to
     * `authenticated`, so this cannot be used to promote an account. Until that
     * migration runs the update is refused, and the panel says so rather than
     * pretending it saved.
     */
    setSaving(true);
    const { error } = await supabase.from("profiles").update(splitName(named)).eq("id", row.id);
    setSaving(false);
    if (error) { flash("Saved on this device only — the name column is not writable yet."); return; }
    await refresh();
    flash("Profile updated");
  };

  const since = row?.created_at
    ? new Date(row.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : PROFILE.since;

  const handle = user?.email ? `@${(user.email.split("@")[0] ?? "").toLowerCase()}` : PROFILE.handle;

  const stats = [
    { label: "Reputation", value: PROFILE.reputation.toLocaleString("en-US"), accent: true },
    { label: "Member since", value: since },
    { label: "Trades logged", value: String(PROFILE.tradesLogged) },
    { label: "Analysis posted", value: String(PROFILE.analysisPosted) },
  ];

  return (
    <div className="space-y-6">
      <PanelHeader title="My Profile" />

      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-5">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-brand-blue/30 bg-gradient-to-br from-[#1E4C9E] to-[#0A1931] text-[24px] font-bold text-white shadow-glow">
            {initials(who)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[22px] font-bold tracking-tight text-white">{profile.name}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue/[0.15] px-2.5 py-1 text-[10.5px] font-semibold text-brand-blue">
                <BadgeCheck className="h-3 w-3" strokeWidth={2.4} />
                {PROFILE.role}
              </span>
              <span className="text-[13px] text-ink-muted">
                <span aria-hidden>{PROFILE.flag}</span> {profile.country}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-ink-muted">{handle}</p>
            <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed text-ink-muted">
              {profile.bio}
            </p>
            <p className="mt-3 text-[12.5px] text-ink-muted">
              Trading style <span className="font-semibold text-ink">{profile.style}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => { setDraft(profile); setEditing(true); }}
            className="btn-ghost !px-4 !py-2.5 text-[12.5px]"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            Edit Profile
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl glass p-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {s.label}
            </p>
            <p className={`num-mono mt-2.5 text-[22px] font-bold leading-none ${s.accent ? "text-brand-blue" : "text-white"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardHead title="Recent Activity" icon={Activity} />
        <ul className="divide-y divide-white/[0.06]">
          {PROFILE.activity.map((a, i) => (
            <li key={i} className="flex items-start gap-4 px-5 py-3.5">
              <span className="num-mono w-[64px] shrink-0 text-[11.5px] text-ink-muted/70">{a.time}</span>
              <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">{a.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit profile">
        <div className="space-y-4">
          <Field label="Name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Bio
            </span>
            <textarea
              rows={3}
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none transition-all duration-200 focus:border-brand-blue/40 focus:shadow-glow"
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Country" value={draft.country} onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}>
              {["Philippines", "UAE", "Singapore", "United Kingdom", "United States", "Japan", "Malaysia", "Indonesia"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select label="Trading Style" value={draft.style} onChange={(e) => setDraft((d) => ({ ...d, style: e.target.value }))}>
              {["Scalp", "Intraday", "Swing", "Position"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="btn-ghost !px-4 !py-2 text-[12.5px]">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary !px-4 !py-2 text-[12.5px] disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}
