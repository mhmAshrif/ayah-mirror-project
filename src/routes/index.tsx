import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  CloudRain,
  Pause,
  Pencil,
  Play,
  Quote,
  RefreshCw,
  Send,
  Sparkles,
  Sun,
  Unplug,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getDailyVerse,
  getVerseContent,
  type VerseContent,
} from "@/lib/quran.functions";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { computeStreak, uniqueDays } from "@/lib/streak";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AyahMirror — A verse for what your heart is carrying" },
      {
        name: "description",
        content:
          "Tell AyahMirror what you're feeling. Receive one Quranic verse and one small action, chosen for this moment.",
      },
    ],
  }),
  component: Index,
});

type EmotionKey = "anxious" | "sad" | "disconnected" | "grateful";
type EmotionMeta = {
  key: EmotionKey;
  label: string;
  blurb: string;
  icon: LucideIcon;
};

const EMOTIONS: EmotionMeta[] = [
  { key: "anxious", label: "Anxious", blurb: "Heart racing, mind looping", icon: Wind },
  { key: "sad", label: "Sad", blurb: "Heavy, tearful, deflated", icon: CloudRain },
  { key: "disconnected", label: "Disconnected", blurb: "Distant, numb", icon: Unplug },
  { key: "grateful", label: "Grateful", blurb: "Wanting to give thanks", icon: Sun },
];

type Remedy = {
  surah: number;
  ayah: number;
  contextMessage: string;
  prescription: string;
};

function Index() {
  const navigate = useNavigate();
  const { userId, authReady, theme, prefs, privacyPublic, pushNotification } =
    useApp();
  const isLight = theme === "light";

  const [view, setView] = useState<"INPUT_STATE" | "REMEDY_STATE">("INPUT_STATE");
  const [selected, setSelected] = useState<EmotionKey | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [remedy, setRemedy] = useState<Remedy | null>(null);
  const [verse, setVerse] = useState<VerseContent | null>(null);
  const [verseLoading, setVerseLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // Daily verse
  const [daily, setDaily] = useState<VerseContent | null>(null);
  const [dailyPlaying, setDailyPlaying] = useState(false);
  const fetchDaily = useServerFn(getDailyVerse);
  const fetchVerse = useServerFn(getVerseContent);

  // Streak + reflection
  const [streak, setStreak] = useState(0);
  const [totalReflections, setTotalReflections] = useState(0);
  const [reflectionText, setReflectionText] = useState("");
  const [submittingReflection, setSubmittingReflection] = useState(false);

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  useEffect(() => {
    fetchDaily()
      .then(setDaily)
      .catch(() => undefined);
  }, [fetchDaily]);

  useEffect(() => {
    if (!userId) return;
    void loadStreak(userId);
    // Gentle reminder once per session
    pushNotification({
      kind: "reminder",
      title: "Log your reflection",
      body: "One sentence is enough.",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadStreak = async (uid: string) => {
    const { data } = await supabase
      .from("reflections")
      .select("created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(365);
    const rows = data ?? [];
    setTotalReflections(rows.length);
    setStreak(computeStreak(uniqueDays(rows.map((r) => r.created_at))));
  };

  const charCount = rawInput.length;
  const overLimit = charCount > 500;
  const canSubmit = useMemo(
    () => !!selected && !loading && !overLimit,
    [selected, loading, overLimit],
  );

  const handleSubmit = async () => {
    if (!canSubmit || !selected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/match-emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedEmotion: selected,
          rawInput: rawInput.slice(0, 500),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Remedy;
      setRemedy(data);
      setBookmarked(false);
      setVerse(null);
      setAudioPlaying(false);
      setView("REMEDY_STATE");

      setVerseLoading(true);
      fetchVerse({
        data: {
          surah: data.surah,
          ayah: data.ayah,
          translationId: prefs.translation_id,
          reciterId: prefs.reciter_id,
        },
      })
        .then(setVerse)
        .catch(() => toast.error("Couldn't load Quran verse."))
        .finally(() => setVerseLoading(false));

      if (userId) {
        await supabase.from("emotion_logs").insert({
          user_id: userId,
          emotion: selected,
          user_raw_input: rawInput.slice(0, 500) || null,
          surah_id: data.surah,
          ayah_number: data.ayah,
          context_message: data.contextMessage,
          prescription: data.prescription,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setView("INPUT_STATE");
    setRemedy(null);
    setVerse(null);
    setSelected(null);
    setRawInput("");
    setBookmarked(false);
    setAudioPlaying(false);
  };

  const toggleBookmark = async () => {
    if (!remedy || !userId || bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      if (bookmarked) {
        await supabase
          .from("spiritual_bookmarks")
          .delete()
          .eq("user_id", userId)
          .eq("surah_id", remedy.surah)
          .eq("ayah_number", remedy.ayah);
        setBookmarked(false);
        toast.success("Bookmark removed");
      } else {
        await supabase.from("spiritual_bookmarks").insert({
          user_id: userId,
          surah_id: remedy.surah,
          ayah_number: remedy.ayah,
          context_message: remedy.contextMessage,
          prescription: remedy.prescription,
          arabic: verse?.arabic ?? null,
          translation: verse?.translation ?? null,
          translation_author: verse?.translationAuthor ?? null,
          surah_name: verse?.surahNameEn ?? null,
        });
        setBookmarked(true);
        toast.success("Saved to bookmarks");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bookmark failed");
    } finally {
      setBookmarkBusy(false);
    }
  };

  const submitReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = reflectionText.trim();
    if (!text || !userId) return;
    setSubmittingReflection(true);
    try {
      const { error } = await supabase.from("reflections").insert({
        user_id: userId,
        content: text.slice(0, 280),
        is_public: privacyPublic,
        surah_id: remedy?.surah ?? null,
        ayah_number: remedy?.ayah ?? null,
      });
      if (error) throw error;
      setReflectionText("");
      toast.success("Reflection saved");
      await loadStreak(userId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSubmittingReflection(false);
    }
  };

  if (!authReady || !userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-500" />
      </main>
    );
  }

  const cardBg = isLight
    ? "bg-white/80 border-slate-200"
    : "bg-white/5 border-teal-500/30";

  return (
    <AppShell>
      {/* HERO */}
      <section className="flex flex-col items-center text-center">
        <h1
          className={`text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text ${
            isLight
              ? "bg-gradient-to-r from-slate-900 to-teal-600"
              : "bg-gradient-to-r from-white to-teal-400 drop-shadow-[0_0_15px_rgba(45,212,191,0.5)]"
          }`}
        >
          AyahMirror
        </h1>
        <div className="mt-3 flex items-center gap-2 text-teal-400/60">
          <span className="h-px w-8 sm:w-12 bg-teal-400/30" />
          <Sparkles className="h-3 w-3" />
          <span className="h-px w-8 sm:w-12 bg-teal-400/30" />
        </div>
        <p
          className={`mt-4 text-sm sm:text-lg ${
            isLight ? "text-slate-600" : "text-teal-100/80"
          }`}
        >
          How is your{" "}
          <span className={isLight ? "text-teal-700" : "text-teal-300"}>soul</span>{" "}
          feeling in this moment?
        </p>

        {/* Streak chip */}
        <div className="mt-4 flex gap-2 flex-wrap justify-center">
          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              isLight
                ? "border-teal-400/40 bg-teal-50 text-teal-700"
                : "border-teal-400/30 bg-teal-500/10 text-teal-200"
            }`}
          >
            🔥 {streak}-day streak
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              isLight
                ? "border-slate-300 bg-white text-slate-700"
                : "border-white/10 bg-white/5 text-slate-200"
            }`}
          >
            {totalReflections} reflections
          </span>
        </div>
      </section>

      {/* DAILY AYAH */}
      {daily && (
        <section className={`mt-8 max-w-3xl mx-auto w-full rounded-3xl border p-5 sm:p-6 backdrop-blur-xl ${cardBg}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div
              className={`flex items-center gap-2 text-xs uppercase tracking-wide ${
                isLight ? "text-teal-700" : "text-teal-300"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Today's Verse · {daily.surahNameEn} ({daily.verseKey})
            </div>
            {daily.audioUrl && (
              <button
                onClick={() => {
                  const el = document.getElementById("daily-audio") as HTMLAudioElement | null;
                  if (!el) return;
                  if (dailyPlaying) el.pause();
                  else void el.play();
                }}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                  isLight
                    ? "border-teal-400/50 bg-teal-50 text-teal-700 hover:bg-teal-100"
                    : "border-teal-400/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20"
                }`}
              >
                {dailyPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {dailyPlaying ? "Pause" : "Listen"}
              </button>
            )}
          </div>
          <p
            dir="rtl"
            lang="ar"
            className={`mt-4 text-right text-2xl sm:text-3xl leading-[2.4] font-[Amiri,'Scheherazade_New',serif] ${
              isLight ? "text-slate-900" : "text-white"
            }`}
          >
            {daily.arabic}
          </p>
          <p
            className={`mt-3 text-sm sm:text-base leading-relaxed ${
              isLight ? "text-slate-700" : "text-slate-200"
            }`}
          >
            "{daily.translation}"
          </p>
          {daily.audioUrl && (
            <audio
              id="daily-audio"
              src={daily.audioUrl}
              onPlay={() => setDailyPlaying(true)}
              onPause={() => setDailyPlaying(false)}
              onEnded={() => setDailyPlaying(false)}
              preload="none"
            />
          )}
        </section>
      )}

      {/* MAIN CARD */}
      <div className="mt-8 flex flex-col items-center">
        {view === "REMEDY_STATE" && remedy ? (
          <article
            className={`w-full max-w-3xl rounded-3xl border p-5 sm:p-8 backdrop-blur-xl relative overflow-hidden ${cardBg}`}
          >
            <div className="flex items-center justify-between gap-3 relative flex-wrap">
              <div
                className={`flex items-center gap-2 rounded-full border px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium ${
                  isLight
                    ? "border-teal-400/50 bg-teal-50 text-teal-700"
                    : "border-teal-400/40 bg-teal-500/10 text-teal-300"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {verse
                  ? `${verse.surahNameEn} • ${remedy.surah}:${remedy.ayah}`
                  : `Surah ${remedy.surah} • Ayah ${remedy.ayah}`}
              </div>
              <button
                onClick={toggleBookmark}
                disabled={bookmarkBusy}
                className={`transition disabled:opacity-50 ${
                  isLight ? "text-slate-600 hover:text-teal-700" : "text-slate-300 hover:text-teal-300"
                }`}
                aria-label="Bookmark"
              >
                {bookmarked ? (
                  <BookmarkCheck className={`h-5 w-5 ${isLight ? "text-teal-600" : "text-teal-400"}`} />
                ) : (
                  <Bookmark className="h-5 w-5" />
                )}
              </button>
            </div>

            <div
              className={`mt-6 rounded-2xl border p-4 sm:p-6 ${
                isLight ? "border-teal-200 bg-teal-50/50" : "border-teal-400/20 bg-[#031a1a]/40"
              }`}
            >
              {verseLoading && !verse ? (
                <div className={`flex items-center gap-2 text-sm ${isLight ? "text-teal-700" : "text-teal-300/70"}`}>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading verse from Quran Foundation…
                </div>
              ) : verse ? (
                <>
                  <p
                    dir="rtl"
                    lang="ar"
                    className={`text-right text-2xl sm:text-4xl leading-[2.4] font-[Amiri,'Scheherazade_New',serif] ${
                      isLight ? "text-slate-900" : "text-white"
                    }`}
                  >
                    {verse.arabic}
                  </p>
                  <p className={`mt-4 text-sm sm:text-base leading-relaxed ${isLight ? "text-slate-700" : "text-slate-200"}`}>
                    "{verse.translation}"
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <span className={`text-[11px] uppercase tracking-wide ${isLight ? "text-teal-700/70" : "text-teal-400/60"}`}>
                      — {verse.translationAuthor}
                    </span>
                    {verse.audioUrl && (
                      <button
                        onClick={() => {
                          const el = document.getElementById("ayah-audio") as HTMLAudioElement | null;
                          if (!el) return;
                          if (audioPlaying) el.pause();
                          else void el.play();
                        }}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                          isLight
                            ? "border-teal-400/50 bg-teal-50 text-teal-700 hover:bg-teal-100"
                            : "border-teal-400/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20"
                        }`}
                      >
                        {audioPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {audioPlaying ? "Pause" : "Listen"}
                      </button>
                    )}
                  </div>
                  {verse.audioUrl && (
                    <audio
                      id="ayah-audio"
                      src={verse.audioUrl}
                      onPlay={() => setAudioPlaying(true)}
                      onPause={() => setAudioPlaying(false)}
                      onEnded={() => setAudioPlaying(false)}
                      preload="none"
                    />
                  )}
                </>
              ) : (
                <div className="text-sm opacity-60">Verse text unavailable.</div>
              )}
            </div>

            <div className="mt-6 relative">
              <Quote className={`h-6 w-6 ${isLight ? "text-teal-600/70" : "text-teal-400/70"}`} />
              <blockquote
                className={`mt-3 font-serif italic text-xl sm:text-2xl md:text-3xl leading-snug ${
                  isLight ? "text-slate-900" : "text-white"
                }`}
              >
                {remedy.contextMessage}
              </blockquote>
            </div>

            <div className="my-6 flex items-center justify-center gap-3 text-teal-500/40">
              <span className="h-px w-16 sm:w-20 bg-teal-500/20" />
              <span className="text-xs">✦</span>
              <span className="h-px w-16 sm:w-20 bg-teal-500/20" />
            </div>

            <div
              className={`rounded-2xl border p-4 sm:p-5 ${
                isLight ? "border-amber-300 bg-amber-50" : "border-amber-400/30 bg-amber-400/10"
              }`}
            >
              <div className={`text-[10px] font-semibold uppercase tracking-[0.25em] mb-1 ${isLight ? "text-amber-700" : "text-amber-300"}`}>
                Prescription
              </div>
              <p className={`text-sm sm:text-base font-medium leading-relaxed ${isLight ? "text-amber-900" : "text-amber-50"}`}>
                {remedy.prescription}
              </p>
            </div>

            {/* Reflection */}
            <form onSubmit={submitReflection} className="mt-6">
              <label className={`text-xs uppercase tracking-wide ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                One sentence about this moment ({privacyPublic ? "public" : "private"})
              </label>
              <div className="mt-2 flex gap-2 flex-col sm:flex-row">
                <input
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value.slice(0, 280))}
                  placeholder="What did this verse stir in you?"
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-400/40 ${
                    isLight
                      ? "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                      : "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
                  }`}
                />
                <button
                  type="submit"
                  disabled={!reflectionText.trim() || submittingReflection}
                  className="flex items-center justify-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-4 py-2.5 disabled:opacity-50"
                >
                  {submittingReflection ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </form>

            <div className="mt-6 flex justify-center">
              <button
                onClick={handleReset}
                className={`text-xs underline-offset-4 hover:underline ${isLight ? "text-slate-600" : "text-slate-400"}`}
              >
                ← Choose another emotion
              </button>
            </div>
          </article>
        ) : (
          <div className={`w-full max-w-3xl rounded-3xl border p-5 sm:p-8 backdrop-blur-xl ${cardBg}`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {EMOTIONS.map((e) => {
                const Icon = e.icon;
                const active = selected === e.key;
                return (
                  <button
                    key={e.key}
                    onClick={() => setSelected(e.key)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? isLight
                          ? "border-teal-500 bg-teal-50 shadow-[0_0_20px_rgba(45,212,191,0.2)]"
                          : "border-teal-400 bg-teal-500/10 shadow-[0_0_20px_rgba(45,212,191,0.25)]"
                        : isLight
                        ? "border-slate-200 hover:border-teal-400/50 bg-white"
                        : "border-white/10 hover:border-teal-400/30 bg-white/5"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? (isLight ? "text-teal-700" : "text-teal-300") : isLight ? "text-slate-500" : "text-slate-400"}`} />
                    <div className={`mt-2 text-sm font-medium ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                      {e.label}
                    </div>
                    <div className={`mt-0.5 text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                      {e.blurb}
                    </div>
                  </button>
                );
              })}
            </div>

            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Optional: what's happening in your heart? (max 500 chars)"
              rows={3}
              className={`mt-4 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-400/40 ${
                isLight
                  ? "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  : "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
              }`}
            />
            <div className={`mt-1 text-right text-xs ${overLimit ? "text-rose-400" : isLight ? "text-slate-500" : "text-slate-500"}`}>
              {charCount}/500
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium py-3 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Find my verse
            </button>
          </div>
        )}
      </div>

      <footer className={`mt-12 text-center text-xs ${isLight ? "text-teal-700/70" : "text-teal-600"}`}>
        "And We have certainly made the Quran easy for remembrance, so is there any who will remember?" — Surah Al-Qamar (54:17)
      </footer>
    </AppShell>
  );
}
