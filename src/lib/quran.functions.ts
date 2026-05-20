import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Quran.com / Quran Foundation public Content API v4
const QURAN_API = "https://api.quran.com/api/v4";
// Translation: 131 = Dr. Mustafa Khattab, The Clear Quran (English)
const TRANSLATION_ID = 131;
// Recitation: 7 = Mishari Rashid al-`Afasy
const RECITATION_ID = 7;
// Audio CDN base for verse-level recitations from the API
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

export const getVerseContent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      surah: z.number().int().min(1).max(114),
      ayah: z.number().int().min(1).max(286),
    }),
  )
  .handler(async ({ data }): Promise<VerseContent> => {
    const key = `${data.surah}:${data.ayah}`;

    const verseUrl =
      `${QURAN_API}/verses/by_key/${key}` +
      `?language=en&words=false&fields=text_uthmani` +
      `&translations=${TRANSLATION_ID}` +
      `&audio=${RECITATION_ID}`;

    const chapterUrl = `${QURAN_API}/chapters/${data.surah}?language=en`;

    const [verseRes, chapterRes] = await Promise.all([
      fetch(verseUrl, { headers: { Accept: "application/json" } }),
      fetch(chapterUrl, { headers: { Accept: "application/json" } }),
    ]);

    if (!verseRes.ok) {
      throw new Error(`Quran API verse fetch failed: ${verseRes.status}`);
    }
    if (!chapterRes.ok) {
      throw new Error(`Quran API chapter fetch failed: ${chapterRes.status}`);
    }

    const verseJson = (await verseRes.json()) as {
      verse: {
        verse_key: string;
        text_uthmani: string;
        translations?: { text: string; resource_name?: string }[];
        audio?: { url?: string };
      };
    };
    const chapterJson = (await chapterRes.json()) as {
      chapter: {
        name_simple: string;
        name_arabic: string;
        translated_name?: { name: string };
      };
    };

    const v = verseJson.verse;
    const c = chapterJson.chapter;

    const tr = v.translations?.[0];
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").trim();

    const audioPath = v.audio?.url ?? null;
    const audioUrl = audioPath
      ? audioPath.startsWith("http")
        ? audioPath
        : `${AUDIO_CDN}/${audioPath}`
      : null;

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
      audioUrl,
    };
  });
