// OpenAI TTS Proxy for Rex English Master v30
// Cloudflare Workers 用
// Secret variable required: OPENAI_API_KEY
//
// Endpoint:
// POST /tts
// body: { text, lang, voice, instructions }
//
// Never put your API key in GitHub Pages or frontend JavaScript.

const ALLOWED_VOICES = new Set([
  "alloy","ash","ballad","coral","echo","fable","nova","onyx","sage","shimmer","verse","marin","cedar"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (url.pathname !== "/tts" || request.method !== "POST") {
      return new Response("Rex TTS proxy is running. POST /tts", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders(request) }
      });
    }

    try {
      const body = await request.json();
      const text = String(body.text || "").slice(0, 1000);
      const lang = String(body.lang || "ja-JP");
      const voice = ALLOWED_VOICES.has(body.voice) ? body.voice : "marin";
      const instructions = String(body.instructions || "").slice(0, 1000);

      if (!text) {
        return json({ error: "text is required" }, 400, request);
      }
      if (!env.OPENAI_API_KEY) {
        return json({ error: "OPENAI_API_KEY is not set" }, 500, request);
      }

      const style = instructions || (
        lang.startsWith("ja")
          ? "明るく、やさしく、自然な日本語で話してください。中学生を応援するかわいい恐竜レックスの相棒らしい声。"
          : "Speak in a bright, friendly, encouraging voice like Rex, a cute dinosaur learning buddy."
      );

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice,
          input: text,
          instructions: style,
          response_format: "mp3"
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return json({ error: "OpenAI API error", status: response.status, detail: errText.slice(0, 500) }, 500, request);
      }

      const audio = await response.arrayBuffer();
      return new Response(audio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=86400",
          ...corsHeaders(request)
        }
      });
    } catch (e) {
      return json({ error: e.message || String(e) }, 500, request);
    }
  }
};

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function json(obj, status, request) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });
}
