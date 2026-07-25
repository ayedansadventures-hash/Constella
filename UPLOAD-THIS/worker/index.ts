/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: any;
  IMAGES: any;
  // API Keys from Cloudflare Secrets
  KIMI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/* ── Custom Proxy Logic for Real AI APIs ── */
async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const { model, messages } = await request.json() as any;
    
    if (model === "kimi") {
      if (!env.KIMI_API_KEY) return new Response(JSON.stringify({ error: "Missing KIMI_API_KEY in Cloudflare Settings" }), { status: 400 });
      const apiRes = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.KIMI_API_KEY}` },
        body: JSON.stringify({ model: "moonshot-v1-32k", messages })
      });
      const data: any = await apiRes.json();
      return new Response(JSON.stringify({ content: data.choices?.[0]?.message?.content || data.error?.message || "Error" }), { headers: { "Content-Type": "application/json" } });
    }
    
    if (model === "deepseek") {
      if (!env.DEEPSEEK_API_KEY) return new Response(JSON.stringify({ error: "Missing DEEPSEEK_API_KEY in Cloudflare Settings" }), { status: 400 });
      const apiRes = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: "deepseek-chat", messages })
      });
      const data: any = await apiRes.json();
      return new Response(JSON.stringify({ content: data.choices?.[0]?.message?.content || data.error?.message || "Error" }), { headers: { "Content-Type": "application/json" } });
    }
    
    if (model === "claude") {
      if (!env.ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY in Cloudflare Settings" }), { status: 400 });
      const sysMsg = messages.find((m: any) => m.role === "system")?.content || "";
      const otherMsgs = messages.filter((m: any) => m.role !== "system");
      
      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-fabel", max_tokens: 1024, system: sysMsg, messages: otherMsgs })
      });
      const data: any = await apiRes.json();
      return new Response(JSON.stringify({ content: data.content?.[0]?.text || data.error?.message || "Error" }), { headers: { "Content-Type": "application/json" } });
    }
    
    if (model === "gemini") {
      if (!env.GEMINI_API_KEY) return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY in Cloudflare Settings" }), { status: 400 });
      const sysMsg = messages.find((m: any) => m.role === "system")?.content || "";
      const otherMsgs = messages.filter((m: any) => m.role !== "system").map((m: any) => ({
        role: m.role === "assistant" ? "model" : m.role,
        parts: [{ text: m.content }]
      }));
      
      const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sysMsg }] },
          contents: otherMsgs
        })
      });
      const data: any = await apiRes.json();
      return new Response(JSON.stringify({ content: data.candidates?.[0]?.content?.parts?.[0]?.text || data.error?.message || "Error" }), { headers: { "Content-Type": "application/json" } });
    }
    
    return new Response(JSON.stringify({ error: "Unknown model" }), { status: 400 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // AI API Route endpoints
    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env);
    }
    if (request.method === "GET" && url.pathname === "/api/chat/status") {
      const connections = {
        kimi: !!env.KIMI_API_KEY,
        deepseek: !!env.DEEPSEEK_API_KEY,
        claude: !!env.ANTHROPIC_API_KEY,
        gemini: !!env.GEMINI_API_KEY
      };
      return new Response(JSON.stringify(connections), { headers: { "Content-Type": "application/json" } });
    }

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

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
