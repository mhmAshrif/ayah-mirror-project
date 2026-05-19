import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
  Home,
  Compass,
  Settings,
  TrendingUp,
  Pencil,
  Bell,
  Quote,
  ArrowRight,
  Waves,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import oceanBg from "@/assets/ocean-bg.png";

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

type ViewState = "INPUT_STATE" | "REMEDY_STATE";

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: Home, to: "/" as const },
  { key: "today", label: "Today for You", icon: Heart, to: "/" as const },
  { key: "explorer", label: "Quran Explorer", icon: BookOpen, to: "/" as const },
  { key: "reflections", label: "Reflections", icon: Pencil, to: "/" as const },
  { key: "progress", label: "Progress", icon: TrendingUp, to: "/" as const },
  { key: "bookmarks", label: "Bookmarks", icon: Bookmark, to: "/bookmarks" as const },
  { key: "journey", label: "Journey", icon: Compass, to: "/" as const },
  { key: "settings", label: "Settings", icon: Settings, to: "/" as const },
];

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
  const canSubmit = useMemo(
    () => !!selected && !loading && !overLimit,
    [selected, loading, overLimit]
  );

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

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  if (!authReady || !userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-500" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a192f] to-slate-950 text-slate-200">
      {/* Subtle atmospheric glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(20,184,166,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(56,189,248,0.08),transparent_60%)]" />

      <div className="relative flex min-h-screen w-full">
        {/* SIDEBAR */}
        <aside className="hidden md:flex w-64 m-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex-col justify-between p-4">
          <div>
            <div className="flex items-center gap-2.5 px-2 pb-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400/30 to-cyan-500/10 border border-teal-400/30">
                <Sparkles className="h-4 w-4 text-teal-300" />
              </div>
              <span className="text-base font-semibold tracking-tight text-slate-100">AyahMirror</span>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === "home";
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      isActive
                        ? "bg-gradient-to-r from-teal-500/20 to-transparent border-l-2 border-teal-400 text-teal-300"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-l-2 border-transparent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <Waves className="h-4 w-4 text-teal-400 mb-2" />
            <div className="text-sm font-medium text-slate-100">Mirissa, Sri Lanka</div>
            <div className="mt-1 text-xs text-slate-400">Peace. Purpose. Presence.</div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex-1 flex flex-col px-5 py-6 sm:px-8 sm:py-8">
          {/* HEADER */}
          <header className="flex items-center justify-between gap-4">
            <div className="md:hidden flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-300" />
              <span className="text-base font-semibold">AyahMirror</span>
            </div>

            <div className="hidden md:flex flex-1 justify-center">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-300 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-teal-300" />
                Quranic Wellness Mirror
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="text-slate-400 hover:text-teal-300 transition" aria-label="Theme">
                <Sun className="h-4 w-4" />
              </button>
              <button className="relative text-slate-400 hover:text-teal-300 transition" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-teal-400" />
              </button>
              <div className="h-5 w-px bg-white/10" />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition"
                aria-label="Sign out"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400/40 to-cyan-600/30 border border-white/10 flex items-center justify-center">
                  <LogOut className="h-3.5 w-3.5 text-slate-200" />
                </div>
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </header>

          {/* HERO */}
          <section className="mt-8 sm:mt-12 flex flex-col items-center text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-teal-400 drop-shadow-[0_0_15px_rgba(45,212,191,0.5)]">
              AyahMirror
            </h1>
            <div className="mt-3 flex items-center gap-2 text-teal-400/60">
              <span className="h-px w-12 bg-teal-400/30" />
              <Sparkles className="h-3 w-3" />
              <span className="h-px w-12 bg-teal-400/30" />
            </div>
            <p className="mt-4 text-base sm:text-lg text-teal-100/80">
              How is your <span className="text-teal-300">soul</span> feeling in this moment?
            </p>
          </section>

          {/* MAIN CARD */}
          <div className="mt-8 flex flex-col items-center">
            {view === "REMEDY_STATE" && remedy ? (
              <article className="w-full max-w-3xl rounded-3xl bg-white/5 backdrop-blur-xl border border-teal-500/30 p-6 sm:p-8 shadow-[0_8px_32px_0_rgba(15,118,110,0.2)] relative overflow-hidden">
                <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />

                <div className="flex items-center justify-between gap-3 relative">
                  <div className="flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-500/10 px-4 py-1.5 text-xs sm:text-sm font-medium text-teal-300 shadow-[0_0_20px_rgba(45,212,191,0.2)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Spiritual Remedy: Surah {remedy.surah} • Ayah {remedy.ayah}
                  </div>
                  <button
                    onClick={toggleBookmark}
                    disabled={bookmarkBusy}
                    className="text-slate-300 hover:text-teal-300 transition disabled:opacity-50"
                    aria-label="Bookmark"
                  >
                    {bookmarked ? (
                      <BookmarkCheck className="h-5 w-5 text-teal-400" />
                    ) : (
                      <Bookmark className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <div className="mt-6 relative">
                  <Quote className="h-8 w-8 text-teal-400/70" />
                  <blockquote className="mt-3 font-serif italic text-3xl md:text-5xl text-white leading-snug">
                    {remedy.contextMessage}
                  </blockquote>
                </div>

                <div className="my-6 flex items-center justify-center gap-3 text-teal-500/40">
                  <span className="h-px w-20 bg-teal-500/20" />
                  <span className="text-xs">✦</span>
                  <span className="h-px w-20 bg-teal-500/20" />
                </div>

                <div className="bg-[#042f2e]/50 border border-teal-500/20 rounded-xl p-5 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-teal-400/40 bg-teal-500/10 shadow-[0_0_20px_rgba(45,212,191,0.25)]">
                    <Pencil className="h-5 w-5 text-teal-300" />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-semibold text-teal-300">
                      Your 24-Hour Micro-Prescription
                    </div>
                    <p className="mt-1 text-sm sm:text-base text-slate-200 leading-relaxed">
                      {remedy.prescription}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleReset}
                    className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs text-slate-300 hover:text-teal-300 transition"
                  >
                    Reflect on something else
                  </button>
                </div>
              </article>
            ) : (
              <article className="w-full max-w-3xl rounded-3xl bg-white/5 backdrop-blur-xl border border-teal-500/30 p-6 sm:p-8 shadow-[0_8px_32px_0_rgba(15,118,110,0.2)] relative overflow-hidden">
                <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />

                <div className="flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-500/10 px-4 py-1.5 w-fit text-xs sm:text-sm font-medium text-teal-300 shadow-[0_0_20px_rgba(45,212,191,0.2)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Choose what your heart is carrying
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {EMOTIONS.map((e) => {
                    const isSelected = selected === e.key;
                    const Icon = e.icon;
                    return (
                      <button
                        key={e.key}
                        onClick={() => setSelected(e.key)}
                        className={`group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition backdrop-blur-md ${
                          isSelected
                            ? "border-teal-400/60 bg-teal-500/10 shadow-[0_0_25px_rgba(45,212,191,0.25)]"
                            : "border-white/10 bg-white/5 hover:border-teal-400/30"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                            isSelected
                              ? "border-teal-400/50 bg-teal-500/20 text-teal-200"
                              : "border-white/10 bg-white/5 text-teal-300/70"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{e.label}</div>
                          <div className="text-[11px] text-slate-400 leading-snug">{e.blurb}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6">
                  <textarea
                    value={rawInput}
                    onChange={(ev) => setRawInput(ev.target.value.slice(0, 500))}
                    maxLength={500}
                    rows={3}
                    placeholder="Say a little more (optional)... I keep waking up at 3am and my chest feels tight."
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 backdrop-blur-md focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/30"
                  />
                  <div className="mt-1 flex justify-end text-xs text-slate-500">
                    <span className={overLimit ? "text-rose-400" : ""}>{charCount} / 500</span>
                  </div>
                </div>
              </article>
            )}

            {/* BOTTOM ACTION BAR */}
            <form
              onSubmit={handleQuickSubmit}
              className="mt-6 w-full max-w-2xl bg-white/5 backdrop-blur-md border border-white/10 rounded-full flex items-center px-5 py-3 shadow-[0_0_30px_rgba(15,118,110,0.1)]"
            >
              <Heart className="h-4 w-4 text-teal-300 shrink-0" />
              <input
                type="text"
                value={rawInput}
                onChange={(ev) => setRawInput(ev.target.value.slice(0, 500))}
                placeholder={selected ? "Press → to reveal your verse" : "Pick a feeling above, then press →"}
                className="flex-1 mx-3 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!canSubmit}
                aria-label="Reveal verse"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal-400/40 bg-teal-500/20 text-teal-200 transition hover:bg-teal-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </form>

            {/* FOOTER QUOTE */}
            <footer className="mt-10 text-center px-4">
              <p className="text-xs sm:text-sm text-teal-600 italic">
                <span className="text-teal-500">“</span> And We have certainly made the Quran easy for remembrance,
                so is there any who will remember? <span className="text-teal-500">”</span>
              </p>
              <p className="mt-1 text-xs text-teal-700">— Surah Al-Qamar (54:17)</p>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
