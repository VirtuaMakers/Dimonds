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

const OFFLINE_EMOJI = { gemini: "✨", llama: "🦙", mistral: "🌬️" };

// ─── Prompt builders ──────────────────────────────────────────────────────────
function commentPrompt(event, context, provider) {
  const ban = OFFLINE_EMOJI[provider] ? ` Do NOT end your reply with ${OFFLINE_EMOJI[provider]}.` : "";
  return `You are a witty, slightly smug AI playing a trick-taking card game called Dimonds. ` +
    `React to this game event in ONE short sentence (max 15 words), staying in character as a competitive but good-natured opponent. ` +
    `Event: ${event}. Context: ${context}. Reply with just the sentence, no quotes.${ban}`;
}

function tauntPrompt({ placement, allNames, scores, winnerName, thisScore, topScore }, provider) {
  const place = ["", "1st", "2nd", "3rd", "4th"][placement] ?? `${placement}th`;
  const ban = OFFLINE_EMOJI[provider] ? ` Do NOT end your reply with ${OFFLINE_EMOJI[provider]}.` : "";
  return `You are an AI player who just finished ${place} place in a card game called Dimonds. ` +
    `Winner: ${winnerName} (${topScore} pts). Your score: ${thisScore} pts. ` +
    `All players: ${allNames.join(", ")}. Scores: ${JSON.stringify(scores)}. ` +
    `Write ONE short post-game taunt or reaction (max 15 words). Be playful. No quotes.${ban}`;
}

function cardPlayPrompt(hand, trick, gs) {
  const { trumpBroken, role, scores, tricksPlayed, roundNum, myPlayerIdx,
          ledSuit, goldenAgeActive, otherHandSizes, cardsPlayedThisRound } = gs ?? {};
  const parts = [
    `You are playing a trick-taking card game called Dimonds where diamonds (♦) are trump.`,
    `Your hand (pick one card from this list): ${JSON.stringify(hand)}.`,
  ];
  if (trick?.length) parts.push(`Current trick so far: ${JSON.stringify(trick)}.`);
  if (ledSuit) parts.push(`The led suit is ${ledSuit} — you MUST follow suit if you have any ${ledSuit} cards.`);
  if (trumpBroken != null) parts.push(`Diamonds broken: ${trumpBroken ? "yes — diamonds can be led and played" : "no — do not lead diamonds unless you have no other suit"}.`);
  if (goldenAgeActive) parts.push(`Golden Age is active: all diamond point values are doubled this round.`);
  if (cardsPlayedThisRound?.length) parts.push(`Cards played in previous tricks this round (use this to count cards and track who has what): ${JSON.stringify(cardsPlayedThisRound)}.`);
  if (scores?.length) parts.push(`Current scores — ${scores.map(s => `${s.name}: ${s.total} total, ${s.round} this round`).join("; ")}.`);
  if (tricksPlayed != null) parts.push(`Tricks completed: ${tricksPlayed} of 13.`);
  if (roundNum != null) parts.push(`Round: ${roundNum}.`);
  if (otherHandSizes) parts.push(`Other players' remaining hand sizes: ${JSON.stringify(otherHandSizes.map((n, i) => i === myPlayerIdx ? null : { player: i, cards: n }))}.`);
  if (role) parts.push(`Your strategic role this round: ${role}.`);
  parts.push(`Reply with ONLY the cardId of the card you want to play. No explanation.`);
  return parts.join(" ");
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
        const prompt = commentPrompt(body.event ?? "", body.context ?? "", provider);
        const text = await callProvider(provider, prompt, env);
        return json({ text });
      }

      // ── End-of-game taunt ─────────────────────────────────────────────────
      if (action === "taunt") {
        const prompt = tauntPrompt(body, provider);
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
