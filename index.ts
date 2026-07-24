/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  /* ── LLM API Keys ── */
  DEEPSEEK_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/* ══════════════════════════════════════════════════════════
   LLM API PROXY
   ══════════════════════════════════════════════════════════ */
type ChatMsg = { role: string; content: string };

async function handleChat(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json() as { model?: string; messages?: ChatMsg[] };
    const model = body.model ?? "openai";
    const messages = body.messages ?? [];

    if (!messages.length) return json({ error: "No messages provided" }, 400);

    switch (model) {
      case "deepseek":
        return await callDeepSeek(env, messages);
      case "codex":
      case "openai":
        return await callOpenAI(env, messages);
      case "claude":
        return await callClaude(env, messages);
      case "gemini":
        return await callGemini(env, messages);
      default:
        return json({ error: `Unknown model: ${model}` }, 400);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return json({ error: msg }, 500);
  }
}

/* ── GET /api/chat/status — which providers are connected ── */
function handleChatStatus(env: Env): Response {
  return json({
    deepseek: !!env.DEEPSEEK_API_KEY,
    openai: !!env.OPENAI_API_KEY,
    claude: !!env.ANTHROPIC_API_KEY,
    gemini: !!env.GEMINI_API_KEY,
  });
}

/* ── DeepSeek (OpenAI-compatible) ── */
async function callDeepSeek(env: Env, messages: ChatMsg[]): Promise<Response> {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) return json({ error: "DeepSeek API key not configured. Add DEEPSEEK_API_KEY in Cloudflare Dashboard → Settings → Variables and secrets." }, 503);

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "deepseek-chat", messages }),
  });

  if (!res.ok) return json({ error: `DeepSeek API error: ${res.status} ${await res.text()}` }, res.status);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return json({ content: data.choices?.[0]?.message?.content ?? "", provider: "deepseek" });
}

/* ── OpenAI (Codex / GPT) ── */
async function callOpenAI(env: Env, messages: ChatMsg[]): Promise<Response> {
  const key = env.OPENAI_API_KEY;
  if (!key) return json({ error: "OpenAI API key not configured. Add OPENAI_API_KEY in Cloudflare Dashboard → Settings → Variables and secrets." }, 503);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o", messages }),
  });

  if (!res.ok) return json({ error: `OpenAI API error: ${res.status} ${await res.text()}` }, res.status);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return json({ content: data.choices?.[0]?.message?.content ?? "", provider: "openai" });
}

/* ── Anthropic Claude ── */
async function callClaude(env: Env, messages: ChatMsg[]): Promise<Response> {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "Claude API key not configured. Add ANTHROPIC_API_KEY in Cloudflare Dashboard → Settings → Variables and secrets." }, 503);

  // Claude requires system prompt at top level, messages only user/assistant
  const systemMsg = messages.find(m => m.role === "system");
  const chatMsgs = messages.filter(m => m.role !== "system");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemMsg?.content ?? "You are a helpful AI assistant powering Constella.",
      messages: chatMsgs,
    }),
  });

  if (!res.ok) return json({ error: `Claude API error: ${res.status} ${await res.text()}` }, res.status);
  const data = await res.json() as { content?: { type?: string; text?: string }[] };
  const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") ?? "";
  return json({ content: text, provider: "claude" });
}

/* ── Google Gemini ── */
async function callGemini(env: Env, messages: ChatMsg[]): Promise<Response> {
  const key = env.GEMINI_API_KEY;
  if (!key) return json({ error: "Gemini API key not configured. Add GEMINI_API_KEY in Cloudflare Dashboard → Settings → Variables and secrets." }, 503);

  // Convert OpenAI-style messages to Gemini format
  const systemMsg = messages.find(m => m.role === "system");
  const chatMsgs = messages.filter(m => m.role !== "system");

  const contents = chatMsgs.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
      contents,
    }),
  });

  if (!res.ok) return json({ error: `Gemini API error: ${res.status} ${await res.text()}` }, res.status);
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ?? "";
  return json({ content: text, provider: "gemini" });
}

/* ── Utility ── */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

/* ══════════════════════════════════════════════════════════
   MAIN WORKER
   ══════════════════════════════════════════════════════════ */
const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    /* ── CORS preflight ── */
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    /* ── LLM Chat API ── */
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    /* ── Connection status ── */
    if (url.pathname === "/api/chat/status" && request.method === "GET") {
      return handleChatStatus(env);
    }

    /* ── Image optimization ── */
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    /* ── Everything else → vinext ── */
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
