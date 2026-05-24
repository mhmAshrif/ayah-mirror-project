import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";

export const Route = createFileRoute("/tasbih")({
  head: () => ({
    meta: [
      { title: "Digital Tasbih — AyahMirror" },
      {
        name: "description",
        content:
          "A beautiful digital tasbih with water-ripple tap effects, progress ring, and dhikr tracking.",
      },
    ],
  }),
  component: TasbihPage,
});

type DhikrPhrase = {
  arabic: string;
  transliteration: string;
  meaning: string;
};

const DHIKR_OPTIONS: DhikrPhrase[] = [
  { arabic: "سُبْحَانَ ٱللَّٰهِ", transliteration: "Subhanallah", meaning: "Glory be to Allah" },
  { arabic: "ٱلْحَمْدُ لِلَّٰهِ", transliteration: "Alhamdulillah", meaning: "Praise be to Allah" },
  { arabic: "ٱللَّٰهُ أَكْبَرُ", transliteration: "Allahu Akbar", meaning: "Allah is the Greatest" },
  { arabic: "أَسْتَغْفِرُ ٱللَّٰهَ", transliteration: "Astaghfirullah", meaning: "I seek forgiveness from Allah" },
  { arabic: "لَا إِلَٰهَ إِلَّا ٱللَّٰهُ", transliteration: "La ilaha illallah", meaning: "There is no god but Allah" },
  { arabic: "ٱللَّٰهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ", transliteration: "Allahumma salli ala Muhammad", meaning: "O Allah, bless Muhammad" },
];

type StorageData = {
  count: number;
  target: number;
  phraseIndex: number;
};

const STORAGE_KEY = "tasbih:state";

function loadState(): StorageData {
  if (typeof window === "undefined") {
    return { count: 0, target: 33, phraseIndex: 0 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StorageData;
      if (
        typeof parsed.count === "number" &&
        typeof parsed.target === "number" &&
        typeof parsed.phraseIndex === "number"
      ) {
        return parsed;
      }
    }
  } catch {
    /* noop */
  }
  return { count: 0, target: 33, phraseIndex: 0 };
}

function saveState(state: StorageData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

function safeVibrate(pattern: number | number[]) {
  if (
    typeof navigator !== "undefined" &&
    "vibrate" in navigator &&
    typeof navigator.vibrate === "function"
  ) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* noop */
    }
  }
}

/* ─── Ripple type ─── */
type Ripple = {
  id: number;
  x: number;
  y: number;
};

function TasbihPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme } = useApp();
  const isLight = theme === "light";

  const [count, setCount] = useState(0);
  const [target, setTarget] = useState(33);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleIdRef = useRef(0);
  const tapZoneRef = useRef<HTMLButtonElement>(null);
  const completedRef = useRef(false);

  /* Auth redirect */
  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  /* Hydrate from localStorage */
  useEffect(() => {
    const s = loadState();
    setCount(s.count);
    setTarget(s.target);
    setPhraseIndex(s.phraseIndex);
  }, []);

  const phrase = DHIKR_OPTIONS[phraseIndex];

  /* Progress ring math */
  const progress = Math.min(count / target, 1);
  const circumference = 2 * Math.PI * 120; // r=120
  const strokeDashoffset = circumference * (1 - progress);

  /* Tap handler */
  const handleTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (completedRef.current) return;

      /* Haptic */
      safeVibrate(50);

      /* Ripple origin */
      const rect = tapZoneRef.current?.getBoundingClientRect();
      let x = 128;
      let y = 128;
      if (rect) {
        if ("clientX" in e) {
          x = e.clientX - rect.left;
          y = e.clientY - rect.top;
        } else if ("touches" in e && e.touches.length > 0) {
          x = e.touches[0].clientX - rect.left;
          y = e.touches[0].clientY - rect.top;
        }
      }

      const id = ++rippleIdRef.current;
      setRipples((prev) => [...prev, { id, x, y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 700);

      setCount((prev) => {
        const next = prev + 1;
        saveState({ count: next, target, phraseIndex });

        if (next >= target && !completedRef.current) {
          completedRef.current = true;
          setCompleted(true);
          safeVibrate([100, 50, 100]);
          toast.success(`${phrase.transliteration} — ${target} times!`, {
            description: "JazakAllahu khairan for your dhikr.",
          });
          setTimeout(() => setCompleted(false), 2500);
          setTimeout(() => {
            completedRef.current = false;
          }, 3000);
        }
        return next;
      });
    },
    [target, phraseIndex, phrase],
  );

  /* Reset */
  const handleReset = useCallback(() => {
    setCount(0);
    completedRef.current = false;
    setCompleted(false);
    saveState({ count: 0, target, phraseIndex });
    safeVibrate([30, 30, 30]);
  }, [target, phraseIndex]);

  /* Toggle target */
  const toggleTarget = useCallback(() => {
    setTarget((prev) => {
      const next = prev === 33 ? 100 : 33;
      setCount(0);
      completedRef.current = false;
      setCompleted(false);
      saveState({ count: 0, target: next, phraseIndex });
      return next;
    });
  }, [phraseIndex]);

  /* Select phrase */
  const selectPhrase = useCallback(
    (idx: number) => {
      setPhraseIndex(idx);
      setCount(0);
      completedRef.current = false;
      setCompleted(false);
      saveState({ count: 0, target, phraseIndex: idx });
      setDropdownOpen(false);
    },
    [target],
  );

  const cardBase = isLight
    ? "bg-white/70 border-slate-200"
    : "bg-white/5 border-white/10";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-xl space-y-6 select-none">
        {/* Header */}
        <div
          className={`relative rounded-2xl border backdrop-blur-md p-5 sm:p-6 ${cardBase}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles
              className={`h-5 w-5 ${isLight ? "text-teal-600" : "text-teal-300"}`}
            />
            <h1
              className={`text-xl sm:text-2xl font-semibold tracking-tight ${
                isLight ? "text-slate-900" : "text-slate-100"
              }`}
            >
              Digital Tasbih
            </h1>
          </div>
          <p
            className={`text-sm ${isLight ? "text-slate-600" : "text-slate-400"}`}
          >
            Tap the circle. Feel the rhythm. Remember Allah.
          </p>
        </div>

        {/* Dhikr Selector */}
        <div
          className={`relative rounded-2xl border backdrop-blur-md p-4 sm:p-5 ${cardBase}`}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div
                className={`text-2xl sm:text-3xl font-semibold leading-tight ${
                  isLight ? "text-slate-900" : "text-slate-100"
                }`}
                dir="rtl"
              >
                {phrase.arabic}
              </div>
              <div
                className={`mt-1 text-sm font-medium ${
                  isLight ? "text-teal-700" : "text-teal-300"
                }`}
              >
                {phrase.transliteration}
              </div>
              <div
                className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}
              >
                {phrase.meaning}
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                  isLight
                    ? "border-slate-200 bg-white/60 text-slate-700 hover:border-teal-300 hover:text-teal-700"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-teal-400/40 hover:text-teal-300"
                }`}
              >
                Change Dhikr
                <ChevronDown className="h-3 w-3" />
              </button>
              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div
                    className={`absolute right-0 mt-2 w-64 sm:w-72 rounded-xl border backdrop-blur-xl p-2 z-40 max-h-72 overflow-y-auto ${
                      isLight
                        ? "bg-white/95 border-slate-200"
                        : "bg-slate-900/90 border-white/10"
                    }`}
                  >
                    {DHIKR_OPTIONS.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectPhrase(idx)}
                        className={`w-full text-right rounded-lg px-3 py-2 text-sm transition ${
                          idx === phraseIndex
                            ? isLight
                              ? "bg-teal-50 text-teal-700"
                              : "bg-teal-500/10 text-teal-300"
                            : isLight
                              ? "text-slate-700 hover:bg-slate-100"
                              : "text-slate-300 hover:bg-white/5"
                        }`}
                        dir="rtl"
                      >
                        <div className="font-semibold">{opt.arabic}</div>
                        <div
                          className={`text-xs ${
                            isLight ? "text-slate-500" : "text-slate-400"
                          }`}
                          dir="ltr"
                        >
                          {opt.transliteration} — {opt.meaning}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tap Zone */}
        <div
          className={`relative rounded-2xl border backdrop-blur-md p-6 sm:p-8 flex flex-col items-center ${cardBase}`}
        >
          {/* Target toggle */}
          <div className="mb-5 flex items-center gap-2">
            <button
              onClick={toggleTarget}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                target === 33
                  ? isLight
                    ? "border-teal-400 bg-teal-50 text-teal-700"
                    : "border-teal-400/40 bg-teal-500/10 text-teal-300 shadow-[0_0_10px_rgba(45,212,191,0.25)]"
                  : isLight
                    ? "border-slate-200 bg-white/40 text-slate-500"
                    : "border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              33
            </button>
            <button
              onClick={toggleTarget}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                target === 100
                  ? isLight
                    ? "border-teal-400 bg-teal-50 text-teal-700"
                    : "border-teal-400/40 bg-teal-500/10 text-teal-300 shadow-[0_0_10px_rgba(45,212,191,0.25)]"
                  : isLight
                    ? "border-slate-200 bg-white/40 text-slate-500"
                    : "border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              100
            </button>
          </div>

          {/* Circular progress + tap zone */}
          <div className="relative flex items-center justify-center">
            {/* SVG Progress Ring */}
            <svg
              width="280"
              height="280"
              viewBox="0 0 280 280"
              className="pointer-events-none"
            >
              {/* Track */}
              <circle
                cx="140"
                cy="140"
                r="120"
                fill="none"
                stroke={isLight ? "#e2e8f0" : "rgba(255,255,255,0.08)"}
                strokeWidth="10"
              />
              {/* Progress */}
              <circle
                cx="140"
                cy="140"
                r="120"
                fill="none"
                stroke="url(#tasbihGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 140 140)"
                style={{ transition: "stroke-dashoffset 0.3s ease-out" }}
                className={completed ? "animate-celebrate-pulse" : ""}
              />
              <defs>
                <linearGradient id="tasbihGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#2dd4bf" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>

            {/* Tap Zone */}
            <button
              ref={tapZoneRef}
              onClick={handleTap}
              onTouchStart={(e) => {
                e.preventDefault();
                handleTap(e);
              }}
              className={`absolute inset-0 m-auto w-56 h-56 sm:w-64 sm:h-64 rounded-full border flex flex-col items-center justify-center gap-2 transition-all duration-200 active:scale-95 focus:outline-none ${
                isLight
                  ? "bg-white/60 border-slate-200/80 hover:bg-white/80"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              } ${
                completed
                  ? "shadow-[0_0_40px_rgba(45,212,191,0.5)] animate-celebrate-pulse"
                  : ""
              }`}
              aria-label="Tap to count dhikr"
            >
              {/* Ripples */}
              {ripples.map((r) => (
                <span
                  key={r.id}
                  className="absolute rounded-full border-2 border-teal-400/60 animate-ripple pointer-events-none"
                  style={{
                    left: r.x,
                    top: r.y,
                    width: 10,
                    height: 10,
                    marginLeft: -5,
                    marginTop: -5,
                  }}
                />
              ))}

              <span
                className={`text-5xl sm:text-6xl font-bold tabular-nums transition ${
                  isLight ? "text-slate-900" : "text-slate-100"
                }`}
              >
                {count}
              </span>
              <span
                className={`text-xs uppercase tracking-widest ${
                  isLight ? "text-slate-500" : "text-slate-400"
                }`}
              >
                / {target}
              </span>
            </button>
          </div>

          {/* Hint */}
          <p
            className={`mt-4 text-xs text-center ${
              isLight ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Tap the circle or press Spacebar
          </p>

          {/* Reset */}
          <button
            onClick={handleReset}
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
              isLight
                ? "border-slate-200 text-slate-500 hover:text-teal-700 hover:border-teal-300"
                : "border-white/10 text-slate-400 hover:text-teal-300 hover:border-teal-400/40"
            }`}
            aria-label="Reset counter"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>
    </AppShell>
  );
}
