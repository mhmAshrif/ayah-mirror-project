import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Quran.com / Quran Foundation public Content API v4
const QURAN_API = "https://api.quran.com/api/v4";
const DEFAULT_TRANSLATION_ID = 131; // Dr. Mustafa Khattab, The Clear Quran
const DEFAULT_RECITATION_ID = 7; // Mishari Rashid al-`Afasy
const AUDIO_CDN = "https://verses.quran.com";

export type VerseContent = {
  verseKey: string;
  surah: number;
  ayah: number;
  surahNameEn: string;
  surahNameAr: string;
  surahNameTranslated: string;
  arabic: string;
  translation: string;
  translationAuthor: string;
  audioUrl: string | null;
};

export type SurahMeta = {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name: string;
  verses_count: number;
  revelation_place: string;
};

export type WordItem = {
  position: number;
  arabic: string;
  translation: string;
  transliteration: string | null;
};

export type ChapterVerse = {
  id: number;
  verseKey: string;
  ayah: number;
  arabic: string;
  translation: string;
  audioUrl: string | null;
  words?: WordItem[];
};

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").trim();
const absAudio = (p: string | null | undefined) =>
  !p ? null : p.startsWith("http") ? p : `${AUDIO_CDN}/${p}`;

export const getVerseContent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      surah: z.number().int().min(1).max(114),
      ayah: z.number().int().min(1).max(286),
      translationId: z.number().int().optional(),
      reciterId: z.number().int().optional(),
    }),
  )
  .handler(async ({ data }): Promise<VerseContent> => {
    const translationId = data.translationId ?? DEFAULT_TRANSLATION_ID;
    const reciterId = data.reciterId ?? DEFAULT_RECITATION_ID;
    const key = `${data.surah}:${data.ayah}`;

    const verseUrl =
      `${QURAN_API}/verses/by_key/${key}` +
      `?language=en&words=false&fields=text_uthmani` +
      `&translations=${translationId}` +
      `&audio=${reciterId}`;
    const chapterUrl = `${QURAN_API}/chapters/${data.surah}?language=en`;

    const [vRes, cRes] = await Promise.all([
      fetch(verseUrl, { headers: { Accept: "application/json" } }),
      fetch(chapterUrl, { headers: { Accept: "application/json" } }),
    ]);
    if (!vRes.ok) throw new Error(`Quran API verse failed: ${vRes.status}`);
    if (!cRes.ok) throw new Error(`Quran API chapter failed: ${cRes.status}`);

    const vJson = (await vRes.json()) as {
      verse: {
        verse_key: string;
        text_uthmani: string;
        translations?: { text: string; resource_name?: string }[];
        audio?: { url?: string };
      };
    };
    const cJson = (await cRes.json()) as {
      chapter: {
        name_simple: string;
        name_arabic: string;
        translated_name?: { name: string };
      };
    };
    const v = vJson.verse;
    const c = cJson.chapter;
    const tr = v.translations?.[0];

    return {
      verseKey: v.verse_key,
      surah: data.surah,
      ayah: data.ayah,
      surahNameEn: c.name_simple,
      surahNameAr: c.name_arabic,
      surahNameTranslated: c.translated_name?.name ?? c.name_simple,
      arabic: v.text_uthmani,
      translation: tr ? stripHtml(tr.text) : "",
      translationAuthor: tr?.resource_name ?? "The Clear Quran",
      audioUrl: absAudio(v.audio?.url),
    };
  });

export const listSurahs = createServerFn({ method: "GET" }).handler(
  async (): Promise<SurahMeta[]> => {
    const res = await fetch(`${QURAN_API}/chapters?language=en`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Failed to load surah list: ${res.status}`);
    const j = (await res.json()) as {
      chapters: Array<{
        id: number;
        name_simple: string;
        name_arabic: string;
        translated_name: { name: string };
        verses_count: number;
        revelation_place: string;
      }>;
    };
    return j.chapters.map((c) => ({
      id: c.id,
      name_simple: c.name_simple,
      name_arabic: c.name_arabic,
      translated_name: c.translated_name.name,
      verses_count: c.verses_count,
      revelation_place: c.revelation_place,
    }));
  },
);

export const getChapterVerses = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      surah: z.number().int().min(1).max(114),
      translationId: z.number().int().optional(),
      reciterId: z.number().int().optional(),
      withWords: z.boolean().optional(),
      perPage: z.number().int().min(1).max(50).optional(),
      page: z.number().int().min(1).optional(),
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      chapter: SurahMeta;
      verses: ChapterVerse[];
      totalPages: number;
      currentPage: number;
    }> => {
      const translationId = data.translationId ?? DEFAULT_TRANSLATION_ID;
      const reciterId = data.reciterId ?? DEFAULT_RECITATION_ID;
      const perPage = data.perPage ?? 10;
      const page = data.page ?? 1;

      const params = new URLSearchParams({
        language: "en",
        translations: String(translationId),
        audio: String(reciterId),
        fields: "text_uthmani",
        words: data.withWords ? "true" : "false",
        per_page: String(perPage),
        page: String(page),
      });
      if (data.withWords) {
        params.set("word_fields", "text_uthmani,translation,transliteration");
        params.set("word_translation_language", "en");
      }

      const [vRes, cRes] = await Promise.all([
        fetch(`${QURAN_API}/verses/by_chapter/${data.surah}?${params}`, {
          headers: { Accept: "application/json" },
        }),
        fetch(`${QURAN_API}/chapters/${data.surah}?language=en`, {
          headers: { Accept: "application/json" },
        }),
      ]);
      if (!vRes.ok) throw new Error(`Chapter verses failed: ${vRes.status}`);
      if (!cRes.ok) throw new Error(`Chapter meta failed: ${cRes.status}`);

      const vj = (await vRes.json()) as {
        verses: Array<{
          id: number;
          verse_key: string;
          verse_number: number;
          text_uthmani: string;
          translations?: { text: string }[];
          audio?: { url?: string };
          words?: Array<{
            position: number;
            text_uthmani?: string;
            translation?: { text?: string };
            transliteration?: { text?: string };
          }>;
        }>;
        pagination: { total_pages: number; current_page: number };
      };
      const cj = (await cRes.json()) as {
        chapter: {
          id: number;
          name_simple: string;
          name_arabic: string;
          translated_name: { name: string };
          verses_count: number;
          revelation_place: string;
        };
      };
      const c = cj.chapter;
      return {
        chapter: {
          id: c.id,
          name_simple: c.name_simple,
          name_arabic: c.name_arabic,
          translated_name: c.translated_name.name,
          verses_count: c.verses_count,
          revelation_place: c.revelation_place,
        },
        verses: vj.verses.map((v) => ({
          id: v.id,
          verseKey: v.verse_key,
          ayah: v.verse_number,
          arabic: v.text_uthmani,
          translation: v.translations?.[0] ? stripHtml(v.translations[0].text) : "",
          audioUrl: absAudio(v.audio?.url),
          words: data.withWords
            ? v.words?.map((w) => ({
                position: w.position,
                arabic: w.text_uthmani ?? "",
                translation: w.translation?.text ?? "",
                transliteration: w.transliteration?.text ?? null,
              }))
            : undefined,
        })),
        totalPages: vj.pagination.total_pages,
        currentPage: vj.pagination.current_page,
      };
    },
  );

export const getTafsir = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      surah: z.number().int().min(1).max(114),
      ayah: z.number().int().min(1).max(286),
      tafsirId: z.number().int().optional(), // 169 = Tafsir Ibn Kathir (Abridged) EN
    }),
  )
  .handler(async ({ data }): Promise<{ text: string; author: string } | null> => {
    const tafsirId = data.tafsirId ?? 169;
    const key = `${data.surah}:${data.ayah}`;
    const res = await fetch(
      `${QURAN_API}/tafsirs/${tafsirId}/by_ayah/${key}?language=en`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      tafsir?: { text?: string; resource_name?: string };
    };
    if (!j.tafsir?.text) return null;
    return {
      text: stripHtml(j.tafsir.text).slice(0, 4000),
      author: j.tafsir.resource_name ?? "Tafsir",
    };
  });

export const listReciters = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<{ id: number; name: string }>> => {
    const res = await fetch(
      `${QURAN_API}/resources/recitations?language=en`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const j = (await res.json()) as {
      recitations: Array<{ id: number; reciter_name: string; style?: string }>;
    };
    return j.recitations.map((r) => ({
      id: r.id,
      name: r.style ? `${r.reciter_name} (${r.style})` : r.reciter_name,
    }));
  },
);

export const listTranslations = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<{ id: number; name: string; author: string; language: string }>> => {
    const res = await fetch(
      `${QURAN_API}/resources/translations?language=en`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const j = (await res.json()) as {
      translations: Array<{
        id: number;
        name: string;
        author_name: string;
        language_name: string;
      }>;
    };
    return j.translations
      .filter((t) => t.language_name === "english")
      .map((t) => ({
        id: t.id,
        name: t.name,
        author: t.author_name,
        language: t.language_name,
      }));
  },
);

// Semantic search — AI-driven (Gemini) returns 3-4 verse refs + tafsir blurb,
// then we hydrate Arabic + translation from Quran Foundation Content API.
export const semanticVerseSearch = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string().min(1).max(500) }))
  .handler(
    async ({
      data,
    }): Promise<
      Array<{
        verseKey: string;
        surah: number;
        ayah: number;
        surahNameEn: string;
        arabic: string;
        translation: string;
        tafsirBlurb: string;
      }>
    > => {
      const apiKey = process.env.GEMINI_API_KEY;
      const fallback = [
        { surah: 2, ayah: 286, tafsirBlurb: "Allah does not burden a soul beyond what it can bear." },
        { surah: 94, ayah: 6, tafsirBlurb: "With every hardship, there is ease." },
        { surah: 13, ayah: 28, tafsirBlurb: "Hearts find rest in the remembrance of Allah." },
      ];

      let picks: Array<{ surah: number; ayah: number; tafsirBlurb: string }> = fallback;

      if (apiKey) {
        try {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction:
              "You are an Islamic scholar. Given a user's emotional or life situation, return 3-4 highly relevant Quranic verses. Output RAW JSON ONLY in the shape: {\"results\":[{\"surah\":int,\"ayah\":int,\"tafsirBlurb\":string}]}. tafsirBlurb is 1-2 sentences of context, warm but not preachy.",
            generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
          });
          const out = await model.generateContent(data.query);
          const parsed = JSON.parse(out.response.text()) as {
            results?: Array<{ surah?: number; ayah?: number; tafsirBlurb?: string }>;
          };
          if (Array.isArray(parsed.results) && parsed.results.length) {
            picks = parsed.results
              .filter(
                (r) =>
                  typeof r.surah === "number" &&
                  typeof r.ayah === "number" &&
                  typeof r.tafsirBlurb === "string",
              )
              .slice(0, 4) as typeof picks;
          }
        } catch (e) {
          console.error("semanticVerseSearch AI failed", e);
        }
      }

      const hydrated = await Promise.all(
        picks.map(async (p) => {
          try {
            const key = `${p.surah}:${p.ayah}`;
            const r = await fetch(
              `${QURAN_API}/verses/by_key/${key}?language=en&fields=text_uthmani&translations=${DEFAULT_TRANSLATION_ID}`,
              { headers: { Accept: "application/json" } },
            );
            if (!r.ok) return null;
            const j = (await r.json()) as {
              verse: {
                verse_key: string;
                text_uthmani: string;
                translations?: { text: string }[];
              };
            };
            const cR = await fetch(`${QURAN_API}/chapters/${p.surah}?language=en`, {
              headers: { Accept: "application/json" },
            });
            const cJ = cR.ok
              ? ((await cR.json()) as { chapter: { name_simple: string } })
              : null;
            return {
              verseKey: j.verse.verse_key,
              surah: p.surah,
              ayah: p.ayah,
              surahNameEn: cJ?.chapter.name_simple ?? `Surah ${p.surah}`,
              arabic: j.verse.text_uthmani,
              translation: j.verse.translations?.[0]
                ? stripHtml(j.verse.translations[0].text)
                : "",
              tafsirBlurb: p.tafsirBlurb,
            };
          } catch {
            return null;
          }
        }),
      );

      return hydrated.filter((x): x is NonNullable<typeof x> => !!x);
    },
  );

// Daily curated verse — deterministic by day so all users see the same one.
const DAILY_PICKS: Array<[number, number]> = [
  [2, 255], [2, 286], [3, 8], [3, 159], [13, 28], [14, 7], [17, 80],
  [20, 25], [25, 74], [39, 53], [40, 60], [55, 13], [65, 3], [93, 5],
  [94, 5], [94, 6], [99, 7], [103, 1], [108, 1], [112, 1],
];

export const getDailyVerse = createServerFn({ method: "GET" }).handler(
  async (): Promise<VerseContent> => {
    const day = Math.floor(Date.now() / 86_400_000);
    const [s, a] = DAILY_PICKS[day % DAILY_PICKS.length];
    const key = `${s}:${a}`;
    const verseUrl =
      `${QURAN_API}/verses/by_key/${key}?language=en&fields=text_uthmani` +
      `&translations=${DEFAULT_TRANSLATION_ID}&audio=${DEFAULT_RECITATION_ID}`;
    const chapterUrl = `${QURAN_API}/chapters/${s}?language=en`;
    const [vRes, cRes] = await Promise.all([
      fetch(verseUrl, { headers: { Accept: "application/json" } }),
      fetch(chapterUrl, { headers: { Accept: "application/json" } }),
    ]);
    const vJson = (await vRes.json()) as {
      verse: {
        verse_key: string;
        text_uthmani: string;
        translations?: { text: string; resource_name?: string }[];
        audio?: { url?: string };
      };
    };
    const cJson = (await cRes.json()) as {
      chapter: {
        name_simple: string;
        name_arabic: string;
        translated_name?: { name: string };
      };
    };
    const v = vJson.verse;
    const c = cJson.chapter;
    const tr = v.translations?.[0];
    return {
      verseKey: v.verse_key,
      surah: s,
      ayah: a,
      surahNameEn: c.name_simple,
      surahNameAr: c.name_arabic,
      surahNameTranslated: c.translated_name?.name ?? c.name_simple,
      arabic: v.text_uthmani,
      translation: tr ? stripHtml(tr.text) : "",
      translationAuthor: tr?.resource_name ?? "The Clear Quran",
      audioUrl: absAudio(v.audio?.url),
    };
  },
);
