import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Compass, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/journey")({
  head: () => ({ meta: [{ title: "Journey — AyahMirror" }] }),
  component: JourneyPage,
});

type Event = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  at: string;
};

function JourneyPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme } = useApp();
  const isLight = theme === "light";
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [m, r, b] = await Promise.all([
        supabase
          .from("milestones")
          .select("id,kind,title,description,occurred_at")
          .eq("user_id", userId)
          .order("occurred_at", { ascending: false })
          .limit(50),
        supabase
          .from("reflections")
          .select("id,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1),
        supabase
          .from("spiritual_bookmarks")
          .select("id,created_at,surah_id,ayah_number")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const all: Event[] = [];
      for (const row of m.data ?? []) {
        all.push({
          id: row.id,
          kind: row.kind,
          title: row.title,
          description: row.description,
          at: row.occurred_at,
        });
      }
      const firstReflection = r.data?.[0];
      if (firstReflection) {
        all.push({
          id: `first-${firstReflection.id}`,
          kind: "milestone",
          title: "First reflection logged",
          description: "Your journey began here.",
          at: firstReflection.created_at,
        });
      }
      for (const bm of b.data ?? []) {
        all.push({
          id: `bm-${bm.id}`,
          kind: "bookmark",
          title: `Bookmarked Surah ${bm.surah_id}:${bm.ayah_number}`,
          description: null,
          at: bm.created_at,
        });
      }
      all.sort((a, z) => new Date(z.at).getTime() - new Date(a.at).getTime());
      setEvents(all);
      setLoading(false);
    })();
  }, [userId]);

  const grouped = useMemo(() => {
    const g: Record<string, Event[]> = {};
    for (const ev of events) {
      const k = new Date(ev.at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      });
      (g[k] ||= []).push(ev);
    }
    return g;
  }, [events]);

  return (
    <AppShell>
      <section className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <Compass className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`} />
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
            Your Journey
          </h1>
        </div>

        {loading ? (
          <div className={`mt-8 flex items-center gap-2 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : events.length === 0 ? (
          <div className={`mt-8 rounded-2xl border p-8 text-center text-sm ${
            isLight ? "border-slate-200 bg-white text-slate-500" : "border-white/10 bg-white/5 text-slate-400"
          }`}>
            Your journey will appear here as you reflect and bookmark verses.
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            {Object.entries(grouped).map(([month, evs]) => (
              <div key={month}>
                <h2 className={`text-xs uppercase tracking-[0.2em] mb-3 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  {month}
                </h2>
                <div className="border-l-2 border-teal-500/40 pl-4 flex flex-col gap-3">
                  {evs.map((ev) => (
                    <div
                      key={ev.id}
                      className={`relative rounded-xl border p-4 ${
                        isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="absolute -left-[22px] top-5 h-3 w-3 rounded-full bg-teal-500" />
                      <div className={`text-sm font-medium ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                        {ev.title}
                      </div>
                      {ev.description && (
                        <div className={`mt-1 text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                          {ev.description}
                        </div>
                      )}
                      <div className={`mt-1 text-[11px] ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                        {new Date(ev.at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
