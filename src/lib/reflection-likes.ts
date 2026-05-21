// Local-only "likes" registry for community Echoes.
// We don't persist to DB; the requirement is to prevent duplicate likes per device
// and reflect a count locally. Backed by localStorage.
import { useCallback, useEffect, useState } from "react";

const KEY = "athar:likes";

type LikesMap = Record<string, number>; // reflectionId -> count (locally observed)

function read(): { liked: Set<string>; counts: LikesMap } {
  if (typeof window === "undefined") return { liked: new Set(), counts: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { liked: new Set(), counts: {} };
    const j = JSON.parse(raw) as { liked: string[]; counts: LikesMap };
    return { liked: new Set(j.liked ?? []), counts: j.counts ?? {} };
  } catch {
    return { liked: new Set(), counts: {} };
  }
}

function persist(liked: Set<string>, counts: LikesMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify({ liked: [...liked], counts }));
}

export function useReflectionLikes() {
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<LikesMap>({});

  useEffect(() => {
    const init = read();
    setLiked(init.liked);
    setCounts(init.counts);
  }, []);

  const toggleLike = useCallback((id: string) => {
    setLiked((prevLiked) => {
      setCounts((prevCounts) => {
        const nextCounts = { ...prevCounts };
        const nextLiked = new Set(prevLiked);
        if (nextLiked.has(id)) {
          nextLiked.delete(id);
          nextCounts[id] = Math.max(0, (nextCounts[id] ?? 1) - 1);
        } else {
          nextLiked.add(id);
          nextCounts[id] = (nextCounts[id] ?? 0) + 1;
        }
        persist(nextLiked, nextCounts);
        return nextCounts;
      });
      // Recompute liked synchronously for return
      const updated = new Set(prevLiked);
      if (updated.has(id)) updated.delete(id);
      else updated.add(id);
      return updated;
    });
  }, []);

  const isLiked = useCallback((id: string) => liked.has(id), [liked]);
  const countFor = useCallback((id: string) => counts[id] ?? 0, [counts]);

  return { toggleLike, isLiked, countFor };
}
