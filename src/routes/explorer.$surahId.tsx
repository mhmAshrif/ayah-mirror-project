import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RefreshCw,
  Type,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import {
  getChapterVerses,
  getTafsir,
  type ChapterVerse,
  type SurahMeta,
} from "@/lib/quran.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/explorer/$surahId")({
  head: ({ params }) => ({
    meta: [{ title: `Surah ${params.surahId} — AyahMirror` }],
  }),
  component: SurahPage,
});

function SurahPage() {
  const { surahId } = Route.useParams();
  const navigate = useNavigate();
  const { userId, authReady, theme, prefs } = useApp();
  const isLight = theme === "light";
  const fetchChapter = useServerFn(getChapterVerses);
  const fetchTafsir = useServerFn(getTafsir);

  const [chapter, setChapter] = useState<SurahMeta | null>(null);
  const [verses, setVerses] = useState<ChapterVerse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [withWords, setWithWords] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [tafsirOpen, setTafsirOpen] = useState<string | null>(null);
  const [tafsirCache, setTafsirCache] = useState<Record<string, { text: string; author: string } | null>>({});

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  useEffect(() => {
    const sId = Number(surahId);
    if (!Number.isFinite(sId)) return;
    setLoading(true);
    fetchChapter({
      data: {
        surah: sId,
        translationId: prefs.translation_id,
        reciterId: prefs.reciter_id,
        withWords,
        page,
        perPage: 10,
      },
    })
      .then((r) => {
        setChapter(r.chapter);
        setVerses(r.verses);
        setTotalPages(r.totalPages);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [surahId, page, withWords, prefs.translation_id, prefs.reciter_id, fetchChapter]);

  const toggleTafsir = async (vKey: string, surah: number, ayah: number) => {
    if (tafsirOpen === vKey) {
      setTafsirOpen(null);
      return;
    }
    setTafsirOpen(vKey);
    if (!(vKey in tafsirCache)) {
      const t = await fetchTafsir({ data: { surah, ayah } });
      setTafsirCache((c) => ({ ...c, [vKey]: t }));
    }
  };

  return (
    <AppShell>
      <section className="max-w-3xl mx-auto">
        <Link
          to="/explorer"
          className={`inline-flex items-center gap-1 text-xs ${
            isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-slate-100"
          }`}
        >
          <ArrowLeft className="h-3 w-3" /> All Surahs
        </Link>

        <div className="mt-3 flex items-center gap-2 flex-wrap justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`} />
            <h1 className={`text-2xl sm:text-3xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
              {chapter ? `${chapter.name_simple}` : `Surah ${surahId}`}
            </h1>
            {chapter && (
              <span className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                · {chapter.translated_name} · {chapter.verses_count} verses
              </span>
            )}
          </div>
          <button
            onClick={() => setWithWords((w) => !w)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
              withWords
                ? isLight
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-teal-400 bg-teal-500/20 text-teal-200"
                : isLight
                ? "border-slate-300 text-slate-600 hover:bg-slate-100"
                : "border-white/10 text-slate-300 hover:bg-white/5"
            }`}
          >
            <Type className="h-3 w-3" /> Word-by-word {withWords ? "ON" : "OFF"}
          </button>
        </div>

        {loading ? (
          <div className={`mt-10 flex items-center gap-2 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading verses…
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {verses.map((v) => {
              const isOpen = tafsirOpen === v.verseKey;
              const isPlaying = playingId === v.id;
              return (
                <article
                  key={v.id}
                  className={`rounded-2xl border p-5 ${
                    isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${
                        isLight ? "bg-teal-50 text-teal-700" : "bg-teal-500/10 text-teal-300"
                      }`}
                    >
                      {v.verseKey}
                    </span>
                    {v.audioUrl && (
                      <button
                        onClick={() => {
                          const el = document.getElementById(`a-${v.id}`) as HTMLAudioElement | null;
                          if (!el) return;
                          if (isPlaying) el.pause();
                          else void el.play();
                        }}
                        className={`flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 ${
                          isLight
                            ? "border-teal-400/50 bg-teal-50 text-teal-700"
                            : "border-teal-400/40 bg-teal-500/10 text-teal-200"
                        }`}
                      >
                        {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {isPlaying ? "Pause" : "Listen"}
                      </button>
                    )}
                  </div>

                  {withWords && v.words?.length ? (
                    <div className="mt-4 flex flex-wrap gap-3 justify-end" dir="rtl">
                      {v.words.map((w, i) => (
                        <div key={i} className="text-center">
                          <div
                            className={`text-2xl font-[Amiri,serif] ${
                              isLight ? "text-slate-900" : "text-white"
                            }`}
                          >
                            {w.arabic}
                          </div>
                          <div
                            dir="ltr"
                            className={`text-[10px] mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}
                          >
                            {w.translation}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      dir="rtl"
                      lang="ar"
                      className={`mt-4 text-right text-2xl sm:text-3xl leading-[2.4] font-[Amiri,'Scheherazade_New',serif] ${
                        isLight ? "text-slate-900" : "text-white"
                      }`}
                    >
                      {v.arabic}
                    </p>
                  )}

                  <p
                    className={`mt-3 text-sm sm:text-base leading-relaxed ${
                      isLight ? "text-slate-700" : "text-slate-200"
                    }`}
                  >
                    "{v.translation}"
                  </p>

                  <button
                    onClick={() => toggleTafsir(v.verseKey, Number(surahId), v.ayah)}
                    className={`mt-3 text-xs underline-offset-4 hover:underline ${
                      isLight ? "text-teal-700" : "text-teal-300"
                    }`}
                  >
                    {isOpen ? "Hide tafsir" : "Show tafsir"}
                  </button>

                  {isOpen && (
                    <div
                      className={`mt-3 rounded-xl border p-4 text-sm ${
                        isLight
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-amber-400/30 bg-amber-400/10 text-amber-50"
                      }`}
                    >
                      {tafsirCache[v.verseKey] === undefined ? (
                        <span className="opacity-70">Loading tafsir…</span>
                      ) : tafsirCache[v.verseKey] ? (
                        <>
                          <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
                            {tafsirCache[v.verseKey]!.author}
                          </div>
                          <p className="leading-relaxed">{tafsirCache[v.verseKey]!.text}</p>
                        </>
                      ) : (
                        <span className="opacity-70">Tafsir unavailable.</span>
                      )}
                    </div>
                  )}

                  {v.audioUrl && (
                    <audio
                      id={`a-${v.id}`}
                      src={v.audioUrl}
                      onPlay={() => setPlayingId(v.id)}
                      onPause={() => setPlayingId(null)}
                      onEnded={() => setPlayingId(null)}
                      preload="none"
                    />
                  )}
                </article>
              );
            })}

            <div className="flex items-center justify-between mt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`flex items-center gap-1 text-sm rounded-lg border px-3 py-2 disabled:opacity-40 ${
                  isLight ? "border-slate-300" : "border-white/10"
                }`}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <span className={`text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Page {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className={`flex items-center gap-1 text-sm rounded-lg border px-3 py-2 disabled:opacity-40 ${
                  isLight ? "border-slate-300" : "border-white/10"
                }`}
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
