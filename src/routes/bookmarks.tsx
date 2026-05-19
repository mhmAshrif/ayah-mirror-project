import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Heart,
  LogOut,
  Bookmark,
  Trash2,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/bookmarks")({
  head: () => ({
    meta: [
      { title: "My Bookmarks — AyahMirror" },
      {
        name: "description",
        content: "Your saved Quranic verses and prescriptions.",
      },
    ],
  }),
  component: BookmarksPage,
});

type BookmarkRow = {
  id: string;
  surah_id: number;
  ayah_number: number;
  context_message: string | null;
  prescription: string | null;
  created_at: string;
};

function BookmarksPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
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
    if (authReady && !userId) {
      navigate({ to: "/login" });
      return;
    }
    if (authReady && userId) {
      loadBookmarks();
    }
  }, [authReady, userId, navigate]);

  const loadBookmarks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("spiritual_bookmarks")
        .select("id, surah_id, ayah_number, context_message, prescription, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBookmarks(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("spiritual_bookmarks").delete().eq("id", id);
      if (error) throw error;
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      toast.success("Bookmark removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove bookmark");
    } finally {
      setDeletingId(null);
    }
  };

  if (!authReady || !userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-500" />
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
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-400 backdrop-blur-md transition hover:text-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-400 backdrop-blur-md transition hover:text-slate-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </header>

        <section className="mt-10 flex flex-1 flex-col">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-emerald-400" />
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              My Bookmarks
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Verses you have saved to return to later.
          </p>

          {loading ? (
            <div className="mt-12 flex items-center justify-center gap-2 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading bookmarks...
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center backdrop-blur-md">
              <Bookmark className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">
                You have not saved any verses yet.
              </p>
              <Link
                to="/"
                className="mt-3 inline-block text-sm text-emerald-400 underline-offset-4 hover:text-emerald-300 hover:underline"
              >
                Find your first verse
              </Link>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-4">
              {bookmarks.map((b) => (
                <article
                  key={b.id}
                  className="group relative rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-md transition hover:border-slate-700 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
                        Surah {b.surah_id} : Ayah {b.ayah_number}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(b.id)}
                      disabled={deletingId === b.id}
                      className="flex items-center gap-1 rounded-md border border-rose-900/40 bg-rose-900/20 px-2.5 py-1.5 text-xs text-rose-300 transition hover:bg-rose-900/40 disabled:opacity-50"
                      aria-label="Remove bookmark"
                    >
                      {deletingId === b.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove
                    </button>
                  </div>

                  {b.context_message && (
                    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <p className="text-sm italic leading-relaxed text-slate-200 sm:text-base">
                        {b.context_message}
                      </p>
                    </div>
                  )}

                  {b.prescription && (
                    <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-300">
                        Prescription
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-amber-50 sm:text-base">
                        {b.prescription}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 text-center text-xs text-slate-600">
          AyahMirror · meet your heart where it is
        </footer>
      </div>
    </main>
  );
}
