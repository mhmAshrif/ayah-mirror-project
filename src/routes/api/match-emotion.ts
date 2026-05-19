import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenerativeAI } from "@google/generative-ai";

const ALLOWED_EMOTIONS = ["anxious", "sad", "disconnected", "grateful"] as const;
type Emotion = (typeof ALLOWED_EMOTIONS)[number];

type RemedyPayload = {
  surah: number;
  ayah: number;
  contextMessage: string;
  prescription: string;
};

const FALLBACKS: Record<Emotion, RemedyPayload> = {
  anxious: {
    surah: 2,
    ayah: 286,
    contextMessage:
      "Allah does not burden a soul beyond what it can bear. Your anxiety is real, but it is not the final word about you. Breathe — His mercy is closer than the weight on your chest.",
    prescription:
      "Within the next hour, perform wudu slowly and pray two rak'ahs, asking only: 'Ya Rabb, ease this for me.'",
  },
  sad: {
    surah: 94,
    ayah: 6,
    contextMessage:
      "Indeed, with hardship comes ease — promised twice in the same surah. Your sadness is seen by the One who created the heart that feels it. This valley has an exit.",
    prescription:
      "Today, write down one specific worry on paper, then read Surah Ad-Duha aloud before sleeping.",
  },
  disconnected: {
    surah: 50,
    ayah: 16,
    contextMessage:
      "Allah is closer to you than your own jugular vein. The distance you feel is a fog, not a wall. He has not moved — He is waiting for you to turn.",
    prescription:
      "Before sunset today, sit alone for five minutes in silence and say 'Astaghfirullah' one hundred times.",
  },
  grateful: {
    surah: 14,
    ayah: 7,
    contextMessage:
      "If you are grateful, He will surely increase you. Your gratitude itself is a gift He placed in your heart — recognize the Giver behind the gift.",
    prescription:
      "Within 24 hours, call or message one person who helped shape your faith and thank them specifically.",
  },
};

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .slice(0, 500)
    .trim();
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isRemedy(value: unknown): value is RemedyPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.surah === "number" &&
    typeof v.ayah === "number" &&
    typeof v.contextMessage === "string" &&
    typeof v.prescription === "string"
  );
}

export const Route = createFileRoute("/api/match-emotion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { selectedEmotion?: string; rawInput?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const selectedEmotion = String(body.selectedEmotion ?? "").toLowerCase();
        const rawInput = sanitize(String(body.rawInput ?? ""));

        if (!ALLOWED_EMOTIONS.includes(selectedEmotion as Emotion)) {
          return Response.json(
            { error: "Invalid emotion. Must be one of: " + ALLOWED_EMOTIONS.join(", ") },
            { status: 400 },
          );
        }
        const emotion = selectedEmotion as Emotion;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return Response.json(FALLBACKS[emotion], { status: 200 });
        }

        const systemPrompt = `You are a grounded Islamic counselor speaking with warm sincerity, not academic distance. You map an emotional state to ONE specific Quranic verse that meets the person where they are.

You MUST output RAW JSON ONLY — no markdown, no code fences, no preamble, no commentary. The JSON must exactly match this schema:
{
  "surah": <integer 1-114>,
  "ayah": <integer>,
  "contextMessage": "<empathetic, non-academic, exactly 3 sentences grounding the verse to their current state>",
  "prescription": "<one actionable, physical micro-task they can complete within 24 hours>"
}

Rules:
- Choose a verse that is widely accepted and clearly relevant to the emotion.
- contextMessage must be exactly 3 sentences, warm and direct, never preachy.
- prescription must be a single concrete physical action (e.g. "perform wudu and pray two rak'ahs", "write the worry on paper", "call one family member"). Never abstract.
- Output JSON only. No other characters before { or after }.`;

        const userPrompt = `Emotional state: ${emotion}
Their words: ${rawInput || "(no additional words provided)"}

Return the JSON now.`;

        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt,
            generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
          });

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          const result = await model.generateContent(userPrompt);
          clearTimeout(timeout);

          const text = stripFences(result.response.text());
          const parsed: unknown = JSON.parse(text);

          if (!isRemedy(parsed)) {
            return Response.json(FALLBACKS[emotion], { status: 200 });
          }
          return Response.json(parsed, { status: 200 });
        } catch (err) {
          console.error("match-emotion error:", err);
          return Response.json(FALLBACKS[emotion], { status: 200 });
        }
      },
    },
  },
});
