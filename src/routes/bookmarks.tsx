import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, FolderPlus, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";

export const Route = createFileRoute("/bookmarks")({
  head: () => ({ meta: [{ title: "My Bookmarks — AyahMirror" }] }),
  component: BookmarksPage,
});

type BookmarkRow = {
  id: string;
  surah_id: number;
  ayah_number: number;
  context_message: string | null;
  prescription: string | null;
  arabic: string | null;
  translation: string | null;
  surah_name: string | null;
  collection_id: string | null;
  created_at: string;
};
type Collection = { id: string; name: string };

function BookmarksPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme } = useApp();
  const isLight = theme === "light";

  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [newCol, setNewCol] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  useEffect(() => {
    if (!userId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const load = async () => {
    setLoading(true);
    const [b, c] = await Promise.all([
      supabase
        .from("spiritual_bookmarks")
        .select("id,surah_id,ayah_number,context_message,prescription,arabic,translation,surah_name,collection_id,created_at")
        .order("created_at", { ascending: false }),
      supabase.from("bookmark_collections").select("id,name").order("created_at"),
    ]);
    setBookmarks(b.data ?? []);
    setCollections(c.data ?? []);
    setLoading(false);
  };

  const createCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCol.trim();
    if (!name || !userId) return;
    const { data, error } = await supabase
      .from("bookmark_collections")
      .insert({ user_id: userId, name })
      .select()
      .single();
    if (error || !data) {
      toast.error("Failed to create");
      return;
    }
    setCollections((arr) => [...arr, { id: data.id, name: data.name }]);
    setNewCol("");
  };

  const moveToCollection = async (bId: string, colId: string | null) => {
    const { error } = await supabase
      .from("spiritual_bookmarks")
      .update({ collection_id: colId })
      .eq("id", bId);
    if (error) {
      toast.error("Failed");
      return;
    }
    setBookmarks((arr) =>
      arr.map((b) => (b.id === bId ? { ...b, collection_id: colId } : b)),
    );
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    await supabase.from("spiritual_bookmarks").delete().eq("id", id);
    setBookmarks((arr) => arr.filter((b) => b.id !== id));
    setDeletingId(null);
  };

  const visible = useMemo(
    () =>
      filter === null
        ? bookmarks
        : filter === "__none__"
        ? bookmarks.filter((b) => !b.collection_id)
        : bookmarks.filter((b) => b.collection_id === filter),
    [filter, bookmarks],
  );

  return (
    <AppShell>
      <section className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <Bookmark className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`} />
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
            Bookmarks
          </h1>
        </div>

        <form onSubmit={createCollection} className="mt-5 flex gap-2">
          <input
            value={newCol}
            onChange={(e) => setNewCol(e.target.value)}
            placeholder='New collection (e.g. "Verses for Anxiety")'
            className={`flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-400/40 ${
              isLight ? "border-slate-300 bg-white" : "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
            }`}
          />
          <button
            type="submit"
            disabled={!newCol.trim()}
            className="rounded-xl bg-teal-500 hover:bg-teal-400 text-white px-4 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            <FolderPlus className="h-4 w-4" /> Create
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={filter === null} onClick={() => setFilter(null)} isLight={isLight}>
            All ({bookmarks.length})
          </FilterChip>
          <FilterChip active={filter === "__none__"} onClick={() => setFilter("__none__")} isLight={isLight}>
            Uncategorized
          </FilterChip>
          {collections.map((c) => (
            <FilterChip
              key={c.id}
              active={filter === c.id}
              onClick={() => setFilter(c.id)}
              isLight={isLight}
            >
              {c.name}
            </FilterChip>
          ))}
        </div>

        {loading ? (
          <div className={`mt-8 flex items-center gap-2 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className={`mt-8 rounded-2xl border p-8 text-center text-sm ${
            isLight ? "border-slate-200 bg-white text-slate-500" : "border-white/10 bg-white/5 text-slate-400"
          }`}>
            Nothing here yet.
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {visible.map((b) => (
              <article
                key={b.id}
                className={`rounded-2xl border p-5 ${
                  isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className={`text-xs uppercase tracking-[0.2em] ${isLight ? "text-teal-700" : "text-teal-300"}`}>
                    {b.surah_name ? `${b.surah_name} · ` : ""}Surah {b.surah_id}:{b.ayah_number}
                  </span>
                  <div className="flex gap-2">
                    <select
                      value={b.collection_id ?? ""}
                      onChange={(e) => moveToCollection(b.id, e.target.value || null)}
                      className={`text-xs rounded-md border px-2 py-1 ${
                        isLight ? "border-slate-300 bg-white" : "border-white/10 bg-slate-900 text-slate-100"
                      }`}
                    >
                      <option value="">Uncategorized</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => remove(b.id)}
                      disabled={deletingId === b.id}
                      className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      {deletingId === b.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Remove
                    </button>
                  </div>
                </div>

                {b.arabic && (
                  <p
                    dir="rtl"
                    lang="ar"
                    className={`mt-3 text-right text-xl sm:text-2xl leading-[2.4] font-[Amiri,serif] ${
                      isLight ? "text-slate-900" : "text-white"
                    }`}
                  >
                    {b.arabic}
                  </p>
                )}
                {b.translation && (
                  <p className={`mt-2 text-sm ${isLight ? "text-slate-700" : "text-slate-200"}`}>
                    "{b.translation}"
                  </p>
                )}
                {b.context_message && (
                  <blockquote className={`mt-3 text-sm italic ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                    {b.context_message}
                  </blockquote>
                )}
                {b.prescription && (
                  <div
                    className={`mt-3 rounded-lg border p-3 text-sm ${
                      isLight
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-amber-400/30 bg-amber-400/10 text-amber-50"
                    }`}
                  >
                    {b.prescription}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function FilterChip({
  active,
  onClick,
  isLight,
  children,
}: {
  active: boolean;
  onClick: () => void;
  isLight: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs border transition ${
        active
          ? isLight
            ? "border-teal-500 bg-teal-50 text-teal-700"
            : "border-teal-400 bg-teal-500/20 text-teal-200"
          : isLight
          ? "border-slate-300 text-slate-600"
          : "border-white/10 text-slate-400"
      }`}
    >
      {children}
    </button>
  );
}
