import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ArabicScript = "uthmani" | "indopak";
export type TranslationLang = "en" | "ur" | "fr" | "id" | "tr" | "ar";
export type PlaybackSpeed = 1 | 1.25 | 1.5 | 2;

// Quran.com translation IDs per language (sane defaults).
export const TRANSLATION_BY_LANG: Record<TranslationLang, number> = {
  en: 131, // Dr. Mustafa Khattab — The Clear Quran
  ur: 97, // Maulana Maududi (Urdu)
  fr: 136, // Hamidullah (French)
  id: 33, // Indonesian Islamic Affairs Ministry
  tr: 77, // Diyanet İşleri (Turkish)
  ar: 169, // Arabic tafsir-style
};

export type ReadingState = {
  arabicFontSize: number; // 1.0 .. 2.0 (scale multiplier)
  readingFontFamily: ArabicScript;
  translationLang: TranslationLang;
  translationIdOverride: number | null;
  playbackSpeed: PlaybackSpeed;
  highlightedVerseKey: string | null; // for audio-sync
};

type Ctx = ReadingState & {
  setArabicFontSize: (n: number) => void;
  bumpFontSize: (delta: number) => void;
  setReadingFontFamily: (s: ArabicScript) => void;
  setTranslationLang: (l: TranslationLang) => void;
  setTranslationIdOverride: (id: number | null) => void;
  setPlaybackSpeed: (s: PlaybackSpeed) => void;
  setHighlightedVerseKey: (k: string | null) => void;
  /** Resolves the active translation id (override > language default). */
  effectiveTranslationId: number;
};

const DEFAULTS: ReadingState = {
  arabicFontSize: 1.25,
  readingFontFamily: "uthmani",
  translationLang: "en",
  translationIdOverride: null,
  playbackSpeed: 1,
  highlightedVerseKey: null,
};

const KEY = "athar:reading";
const ReadingContext = createContext<Ctx | null>(null);

export function ReadingProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<ReadingState>(DEFAULTS);

  // hydrate
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS((cur) => ({ ...cur, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
  }, []);

  // persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { highlightedVerseKey: _omit, ...persistable } = s;
    localStorage.setItem(KEY, JSON.stringify(persistable));
  }, [s]);

  const setArabicFontSize = useCallback(
    (n: number) =>
      setS((cur) => ({
        ...cur,
        arabicFontSize: Math.min(2, Math.max(1, Number(n.toFixed(2)))),
      })),
    [],
  );
  const bumpFontSize = useCallback(
    (delta: number) =>
      setS((cur) => ({
        ...cur,
        arabicFontSize: Math.min(2, Math.max(1, +(cur.arabicFontSize + delta).toFixed(2))),
      })),
    [],
  );
  const setReadingFontFamily = useCallback(
    (script: ArabicScript) => setS((cur) => ({ ...cur, readingFontFamily: script })),
    [],
  );
  const setTranslationLang = useCallback(
    (l: TranslationLang) =>
      setS((cur) => ({ ...cur, translationLang: l, translationIdOverride: null })),
    [],
  );
  const setTranslationIdOverride = useCallback(
    (id: number | null) => setS((cur) => ({ ...cur, translationIdOverride: id })),
    [],
  );
  const setPlaybackSpeed = useCallback(
    (sp: PlaybackSpeed) => setS((cur) => ({ ...cur, playbackSpeed: sp })),
    [],
  );
  const setHighlightedVerseKey = useCallback(
    (k: string | null) => setS((cur) => ({ ...cur, highlightedVerseKey: k })),
    [],
  );

  const effectiveTranslationId =
    s.translationIdOverride ?? TRANSLATION_BY_LANG[s.translationLang];

  const value = useMemo<Ctx>(
    () => ({
      ...s,
      effectiveTranslationId,
      setArabicFontSize,
      bumpFontSize,
      setReadingFontFamily,
      setTranslationLang,
      setTranslationIdOverride,
      setPlaybackSpeed,
      setHighlightedVerseKey,
    }),
    [
      s,
      effectiveTranslationId,
      setArabicFontSize,
      bumpFontSize,
      setReadingFontFamily,
      setTranslationLang,
      setTranslationIdOverride,
      setPlaybackSpeed,
      setHighlightedVerseKey,
    ],
  );

  return <ReadingContext.Provider value={value}>{children}</ReadingContext.Provider>;
}

export function useReading(): Ctx {
  const ctx = useContext(ReadingContext);
  if (!ctx) throw new Error("useReading must be used within ReadingProvider");
  return ctx;
}
