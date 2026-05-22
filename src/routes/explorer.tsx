import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Languages,
  Pause,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";

export const Route = createFileRoute("/explorer")({
  head: () => ({ meta: [{ title: "Quran Explorer — AyahMirror" }] }),
  component: ExplorerPage,
});

type SurahMeta = {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name: { name: string };
  verses_count: number;
  revelation_place: string;
};

type ApiVerse = {
  id: number;
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
  audio?: { url: string } | null;
  translations: { id: number; text: string; resource_name?: string }[];
};

type LastReadMarker = {
  surahId: number;
  surahName: string;
  verseKey: string;
  verseNumber: number;
  text: string;
  savedAt: number;
};

const LS_KEY = "ayahmirror:lastRead";

const TRANSLATIONS = [
  { id: 131, label: "English — Dr. Mustafa Khattab" },
  { id: 20, label: "English — Saheeh International" },
  { id: 97, label: "Urdu — Maulana Maududi" },
  { id: 31, label: "French — Hamidullah" },
  { id: 33, label: "Indonesian — Kemenag" },
  { id: 77, label: "Turkish — Diyanet" },
];

function stripHtml(s: string): string {
  return s.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "");
}

function ExplorerPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme, pushNotification } = useApp();
  const isLight = theme === "light";

  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [surahsLoading, setSurahsLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [translationId, setTranslationId] = useState<number>(131);

  const [verses, setVerses] = useState<ApiVerse[]>([]);
  const [versesLoading, setVersesLoading] = useState(false);
  const [versesError, setVersesError] = useState<string | null>(null);

  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [lastRead, setLastRead] = useState<LastReadMarker | null>(null);

  // auth guard
  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  // hydrate last read marker
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setLastRead(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    const onResume = (e: Event) => {
      const detail = (e as CustomEvent<{ surahId: number; verseKey: string }>).detail;
      if (!detail) return;
      setSelectedSurah(detail.surahId);
      // scroll after verses load
      setTimeout(() => {
        const el = document.getElementById(`verse-${detail.verseKey}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 1200);
    };
    window.addEventListener("ayahmirror:resume-reading", onResume);
    return () => window.removeEventListener("ayahmirror:resume-reading", onResume);
  }, []);

  // fetch surah list
  useEffect(() => {
    let cancelled = false;
    setSurahsLoading(true);
    fetch("https://api.quran.com/api/v4/chapters?language=en")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setSurahs(j.chapters ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load surahs");
      })
      .finally(() => !cancelled && setSurahsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // fetch verses when surah/translation changes
  useEffect(() => {
    if (selectedSurah == null) return;
    let cancelled = false;
    setVersesLoading(true);
    setVersesError(null);
    setVerses([]);
    const url =
      `https://api.quran.com/api/v4/verses/by_chapter/${selectedSurah}` +
      `?language=en&words=false&translations=${translationId}` +
      `&audio=7&fields=text_uthmani&per_page=300`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setVerses(j.verses ?? []);
      })
      .catch((e) => {
        if (!cancelled) setVersesError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => !cancelled && setVersesLoading(false));
    // scroll to top of read view
    window.scrollTo({ top: 0, behavior: "smooth" });
    return () => {
      cancelled = true;
    };
  }, [selectedSurah, translationId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return surahs;
    return surahs.filter(
      (x) =>
        x.name_simple.toLowerCase().includes(s) ||
        x.translated_name.name.toLowerCase().includes(s) ||
        String(x.id) === s,
    );
  }, [q, surahs]);

  const currentSurah = useMemo(
    () => surahs.find((s) => s.id === selectedSurah) ?? null,
    [surahs, selectedSurah],
  );

  const togglePlay = useCallback((key: string, url: string | undefined) => {
    if (!url) {
      toast.error("Audio unavailable for this verse");
      return;
    }
    const fullUrl = url.startsWith("http") ? url : `https://verses.quran.com/${url}`;
    if (playingKey === key && audioRef.current) {
      audioRef.current.pause();
      setPlayingKey(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const a = new Audio(fullUrl);
    audioRef.current = a;
    a.onended = () => setPlayingKey(null);
    a.onerror = () => {
      setPlayingKey(null);
      toast.error("Couldn't play audio");
    };
    void a.play().then(() => setPlayingKey(key));
  }, [playingKey]);

  const markAsLastRead = useCallback(
    (v: ApiVerse) => {
      if (!currentSurah) return;
      const text = v.translations?.[0]?.text ? stripHtml(v.translations[0].text) : "";
      const marker: LastReadMarker = {
        surahId: currentSurah.id,
        surahName: currentSurah.name_simple,
        verseKey: v.verse_key,
        verseNumber: v.verse_number,
        text: text.slice(0, 120),
        savedAt: Date.now(),
      };
      setLastRead(marker);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(marker));
      } catch {
        /* ignore */
      }
      pushNotification({
        kind: "reminder",
        title: `📍 Resume Reading: Surah ${marker.surahName}, Verse ${marker.verseNumber}`,
        body: marker.text,
      } as Parameters<typeof pushNotification>[0]);
      toast.success("Saved to Notifications");
    },
    [currentSurah, pushNotification],
  );

  return (
    <AppShell>
      <section className="max-w-5xl mx-auto">
        {selectedSurah == null ? (
          <ListView
            isLight={isLight}
            q={q}
            setQ={setQ}
            loading={surahsLoading}
            surahs={filtered}
            onSelect={(id) => setSelectedSurah(id)}
            lastRead={lastRead}
            onResumeLastRead={() => {
              if (lastRead) setSelectedSurah(lastRead.surahId);
            }}
          />
        ) : (
          <ReadView
            isLight={isLight}
            surah={currentSurah}
            surahId={selectedSurah}
            verses={verses}
            loading={versesLoading}
            error={versesError}
            translationId={translationId}
            setTranslationId={setTranslationId}
            onBack={() => {
              if (audioRef.current) audioRef.current.pause();
              setPlayingKey(null);
              setSelectedSurah(null);
            }}
            playingKey={playingKey}
            togglePlay={togglePlay}
            lastRead={lastRead}
            markAsLastRead={markAsLastRead}
          />
        )}
      </section>
    </AppShell>
  );
}

function ListView({
  isLight,
  q,
  setQ,
  loading,
  surahs,
  onSelect,
  lastRead,
  onResumeLastRead,
}: {
  isLight: boolean;
  q: string;
  setQ: (s: string) => void;
  loading: boolean;
  surahs: SurahMeta[];
  onSelect: (id: number) => void;
  lastRead: LastReadMarker | null;
  onResumeLastRead: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <BookOpen className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`} />
        <h1
          className={`text-2xl sm:text-3xl font-semibold ${
            isLight ? "text-slate-900" : "text-white"
          }`}
        >
          Quran Explorer
        </h1>
      </div>
      <p className={`mt-1 text-sm ${isLight ? "text-slate-600" : "text-slate-400"}`}>
        All 114 surahs. Tap one to read verses, hear recitation, and mark where you stopped.
      </p>

      {lastRead && (
        <button
          onClick={onResumeLastRead}
          className={`mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm backdrop-blur-md transition ${
            isLight
              ? "border-teal-400/60 bg-teal-50 text-teal-800 hover:bg-teal-100"
              : "border-teal-400/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20"
          }`}
        >
          <Bookmark className="h-4 w-4" />
          Resume: Surah {lastRead.surahName}, Verse {lastRead.verseNumber}
        </button>
      )}

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
          className={`w-full rounded-xl border pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-400/40 backdrop-blur-md ${
            isLight
              ? "border-slate-300 bg-white"
              : "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
          }`}
        />
      </div>

      {loading ? (
        <div
          className={`mt-10 flex items-center gap-2 ${
            isLight ? "text-slate-600" : "text-slate-400"
          }`}
        >
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading surahs…
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {surahs.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`text-left rounded-2xl border p-4 transition flex items-center gap-3 backdrop-blur-md ${
                isLight
                  ? "border-slate-200 bg-white hover:border-teal-400/60 hover:shadow-sm"
                  : "border-white/10 bg-white/5 hover:border-teal-400/40 hover:bg-white/10"
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
                <div
                  className={`text-sm font-medium truncate ${
                    isLight ? "text-slate-900" : "text-slate-100"
                  }`}
                >
                  {s.name_simple}
                </div>
                <div
                  className={`text-xs truncate ${
                    isLight ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {s.translated_name.name} · {s.verses_count} verses
                </div>
              </div>
              <div
                className={`text-lg font-[Amiri,serif] ${
                  isLight ? "text-slate-700" : "text-emerald-100"
                }`}
                dir="rtl"
              >
                {s.name_arabic}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ReadView({
  isLight,
  surah,
  surahId,
  verses,
  loading,
  error,
  translationId,
  setTranslationId,
  onBack,
  playingKey,
  togglePlay,
  lastRead,
  markAsLastRead,
}: {
  isLight: boolean;
  surah: SurahMeta | null;
  surahId: number;
  verses: ApiVerse[];
  loading: boolean;
  error: string | null;
  translationId: number;
  setTranslationId: (n: number) => void;
  onBack: () => void;
  playingKey: string | null;
  togglePlay: (key: string, url: string | undefined) => void;
  lastRead: LastReadMarker | null;
  markAsLastRead: (v: ApiVerse) => void;
}) {
  return (
    <>
      <button
        onClick={onBack}
        className={`inline-flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5 border transition ${
          isLight
            ? "border-slate-300 text-slate-700 hover:bg-slate-100"
            : "border-white/10 text-slate-300 hover:bg-white/5"
        }`}
      >
        <ArrowLeft className="h-4 w-4" /> Back to Surahs
      </button>

      <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen
              className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`}
            />
            <h1
              className={`text-2xl sm:text-3xl font-semibold ${
                isLight ? "text-slate-900" : "text-white"
              }`}
            >
              {surah ? surah.name_simple : `Surah ${surahId}`}
            </h1>
          </div>
          {surah && (
            <div
              className={`text-xs mt-1 ${
                isLight ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {surah.translated_name.name} · {surah.verses_count} verses ·{" "}
              {surah.revelation_place}
            </div>
          )}
        </div>

        <div className="relative">
          <label
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs backdrop-blur-md ${
              isLight
                ? "border-slate-300 bg-white text-slate-700"
                : "border-white/10 bg-white/5 text-slate-200"
            }`}
          >
            <Languages className="h-3.5 w-3.5" />
            <span className="opacity-70">Translation</span>
            <select
              value={translationId}
              onChange={(e) => setTranslationId(Number(e.target.value))}
              className={`bg-transparent outline-none text-xs ${
                isLight ? "text-slate-800" : "text-slate-100"
              }`}
            >
              {TRANSLATIONS.map((t) => (
                <option
                  key={t.id}
                  value={t.id}
                  className={isLight ? "text-slate-900" : "bg-slate-900 text-slate-100"}
                >
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading && (
        <div
          className={`mt-10 flex items-center gap-2 ${
            isLight ? "text-slate-600" : "text-slate-400"
          }`}
        >
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading verses…
        </div>
      )}

      {error && !loading && (
        <div
          className={`mt-6 rounded-xl border p-4 text-sm ${
            isLight
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-rose-400/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          Couldn't load verses: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="mt-6 flex flex-col gap-4">
          {verses.map((v) => {
            const isLast =
              lastRead?.surahId === surahId && lastRead?.verseKey === v.verse_key;
            const isPlaying = playingKey === v.verse_key;
            const translation = v.translations?.[0];
            return (
              <article
                key={v.id}
                id={`verse-${v.verse_key}`}
                className={`rounded-2xl border p-6 backdrop-blur-md transition ${
                  isLast
                    ? "border-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.3)] bg-teal-500/5"
                    : isLight
                    ? "border-slate-200 bg-white"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span
                    className={`text-xs rounded-full px-2.5 py-0.5 ${
                      isLight ? "bg-teal-50 text-teal-700" : "bg-teal-500/10 text-teal-300"
                    }`}
                  >
                    {v.verse_key}
                  </span>
                  <button
                    onClick={() => togglePlay(v.verse_key, v.audio?.url)}
                    className={`flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 transition ${
                      isLight
                        ? "border-teal-400/50 bg-teal-50 text-teal-700 hover:bg-teal-100"
                        : "border-teal-400/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20"
                    }`}
                  >
                    {isPlaying ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    {isPlaying ? "Pause" : "Play Audio"}
                  </button>
                </div>

                <p
                  dir="rtl"
                  lang="ar"
                  className={`mt-4 font-serif text-3xl text-right leading-loose ${
                    isLight ? "text-slate-900" : "text-emerald-100"
                  }`}
                >
                  {v.text_uthmani}
                </p>

                {translation && (
                  <p
                    className={`mt-3 text-sm sm:text-base leading-relaxed ${
                      isLight ? "text-slate-700" : "text-slate-200"
                    }`}
                  >
                    {stripHtml(translation.text)}
                  </p>
                )}

                <div className="mt-4">
                  <button
                    onClick={() => markAsLastRead(v)}
                    className={`text-xs rounded-full border px-3 py-1.5 transition ${
                      isLast
                        ? isLight
                          ? "border-teal-500 bg-teal-100 text-teal-800"
                          : "border-teal-400 bg-teal-500/20 text-teal-100"
                        : isLight
                        ? "border-slate-300 text-slate-600 hover:bg-slate-100"
                        : "border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {isLast ? "📍 You stopped here" : "📍 Mark as Last Read"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
