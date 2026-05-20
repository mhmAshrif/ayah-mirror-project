import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Heart, RefreshCw, Search, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { semanticVerseSearch } from "@/lib/quran.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [{ title: "Today for You — AyahMirror" }],
  }),
  component: TodayPage,
});

type Result = {
  verseKey: string;
  surah: number;
  ayah: number;
  surahNameEn: string;
  arabic: string;
  translation: string;
  tafsirBlurb: string;
};

function TodayPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme } = useApp();
  const isLight = theme === "light";
  const fetchSearch = useServerFn(semanticVerseSearch);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await fetchSearch({ data: { query: q.trim() } });
      setResults(data);
      if (!data.length) toast.info("No matches; try different words.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <section className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <Heart className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`} />
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
            Today for You
          </h1>
        </div>
        <p className={`mt-1 text-sm ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          Describe how you're feeling. We'll surface 3–4 verses chosen for this moment.
        </p>

        <form onSubmit={handleSearch} className="mt-6 flex gap-2 flex-col sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. I'm anxious about my future"
            className={`flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-400/40 ${
              isLight ? "border-slate-300 bg-white" : "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
            }`}
          />
          <button
            type="submit"
            disabled={loading || !q.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-white px-5 py-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-4">
          {results.map((r) => (
            <article
              key={r.verseKey}
              className={`rounded-2xl border p-5 backdrop-blur-md ${
                isLight ? "border-teal-200 bg-white/80" : "border-teal-500/20 bg-white/5"
              }`}
            >
              <div className={`flex items-center gap-2 text-xs uppercase tracking-wide ${isLight ? "text-teal-700" : "text-teal-300"}`}>
                <Sparkles className="h-3.5 w-3.5" />
                {r.surahNameEn} • {r.verseKey}
              </div>
              <p
                dir="rtl"
                lang="ar"
                className={`mt-3 text-right text-xl sm:text-2xl leading-[2.4] font-[Amiri,'Scheherazade_New',serif] ${
                  isLight ? "text-slate-900" : "text-white"
                }`}
              >
                {r.arabic}
              </p>
              <p className={`mt-2 text-sm ${isLight ? "text-slate-700" : "text-slate-200"}`}>
                "{r.translation}"
              </p>
              <p className={`mt-3 text-xs italic ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                {r.tafsirBlurb}
              </p>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
