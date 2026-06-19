// Dimonds AI Worker — Cloudflare Workers
// Deploy: wrangler deploy
// Secrets: GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY
//
// Actions:
//   { action:'comment', provider, event, context }  → { text }
//   { action:'taunt',   provider, placement, allNames, scores,
//                       winnerName, thisScore, topScore }   → { text }
//   { provider, hand, trick, gameState }             → { cardId }  (card play)

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const GEMINI_SAFETY = [
  { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH",        threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT",  threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold: "BLOCK_ONLY_HIGH" },
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─── Gemini ──────────────────────────────────────────────────────────────────
async function callGemini(prompt, env) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      safetySettings: GEMINI_SAFETY,
      generationConfig: { temperature: 0.95, maxOutputTokens: 120 },
    }),
  });
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

// ─── Llama via Groq ───────────────────────────────────────────────────────────
async function callLlama(prompt, env) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.95,
    }),
  });
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Mistral ──────────────────────────────────────────────────────────────────
async function callMistral(prompt, env) {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.95,
    }),
  });
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

function callProvider(provider, prompt, env) {
  if (provider === "gemini") return callGemini(prompt, env);
  if (provider === "llama")  return callLlama(prompt, env);
  if (provider === "mistral") return callMistral(prompt, env);
  return Promise.resolve("");
}

// ─── Prompt builders ──────────────────────────────────────────────────────────
function commentPrompt(event, context) {
  return `You are a witty, slightly smug AI playing a trick-taking card game called Dimonds. ` +
    `React to this game event in ONE short sentence (max 15 words), staying in character as a competitive but good-natured opponent. ` +
    `Event: ${event}. Context: ${context}. Reply with just the sentence, no quotes.`;
}

function tauntPrompt({ placement, allNames, scores, winnerName, thisScore, topScore }) {
  const place = ["", "1st", "2nd", "3rd", "4th"][placement] ?? `${placement}th`;
  return `You are an AI player who just finished ${place} place in a card game called Dimonds. ` +
    `Winner: ${winnerName} (${topScore} pts). Your score: ${thisScore} pts. ` +
    `All players: ${allNames.join(", ")}. Scores: ${JSON.stringify(scores)}. ` +
    `Write ONE short post-game taunt or reaction (max 15 words). Be playful. No quotes.`;
}

function cardPlayPrompt(hand, trick, gameState) {
  return `You are playing a trick-taking card game called Dimonds. ` +
    `Your hand: ${JSON.stringify(hand)}. Current trick: ${JSON.stringify(trick)}. ` +
    `Game state: ${JSON.stringify(gameState)}. ` +
    `Reply with ONLY the cardId of the card you want to play from your hand. No explanation.`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const { action, provider } = body;

    try {
      // ── Comment ──────────────────────────────────────────────────────────
      if (action === "comment") {
        const prompt = commentPrompt(body.event ?? "", body.context ?? "");
        const text = await callProvider(provider, prompt, env);
        return json({ text });
      }

      // ── End-of-game taunt ─────────────────────────────────────────────────
      if (action === "taunt") {
        const prompt = tauntPrompt(body);
        const text = await callProvider(provider, prompt, env);
        return json({ text });
      }

      // ── Card play (no action key) ─────────────────────────────────────────
      if (!action && body.hand) {
        const prompt = cardPlayPrompt(body.hand, body.trick ?? [], body.gameState ?? {});
        const raw = await callProvider(provider, prompt, env);
        // Extract first token that looks like a cardId
        const cardId = raw.split(/\s+/)[0].replace(/[^a-zA-Z0-9_-]/g, "");
        return json({ cardId });
      }

      return json({ error: "Unknown action" }, 400);
    } catch (err) {
      return json({ error: err.message ?? "Worker error" }, 500);
    }
  },
};
