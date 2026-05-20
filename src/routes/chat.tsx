import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, RefreshCw, Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Ask AyahMirror — AI Companion" }] }),
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function ChatPage() {
  const navigate = useNavigate();
  const { userId, authReady, theme } = useApp();
  const isLight = theme === "light";

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Assalamu alaikum. Ask me anything about the Quran, faith, or how you're feeling. I'll do my best to ground my answers in scripture.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (authReady && !userId) navigate({ to: "/login" });
  }, [authReady, userId, navigate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-20) }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "" }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, I couldn't respond just now." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <section className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
        <div className="flex items-center gap-2">
          <MessageCircle className={`h-5 w-5 ${isLight ? "text-teal-700" : "text-teal-300"}`} />
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
            Ask AyahMirror
          </h1>
        </div>

        <div className={`mt-4 flex-1 overflow-y-auto rounded-2xl border p-4 ${
          isLight ? "border-slate-200 bg-white/70" : "border-white/10 bg-white/5"
        }`}>
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-teal-500 text-white"
                      : isLight
                      ? "bg-slate-100 text-slate-900"
                      : "bg-white/10 text-slate-100"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-70 mb-1">
                      <Sparkles className="h-3 w-3" /> AyahMirror
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2 ${
                    isLight ? "bg-slate-100 text-slate-600" : "bg-white/10 text-slate-300"
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            className={`flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-400/40 ${
              isLight ? "border-slate-300 bg-white" : "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
            }`}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-teal-500 hover:bg-teal-400 text-white px-4 py-3 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </AppShell>
  );
}
