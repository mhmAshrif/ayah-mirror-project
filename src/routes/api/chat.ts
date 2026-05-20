import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM_PROMPT = `You are AyahMirror's compassionate companion — a warm, grounded Islamic guide.
- Answer questions about the Quran, hadith (when widely-accepted), Islamic practice, spirituality, emotions, and life.
- When relevant, cite a specific Quranic verse as "Surah Name (X:Y)" with a short translation.
- Be sincere, not preachy. Direct, not academic.
- Never invent verses or hadith. If unsure, say so.
- Keep responses concise (4-8 sentences) unless asked for depth.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { messages?: ChatMessage[] };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
        if (!messages.length) {
          return Response.json({ error: "messages required" }, { status: 400 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "AI is not configured. Please add LOVABLE_API_KEY." },
            { status: 500 },
          );
        }

        try {
          const upstream = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: SYSTEM_PROMPT },
                  ...messages,
                ],
              }),
            },
          );
          if (!upstream.ok) {
            const text = await upstream.text().catch(() => "");
            if (upstream.status === 429)
              return Response.json(
                { error: "Rate limit reached. Please slow down a moment." },
                { status: 429 },
              );
            if (upstream.status === 402)
              return Response.json(
                { error: "AI credits exhausted. Please add credits in workspace settings." },
                { status: 402 },
              );
            return Response.json(
              { error: text || `AI gateway error ${upstream.status}` },
              { status: 502 },
            );
          }
          const data = (await upstream.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const reply = data.choices?.[0]?.message?.content ?? "";
          return Response.json({ reply });
        } catch (err) {
          console.error("chat error", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
