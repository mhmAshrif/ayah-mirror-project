import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { listReciters, listTranslations } from "@/lib/quran.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — AyahMirror" }] }),
  component: SettingsPage,
});

const LIFE_STAGES = [
  "Seeker",
  "Student",
  "New Muslim",
  "Parent",
  "Working professional",
  "Elder",
];

function SettingsPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme, prefs, savePrefs, prefsLoaded } = useApp();
  const isLight = theme === "light";
  const fetchReciters = useServerFn(listReciters);
  const fetchTranslations = useServerFn(listTranslations);

  const [reciters, setReciters] = useState<Array<{ id: number; name: string }>>([]);
  const [translations, setTranslations] = useState<Array<{ id: number; name: string; author: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  useEffect(() => {
    fetchReciters().then(setReciters);
    fetchTranslations().then(setTranslations);
  }, [fetchReciters, fetchTranslations]);

  const save = async (patch: Partial<typeof prefs>) => {
    setSaving(true);
    try {
      await savePrefs(patch);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!prefsLoaded) {
    return (
      <AppShell>
        <div className={`flex items-center gap-2 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  const fieldCls = `w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight ? "border-slate-300 bg-white" : "border-white/10 bg-white/5 text-slate-100"
  }`;

  return (
    <AppShell>
      <section className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <SettingsIcon className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`} />
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
            Settings
          </h1>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          <Field label="Theme" isLight={isLight}>
            <select
              className={fieldCls}
              value={prefs.theme}
              onChange={(e) => save({ theme: e.target.value as "oceanic" | "light" })}
            >
              <option value="oceanic">Oceanic (dark)</option>
              <option value="light">Light / Day</option>
            </select>
          </Field>

          <Field label="Default reciter" isLight={isLight}>
            <select
              className={fieldCls}
              value={prefs.reciter_id}
              onChange={(e) => save({ reciter_id: Number(e.target.value) })}
            >
              {reciters.length === 0 && <option value={prefs.reciter_id}>Loading…</option>}
              {reciters.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Preferred English translation" isLight={isLight}>
            <select
              className={fieldCls}
              value={prefs.translation_id}
              onChange={(e) => save({ translation_id: Number(e.target.value) })}
            >
              {translations.length === 0 && <option value={prefs.translation_id}>Loading…</option>}
              {translations.map((t) => (
                <option key={t.id} value={t.id}>{t.author} — {t.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Life-stage focus" isLight={isLight}>
            <select
              className={fieldCls}
              value={prefs.life_stage ?? ""}
              onChange={(e) => save({ life_stage: e.target.value || null })}
            >
              <option value="">— None selected —</option>
              {LIFE_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          <Field label="Default reflection visibility" isLight={isLight}>
            <select
              className={fieldCls}
              value={prefs.default_public ? "public" : "private"}
              onChange={(e) => save({ default_public: e.target.value === "public" })}
            >
              <option value="private">Private</option>
              <option value="public">Public (shared anonymously)</option>
            </select>
          </Field>

          {saving && (
            <div className={`text-xs flex items-center gap-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              <RefreshCw className="h-3 w-3 animate-spin" /> Saving…
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Field({
  label,
  isLight,
  children,
}: {
  label: string;
  isLight: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className={`text-xs uppercase tracking-wide mb-1.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
        {label}
      </div>
      {children}
    </label>
  );
}
