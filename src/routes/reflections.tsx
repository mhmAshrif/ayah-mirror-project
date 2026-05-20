import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, Lock, Pencil, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reflections")({
  head: () => ({ meta: [{ title: "Reflections — AyahMirror" }] }),
  component: ReflectionsPage,
});

type ReflectionRow = {
  id: string;
  content: string;
  is_public: boolean;
  created_at: string;
  surah_id: number | null;
  ayah_number: number | null;
};

function ReflectionsPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme, privacyPublic } = useApp();
  const isLight = theme === "light";

  const [tab, setTab] = useState<"mine" | "echoes">("mine");
  const [mine, setMine] = useState<ReflectionRow[]>([]);
  const [echoes, setEchoes] = useState<ReflectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  useEffect(() => {
    if (!userId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const load = async () => {
    setLoading(true);
    try {
      const [m, e] = await Promise.all([
        supabase
          .from("reflections")
          .select("id,content,is_public,created_at,surah_id,ayah_number")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("reflections")
          .select("id,content,is_public,created_at,surah_id,ayah_number")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      setMine(m.data ?? []);
      setEchoes(e.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || !userId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reflections").insert({
        user_id: userId,
        content: v.slice(0, 280),
        is_public: privacyPublic,
      });
      if (error) throw error;
      setText("");
      toast.success("Saved");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteOne = async (id: string) => {
    await supabase.from("reflections").delete().eq("id", id);
    setMine((arr) => arr.filter((r) => r.id !== id));
  };

  const list = tab === "mine" ? mine : echoes;

  return (
    <AppShell>
      <section className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <Pencil className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`} />
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
            Reflections
          </h1>
        </div>
        <p className={`mt-1 text-sm ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          Your private log and the global echoes from the community.
        </p>

        <form onSubmit={submit} className="mt-5 flex gap-2 flex-col sm:flex-row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 280))}
            placeholder="A sentence about how you feel right now…"
            className={`flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-400/40 ${
              isLight ? "border-slate-300 bg-white" : "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
            }`}
          />
          <button
            disabled={submitting || !text.trim()}
            className="rounded-xl bg-teal-500 hover:bg-teal-400 text-white px-5 py-3 text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : privacyPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            Save {privacyPublic ? "(public)" : "(private)"}
          </button>
        </form>

        <div className="mt-6 flex gap-2">
          {(["mine", "echoes"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-xs border transition ${
                tab === t
                  ? isLight
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-teal-400 bg-teal-500/20 text-teal-200"
                  : isLight
                  ? "border-slate-300 text-slate-600"
                  : "border-white/10 text-slate-400"
              }`}
            >
              {t === "mine" ? "My Reflections" : "Global Echoes"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={`mt-8 flex items-center gap-2 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : list.length === 0 ? (
          <div className={`mt-8 rounded-2xl border p-8 text-center text-sm ${
            isLight ? "border-slate-200 bg-white text-slate-500" : "border-white/10 bg-white/5 text-slate-400"
          }`}>
            {tab === "mine" ? "No reflections yet." : "No public reflections yet."}
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {list.map((r) => (
              <article
                key={r.id}
                className={`rounded-xl border p-4 ${
                  isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/5"
                }`}
              >
                <div className={`flex items-center justify-between text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  <span className="flex items-center gap-1.5">
                    {tab === "mine" && (r.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />)}
                    {tab === "mine" ? (r.is_public ? "Public" : "Private") : "Anonymous"}
                  </span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className={`mt-2 text-sm leading-relaxed ${isLight ? "text-slate-800" : "text-slate-100"}`}>
                  {r.content}
                </p>
                {r.surah_id && r.ayah_number && (
                  <div className={`mt-2 text-[11px] uppercase tracking-wide ${isLight ? "text-teal-700" : "text-teal-300"}`}>
                    Surah {r.surah_id}:{r.ayah_number}
                  </div>
                )}
                {tab === "mine" && (
                  <button
                    onClick={() => deleteOne(r.id)}
                    className="mt-2 text-xs text-rose-400 hover:text-rose-300"
                  >
                    Delete
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
