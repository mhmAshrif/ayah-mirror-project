import { toKey, uniqueDays } from "./streak";

export type HeatmapCell = {
  date: string; // yyyy-mm-dd
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};
export type HeatmapMatrix = HeatmapCell[][]; // [week][dayOfWeek 0..6]

/**
 * Build a GitHub-style 53×7 matrix ending today (UTC).
 * @param timestamps ISO date strings of activity events.
 * @param days window size (default 365).
 */
export function buildHeatmap(timestamps: string[], days = 365): HeatmapMatrix {
  const counts = new Map<string, number>();
  for (const t of timestamps) {
    const k = toKey(new Date(t));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  // Snap end to Saturday so the rightmost column is a full week.
  const endDow = end.getUTCDay(); // 0 Sun .. 6 Sat
  const daysToSaturday = (6 - endDow + 7) % 7;
  end.setUTCDate(end.getUTCDate() + daysToSaturday);

  const totalCells = Math.ceil(days / 7) * 7;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (totalCells - 1));

  const cells: HeatmapCell[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < totalCells; i++) {
    const k = toKey(cursor);
    const c = counts.get(k) ?? 0;
    cells.push({ date: k, count: c, level: levelFor(c) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Chunk into weeks (columns).
  const weeks: HeatmapMatrix = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function levelFor(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n <= 3) return 2;
  if (n <= 5) return 3;
  return 4;
}

// ---------- Streak with freeze ----------

export type StreakState = {
  current: number;
  longest: number;
  freezes: number;
  lastActiveDay: string | null;
};

/**
 * Compute streak with freeze logic.
 * Rule: 1 freeze earned per completed 7-day streak.
 *       A missed day deducts a freeze instead of resetting, if any.
 *       Two consecutive missed days always reset.
 */
export function computeStreakWithFreezes(
  timestamps: string[],
  carriedFreezes = 0,
): StreakState {
  const days = uniqueDays(timestamps).sort(); // ascending
  if (!days.length) {
    return { current: 0, longest: 0, freezes: carriedFreezes, lastActiveDay: null };
  }
  let current = 0;
  let longest = 0;
  let freezes = carriedFreezes;
  let prev: Date | null = null;

  for (const d of days) {
    const cur = new Date(d + "T00:00:00Z");
    if (!prev) {
      current = 1;
    } else {
      const gap = dayDiff(prev, cur);
      if (gap === 1) {
        current += 1;
      } else if (gap === 2 && freezes > 0) {
        freezes -= 1; // burn a freeze to bridge a missed day
        current += 1;
      } else {
        current = 1;
      }
    }
    // earn a freeze every 7 consecutive days (capped at 3)
    if (current > 0 && current % 7 === 0) {
      freezes = Math.min(freezes + 1, 3);
    }
    if (current > longest) longest = current;
    prev = cur;
  }

  // Check trailing gap vs today.
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const trailing = dayDiff(prev!, todayUtc);
  if (trailing > 1) {
    if (trailing === 2 && freezes > 0) {
      freezes -= 1;
    } else {
      current = 0;
    }
  }

  return { current, longest, freezes, lastActiveDay: days[days.length - 1] };
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
