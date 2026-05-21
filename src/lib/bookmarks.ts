// Bookmark sorting + bulk-action helpers.
import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BookmarkLike = {
  id: string;
  surah_id: number;
  ayah_number: number;
  collection_id: string | null;
  created_at: string;
};

export type BookmarkSort =
  | "date_desc"
  | "date_asc"
  | "surah_asc"
  | "surah_desc";

export function sortBookmarks<T extends BookmarkLike>(
  items: T[],
  by: BookmarkSort,
): T[] {
  const copy = [...items];
  switch (by) {
    case "date_desc":
      return copy.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    case "date_asc":
      return copy.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    case "surah_asc":
      return copy.sort(
        (a, b) => a.surah_id - b.surah_id || a.ayah_number - b.ayah_number,
      );
    case "surah_desc":
      return copy.sort(
        (a, b) => b.surah_id - a.surah_id || b.ayah_number - a.ayah_number,
      );
  }
}

export function filterByFolder<T extends BookmarkLike>(
  items: T[],
  folderId: string | null | "all" | "uncat",
): T[] {
  if (folderId === "all" || folderId === null) return items;
  if (folderId === "uncat") return items.filter((b) => !b.collection_id);
  return items.filter((b) => b.collection_id === folderId);
}

/** Bulk-move many bookmarks to a target folder (or null = uncategorized). */
export async function moveVersesToFolder(
  verseIds: string[],
  targetFolderId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!verseIds.length) return { ok: true };
  try {
    const { error } = await supabase
      .from("spiritual_bookmarks")
      .update({ collection_id: targetFolderId })
      .in("id", verseIds);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/** Bulk-delete bookmarks. */
export async function deleteBookmarks(
  verseIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (!verseIds.length) return { ok: true };
  const { error } = await supabase
    .from("spiritual_bookmarks")
    .delete()
    .in("id", verseIds);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Hook for managing a multi-select set with bulk operations. */
export function useBookmarkSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const selectAll = useCallback(
    (ids: string[]) => setSelected(new Set(ids)),
    [],
  );

  const selectedIds = useMemo(() => [...selected], [selected]);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  return {
    selected,
    selectedIds,
    isSelected,
    toggle,
    clear,
    selectAll,
    count: selected.size,
  };
}
