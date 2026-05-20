import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { listSurahs, type SurahMeta } from "@/lib/quran.functions";

export const Route = createFileRoute("/explorer")({
  head: () => ({ meta: [{ title: "Quran Explorer — AyahMirror" }] }),
  component: ExplorerPage,
});

function ExplorerPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme } = useApp();
  const isLight = theme === "light";
  const fetchSurahs = useServerFn(listSurahs);

  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  useEffect(() => {
    fetchSurahs()
      .then(setSurahs)
      .finally(() => setLoading(false));
  }, [fetchSurahs]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return surahs;
    return surahs.filter(
      (x) =>
        x.name_simple.toLowerCase().includes(s) ||
        x.translated_name.toLowerCase().includes(s) ||
        String(x.id) === s,
    );
  }, [q, surahs]);

  return (
    <AppShell>
      <section className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <BookOpen className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`} />
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
            Quran Explorer
          </h1>
        </div>
        <p className={`mt-1 text-sm ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          All 114 surahs. Tap one to read verses, hear recitation, and view tafsir.
        </p>

        <div className="mt-5 relative max-w-md">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${
              isLight ? "text-slate-400" : "text-slate-500"
            }`}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search surah by name or number"
            className={`w-full rounded-xl border pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-400/40 ${
              isLight ? "border-slate-300 bg-white" : "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
            }`}
          />
        </div>

        {loading ? (
          <div className={`mt-10 flex items-center gap-2 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading surahs…
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((s) => (
              <Link
                key={s.id}
                to="/explorer/$surahId"
                params={{ surahId: String(s.id) }}
                className={`rounded-xl border p-4 transition flex items-center gap-3 ${
                  isLight
                    ? "border-slate-200 bg-white hover:border-teal-400/60"
                    : "border-white/10 bg-white/5 hover:border-teal-400/40"
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                    isLight ? "bg-teal-50 text-teal-700" : "bg-teal-500/10 text-teal-300"
                  }`}
                >
                  {s.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                    {s.name_simple}
                  </div>
                  <div className={`text-xs truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                    {s.translated_name} · {s.verses_count} verses
                  </div>
                </div>
                <div
                  className={`text-lg font-[Amiri,serif] ${isLight ? "text-slate-700" : "text-slate-200"}`}
                  dir="rtl"
                >
                  {s.name_arabic}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
