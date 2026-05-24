import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Check,
  Flame,
  Loader2,
  MapPin,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";

export const Route = createFileRoute("/salah")({
  head: () => ({
    meta: [
      { title: "Salah Tracker — AyahMirror" },
      {
        name: "description",
        content:
          "Track your five daily prayers with accurate local prayer times, streaks, and gentle reminders.",
      },
    ],
  }),
  component: SalahPage,
});

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

const PRAYERS: { key: PrayerKey; label: string; icon: typeof Sun }[] = [
  { key: "fajr", label: "Fajr", icon: Sunrise },
  { key: "dhuhr", label: "Dhuhr", icon: Sun },
  { key: "asr", label: "Asr", icon: Sun },
  { key: "maghrib", label: "Maghrib", icon: Sunset },
  { key: "isha", label: "Isha", icon: Moon },
];

type Timings = Record<PrayerKey, string>; // "HH:mm" 24h
type DailyState = Record<PrayerKey, boolean>;
type ReminderState = Record<PrayerKey, boolean>;

const emptyDaily: DailyState = {
  fajr: false,
  dhuhr: false,
  asr: false,
  maghrib: false,
  isha: false,
};

const defaultReminders: ReminderState = {
  fajr: true,
  dhuhr: true,
  asr: true,
  maghrib: true,
  isha: true,
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

function loadJSON<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* noop */
  }
}

function formatTime12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function minutesFromNow(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (isNaN(h) || isNaN(m)) return Infinity;
  const now = new Date();
  const t = new Date();
  t.setHours(h, m, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 60000);
}

function SalahPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme, pushNotification } = useApp();
  const isLight = theme === "light";

  const [timings, setTimings] = useState<Timings | null>(null);
  const [city, setCity] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [daily, setDaily] = useState<DailyState>(emptyDaily);
  const [streak, setStreak] = useState(0);
  const [reminders, setReminders] = useState<ReminderState>(defaultReminders);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  // Hydrate persisted state
  useEffect(() => {
    const tk = todayKey();
    const persistedDay = loadJSON<{ date: string; daily: DailyState } | null>(
      "salah:today",
      null,
    );
    if (persistedDay && persistedDay.date === tk) {
      setDaily(persistedDay.daily);
    } else {
      setDaily(emptyDaily);
      saveJSON("salah:today", { date: tk, daily: emptyDaily });
    }
    setStreak(loadJSON<number>("salah:streak", 0));
    setReminders(loadJSON<ReminderState>("salah:reminders", defaultReminders));
  }, []);

  // Fetch prayer times
  const fetchTimes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const getCoords = () =>
        new Promise<GeolocationPosition | null>((resolve) => {
          if (typeof navigator === "undefined" || !navigator.geolocation) {
            resolve(null);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { timeout: 6000 },
          );
        });

      const pos = await getCoords();
      let url: string;
      if (pos) {
        url = `https://api.aladhan.com/v1/timings/${Math.floor(
          Date.now() / 1000,
        )}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&method=2`;
      } else {
        // Fallback: IP-based city detection
        const ip = await fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .catch(() => null);
        const cityName = ip?.city || "Mecca";
        const country = ip?.country_name || "Saudi Arabia";
        setCity(`${cityName}, ${country}`);
        url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(
          cityName,
        )}&country=${encodeURIComponent(country)}&method=2`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network error");
      const json = await res.json();
      const t = json?.data?.timings;
      if (!t) throw new Error("Invalid response");
      setTimings({
        fajr: t.Fajr.slice(0, 5),
        dhuhr: t.Dhuhr.slice(0, 5),
        asr: t.Asr.slice(0, 5),
        maghrib: t.Maghrib.slice(0, 5),
        isha: t.Isha.slice(0, 5),
      });
      if (pos && !city) {
        setCity("Your location");
      }
    } catch (e) {
      setError("Couldn't load prayer times. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetchTimes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle prayer & update streak
  const togglePrayer = (k: PrayerKey) => {
    setDaily((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      saveJSON("salah:today", { date: todayKey(), daily: next });
      const allDone = (Object.keys(next) as PrayerKey[]).every((p) => next[p]);
      const wasAllDone = (Object.keys(prev) as PrayerKey[]).every((p) => prev[p]);
      if (allDone && !wasAllDone) {
        const lastStreakDay = loadJSON<string | null>("salah:streak:date", null);
        const today = todayKey();
        let newStreak = streak;
        if (lastStreakDay !== today) {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(
            2,
            "0",
          )}-${String(y.getDate()).padStart(2, "0")}`;
          newStreak = lastStreakDay === yKey ? streak + 1 : 1;
          setStreak(newStreak);
          saveJSON("salah:streak", newStreak);
          saveJSON("salah:streak:date", today);
          toast.success(`🔥 Salah streak: ${newStreak} day${newStreak > 1 ? "s" : ""}!`);
        }
      }
      return next;
    });
  };

  // Reminder watcher
  useEffect(() => {
    if (!timings) return;
    const tick = () => {
      (Object.keys(timings) as PrayerKey[]).forEach((k) => {
        if (!reminders[k]) return;
        const mins = minutesFromNow(timings[k]);
        const fireKey = `${todayKey()}:${k}`;
        if (mins <= 15 && mins > 0 && !firedRef.current.has(fireKey)) {
          firedRef.current.add(fireKey);
          const label = PRAYERS.find((p) => p.key === k)?.label ?? k;
          toast(`🕌 Time for ${label} is approaching`, {
            description: `${mins} min until ${label} (${formatTime12(timings[k])})`,
          });
          pushNotification({
            kind: "reminder",
            title: `🕌 ${label} approaching`,
            body: `${mins} minutes until ${label} at ${formatTime12(timings[k])}.`,
          });
        }
      });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [timings, reminders, pushNotification]);

  const completedCount = useMemo(
    () => (Object.values(daily) as boolean[]).filter(Boolean).length,
    [daily],
  );

  const cardBase = isLight
    ? "bg-white/70 border-slate-200"
    : "bg-white/5 border-white/10";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <div
          className={`relative rounded-2xl border backdrop-blur-md p-6 sm:p-8 ${cardBase}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-semibold tracking-tight ${
                  isLight ? "text-slate-900" : "text-slate-100"
                }`}
              >
                Salah Tracker
              </h1>
              <p
                className={`mt-1 text-sm ${
                  isLight ? "text-slate-600" : "text-slate-400"
                }`}
              >
                Five prayers. One rhythm.
              </p>
              {city && (
                <div
                  className={`mt-3 inline-flex items-center gap-1.5 text-xs ${
                    isLight ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {city}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Streak */}
              <div
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                  isLight
                    ? "border-teal-300 bg-teal-50 text-teal-700"
                    : "border-teal-400/30 bg-teal-400/10 text-teal-200"
                }`}
                title="Salah streak (all 5 prayers per day)"
              >
                <Flame
                  className={`h-4 w-4 ${
                    isLight ? "text-teal-600" : "text-teal-300"
                  } ${streak > 0 ? "drop-shadow-[0_0_6px_rgba(45,212,191,0.7)]" : ""}`}
                />
                <span className="font-semibold">{streak}</span>
                <span className="opacity-70 text-xs">day{streak === 1 ? "" : "s"}</span>
              </div>
              {/* Settings */}
              <button
                onClick={() => setSettingsOpen(true)}
                className={`p-2 rounded-full border transition ${
                  isLight
                    ? "border-slate-200 text-slate-600 hover:text-teal-600 hover:border-teal-300"
                    : "border-white/10 text-slate-300 hover:text-teal-300 hover:border-teal-400/40"
                }`}
                aria-label="Reminder settings"
              >
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-5">
            <div
              className={`flex items-center justify-between text-xs mb-2 ${
                isLight ? "text-slate-600" : "text-slate-400"
              }`}
            >
              <span>Today's progress</span>
              <span>{completedCount} / 5</span>
            </div>
            <div
              className={`h-2 w-full rounded-full overflow-hidden ${
                isLight ? "bg-slate-200" : "bg-white/5"
              }`}
            >
              <div
                className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all duration-500 shadow-[0_0_12px_rgba(45,212,191,0.5)]"
                style={{ width: `${(completedCount / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Prayer Grid */}
        <div
          className={`rounded-2xl border backdrop-blur-md p-4 sm:p-6 ${cardBase}`}
        >
          {loading ? (
            <SkeletonGrid isLight={isLight} />
          ) : error ? (
            <div className="text-center py-10">
              <p
                className={`text-sm ${isLight ? "text-slate-600" : "text-slate-400"}`}
              >
                {error}
              </p>
              <button
                onClick={fetchTimes}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-500/20 border border-teal-400/40 px-4 py-2 text-sm text-teal-200 hover:bg-teal-500/30"
              >
                <Loader2 className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : timings ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {PRAYERS.map(({ key, label, icon: Icon }) => {
                const done = daily[key];
                const time = timings[key];
                const mins = minutesFromNow(time);
                const isNext = mins > 0 && mins <= 60;
                return (
                  <div
                    key={key}
                    className={`relative rounded-xl border p-4 transition-all ${
                      isLight ? "bg-white/60" : "bg-white/5"
                    } ${
                      done
                        ? "border-teal-400/60 shadow-[0_0_18px_rgba(45,212,191,0.25)]"
                        : isNext
                          ? isLight
                            ? "border-teal-300"
                            : "border-teal-400/40"
                          : isLight
                            ? "border-slate-200"
                            : "border-white/10"
                    }`}
                  >
                    {isNext && !done && (
                      <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wide text-teal-300">
                        Next
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`h-4 w-4 ${
                          isLight ? "text-teal-600" : "text-teal-300"
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          isLight ? "text-slate-800" : "text-slate-200"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                    <div
                      className={`mt-2 text-2xl font-semibold ${
                        isLight ? "text-slate-900" : "text-slate-100"
                      }`}
                    >
                      {formatTime12(time)}
                    </div>
                    <button
                      onClick={() => togglePrayer(key)}
                      className={`mt-3 w-full flex items-center justify-center gap-2 rounded-lg border py-2 text-xs transition ${
                        done
                          ? "border-teal-400/60 bg-teal-500/20 text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.4)]"
                          : isLight
                            ? "border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700"
                            : "border-white/10 text-slate-400 hover:border-teal-400/40 hover:text-teal-300"
                      }`}
                      aria-pressed={done}
                    >
                      <span
                        className={`grid place-content-center h-4 w-4 rounded border ${
                          done
                            ? "border-teal-300 bg-teal-400/30"
                            : isLight
                              ? "border-slate-300"
                              : "border-white/20"
                        }`}
                      >
                        {done && <Check className="h-3 w-3" />}
                      </span>
                      {done ? "Completed" : "Mark prayed"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            className={`relative w-full max-w-md rounded-2xl border backdrop-blur-xl p-6 ${
              isLight
                ? "bg-white/95 border-slate-200"
                : "bg-slate-900/90 border-white/10"
            }`}
          >
            <button
              onClick={() => setSettingsOpen(false)}
              className={`absolute top-3 right-3 ${
                isLight ? "text-slate-500" : "text-slate-400"
              }`}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Bell
                className={`h-4 w-4 ${
                  isLight ? "text-teal-600" : "text-teal-300"
                }`}
              />
              <h2
                className={`text-lg font-semibold ${
                  isLight ? "text-slate-900" : "text-slate-100"
                }`}
              >
                Prayer Reminders
              </h2>
            </div>
            <p
              className={`text-xs mb-4 ${
                isLight ? "text-slate-600" : "text-slate-400"
              }`}
            >
              Get a gentle nudge ~15 minutes before each prayer.
            </p>
            <div className="space-y-2">
              {PRAYERS.map(({ key, label }) => {
                const on = reminders[key];
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
                      isLight
                        ? "border-slate-200 bg-white/60"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <span
                      className={`text-sm ${
                        isLight ? "text-slate-800" : "text-slate-200"
                      }`}
                    >
                      {label}
                    </span>
                    <button
                      onClick={() => {
                        const next = { ...reminders, [key]: !on };
                        setReminders(next);
                        saveJSON("salah:reminders", next);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition ${
                        on
                          ? "bg-teal-500/20 border border-teal-400/40 text-teal-200 shadow-[0_0_10px_rgba(45,212,191,0.3)]"
                          : isLight
                            ? "bg-slate-100 border border-slate-200 text-slate-500"
                            : "bg-white/5 border border-white/10 text-slate-400"
                      }`}
                    >
                      {on ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                      {on ? "On" : "Off"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SkeletonGrid({ isLight }: { isLight: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {PRAYERS.map((p) => (
        <div
          key={p.key}
          className={`rounded-xl border p-4 ${
            isLight ? "bg-white/60 border-slate-200" : "bg-white/5 border-white/10"
          }`}
        >
          <div
            className={`h-3 w-16 rounded ${
              isLight ? "bg-slate-200" : "bg-white/10"
            } animate-pulse`}
          />
          <div
            className={`mt-3 h-7 w-24 rounded ${
              isLight ? "bg-slate-200" : "bg-white/10"
            } animate-pulse`}
          />
          <div
            className={`mt-3 h-8 w-full rounded ${
              isLight ? "bg-slate-200" : "bg-white/10"
            } animate-pulse`}
          />
        </div>
      ))}
      <div className="col-span-full flex items-center justify-center text-xs text-slate-400 gap-2 mt-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Locating you & loading prayer times…
      </div>
    </div>
  );
}
