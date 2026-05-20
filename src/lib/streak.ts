// Compute current streak from a list of UTC date strings (yyyy-mm-dd of activity).
export function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  const today = new Date();
  let streak = 0;
  const cursor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  // If today not present, start from yesterday so an inactive today doesn't break streak immediately
  if (!set.has(toKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (set.has(toKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function toKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function uniqueDays(timestamps: string[]): string[] {
  const set = new Set<string>();
  for (const t of timestamps) {
    set.add(toKey(new Date(t)));
  }
  return Array.from(set);
}
