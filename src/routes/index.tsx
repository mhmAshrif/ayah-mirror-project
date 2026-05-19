import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Heart,
  LogOut,
  RefreshCw,
  Sparkles,
  Wind,
  CloudRain,
  Unplug,
  Sun,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  ring: string;
  accent: string;
};

const EMOTIONS: EmotionMeta[] = [
  {
    key: "anxious",
    label: "Anxious",
    blurb: "Heart racing, mind looping",
    icon: Wind,
    ring: "border-sky-400/70 shadow-[0_0_0_3px_rgba(56,189,248,0.15)]",
    accent: "text-sky-300",
  },
  {
    key: "sad",
    label: "Sad",
    blurb: "Heavy, tearful, deflated",
    icon: CloudRain,
    ring: "border-indigo-400/70 shadow-[0_0_0_3px_rgba(129,140,248,0.15)]",
    accent: "text-indigo-300",
  },
  {
    key: "disconnected",
    label: "Disconnected",
    blurb: "Distant from Allah, numb",
    icon: Unplug,
    ring: "border-amber-400/70 shadow-[0_0_0_3px_rgba(251,191,36,0.15)]",
    accent: "text-amber-300",
  },
  {
    key: "grateful",
    label: "Grateful",
    blurb: "Wanting to give thanks",
    icon: Sun,
    ring: "border-emerald-400/70 shadow-[0_0_0_3px_rgba(52,211,153,0.15)]",
    accent: "text-emerald-300",
  },
];

type Remedy = {
  surah: number;
  ayah: number;
  contextMessage: string;
  prescription: string;
};

type ViewState = "INPUT_STATE" | "REMEDY_STATE";

function Index() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [view, setView] = useState<ViewState>("INPUT_STATE");
  const [selected, setSelected] = useState<EmotionKey | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [remedy, setRemedy] = useState<Remedy | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  const charCount = rawInput.length;
  const overLimit = charCount > 500;
  const canSubmit = useMemo(() => !!selected && !loading && !overLimit, [selected, loading, overLimit]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/match-emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedEmotion: selected, rawInput: rawInput.slice(0, 500) }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "Request failed");
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Remedy;
      setRemedy(data);
      setBookmarked(false);
      setView("REMEDY_STATE");

      if (userId) {
        try {
          await supabase.from("emotion_logs").insert({
            user_id: userId,
            emotion: selected,
            user_raw_input: rawInput.slice(0, 500) || null,
            surah_id: data.surah,
            ayah_number: data.ayah,
            context_message: data.contextMessage,
            prescription: data.prescription,
          });
        } catch (logErr) {
          console.error("log insert failed", logErr);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load your verse. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setView("INPUT_STATE");
    setRemedy(null);
    setSelected(null);
    setRawInput("");
    setBookmarked(false);
  };

  const toggleBookmark = async () => {
    if (!remedy || !userId || bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      if (bookmarked) {
        const { error } = await supabase
          .from("spiritual_bookmarks")
          .delete()
          .eq("user_id", userId)
          .eq("surah_id", remedy.surah)
          .eq("ayah_number", remedy.ayah);
        if (error) throw error;
        setBookmarked(false);
        toast.success("Bookmark removed");
      } else {
        const { error } = await supabase.from("spiritual_bookmarks").insert({
          user_id: userId,
          surah_id: remedy.surah,
          ayah_number: remedy.ayah,
          context_message: remedy.contextMessage,
          prescription: remedy.prescription,
        });
        if (error) throw error;
        setBookmarked(true);
        toast.success("Saved to your bookmarks");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bookmark failed");
    } finally {
      setBookmarkBusy(false);
    }
  };

  if (!authReady || !userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <Loader />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.10),transparent_55%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-emerald-400" />
            <h1 className="text-lg font-semibold tracking-tight">AyahMirror</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/bookmarks"
              className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-400 backdrop-blur-md transition hover:text-slate-100"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Bookmarks
            </a>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-400 backdrop-blur-md transition hover:text-slate-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </header>

        {view === "INPUT_STATE" ? (
          <section className="mt-10 flex flex-1 flex-col">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              What is your heart carrying right now?
            </h2>
            <p className="mt-2 text-sm text-slate-400 sm:text-base">
              Pick one. Then say a little more if you'd like. You'll receive one verse and one small thing to do.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EMOTIONS.map((e) => {
                const isSelected = selected === e.key;
                const Icon = e.icon;
                return (
                  <button
                    key={e.key}
                    onClick={() => setSelected(e.key)}
                    className={`group flex items-start gap-3 rounded-xl border bg-slate-900/40 p-4 text-left backdrop-blur-md transition ${
                      isSelected
                        ? e.ring
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950/60 ${e.accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-100">{e.label}</span>
                      <span className="text-xs text-slate-400">{e.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <label htmlFor="rawInput" className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Say a little more (optional)
              </label>
              <textarea
                id="rawInput"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={4}
                placeholder="I keep waking up at 3am and my chest feels tight..."
                className="mt-2 w-full resize-none rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 backdrop-blur-md focus:border-emerald-500/50 focus:outline-none"
              />
              <div className="mt-1 flex justify-end text-xs text-slate-500">
                <span className={overLimit ? "text-rose-400" : ""}>{charCount} / 500</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Reflecting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Reveal my verse
                </>
              )}
            </button>
          </section>
        ) : (
          remedy && (
            <section className="mt-10 flex flex-1 flex-col">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
                    A Verse For You
                  </span>
                  <button
                    onClick={toggleBookmark}
                    disabled={bookmarkBusy}
                    className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:text-emerald-300 disabled:opacity-50"
                    aria-pressed={bookmarked}
                  >
                    {bookmarked ? (
                      <>
                        <BookmarkCheck className="h-3.5 w-3.5 text-emerald-400" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-3.5 w-3.5" />
                        Bookmark
                      </>
                    )}
                  </button>
                </div>

                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Surah {remedy.surah} : Ayah {remedy.ayah}
                </h2>

                <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <p className="text-base italic leading-relaxed text-slate-200 sm:text-lg">
                    {remedy.contextMessage}
                  </p>
                </div>

                <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-5">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-300">
                    Your prescription · within 24 hours
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-amber-50 sm:text-base">
                    {remedy.prescription}
                  </p>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="mt-6 self-center rounded-lg border border-slate-800 bg-slate-900/40 px-5 py-2.5 text-sm text-slate-300 backdrop-blur-md transition hover:text-slate-100"
              >
                Reflect on something else
              </button>
            </section>
          )
        )}

        <footer className="mt-12 text-center text-xs text-slate-600">
          AyahMirror · meet your heart where it is
        </footer>
      </div>
    </main>
  );
}

function Loader() {
  return <RefreshCw className="h-5 w-5 animate-spin text-slate-500" />;
}
