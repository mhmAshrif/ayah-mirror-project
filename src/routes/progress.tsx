import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Flame, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { computeStreak, toKey, uniqueDays } from "@/lib/streak";

export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [{ title: "Progress — AyahMirror" }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme } = useApp();
  const isLight = theme === "light";

  const [days, setDays] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("reflections")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(365);
      const rows = data ?? [];
      setTotal(rows.length);
      setDays(uniqueDays(rows.map((r) => r.created_at)));
      setLoading(false);
    })();
  }, [userId]);

  const streak = useMemo(() => computeStreak(days), [days]);
  const daySet = useMemo(() => new Set(days), [days]);

  // Build calendar: last 12 weeks (84 days), columns = weeks
  const cells = useMemo(() => {
    const today = new Date();
    const base = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const arr: { key: string; active: boolean }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - i);
      const key = toKey(d);
      arr.push({ key, active: daySet.has(key) });
    }
    return arr;
  }, [daySet]);

  return (
    <AppShell>
      <section className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <TrendingUp className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`} />
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
            Progress
          </h1>
        </div>

        {loading ? (
          <div className={`mt-8 flex items-center gap-2 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard isLight={isLight} icon={<Flame className="h-4 w-4" />} label="Current streak" value={`${streak} days`} />
              <StatCard isLight={isLight} icon={<Sparkles className="h-4 w-4" />} label="Total reflections" value={`${total}`} />
              <StatCard isLight={isLight} icon={<TrendingUp className="h-4 w-4" />} label="Active days (90d)" value={`${days.length}`} />
            </div>

            <div
              className={`mt-8 rounded-2xl border p-5 ${
                isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/5"
              }`}
            >
              <div className={`text-xs uppercase tracking-wide mb-3 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Last 12 weeks
              </div>
              <div className="grid grid-cols-12 gap-1.5">
                {Array.from({ length: 12 }).map((_, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-1.5">
                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const cell = cells[weekIdx * 7 + dayIdx];
                      if (!cell) return <div key={dayIdx} className="h-3 w-3" />;
                      return (
                        <div
                          key={dayIdx}
                          title={cell.key}
                          className={`h-3 w-3 rounded-sm ${
                            cell.active
                              ? "bg-teal-500"
                              : isLight
                              ? "bg-slate-200"
                              : "bg-white/10"
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}

function StatCard({
  isLight,
  icon,
  label,
  value,
}: {
  isLight: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/5"
      }`}
    >
      <div className={`flex items-center gap-2 text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
