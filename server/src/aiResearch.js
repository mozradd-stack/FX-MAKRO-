const Anthropic = require('@anthropic-ai/sdk');

// AI-assisted policy-rate research for the 5 central banks with no free
// no-key JSON API (Fed, BoE, BoJ, RBA, RBNZ) — Claude looks them up via the
// web_search server tool. Fully opt-in: with no ANTHROPIC_API_KEY set this
// module is never called (see the /api/ai-rates route in app.js), and the
// app works exactly as before on the researched static dataset.
const AI_BANKS = [
  { id: 'fed', name: 'US Federal Reserve (Fed), federal funds rate target range midpoint' },
  { id: 'boe', name: 'Bank of England (BoE), Bank Rate' },
  { id: 'boj', name: 'Bank of Japan (BoJ), policy rate' },
  { id: 'rba', name: 'Reserve Bank of Australia (RBA), cash rate' },
  { id: 'rbnz', name: 'Reserve Bank of New Zealand (RBNZ), Official Cash Rate' },
];

const GUIDANCE_VALUES = new Set(['hawkish', 'neutral', 'dovish']);

function asFiniteRate(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > -5 && n < 25 ? n : null;
}

function asIsoDateOrNull(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    return null;
  }
}

// Validates and sanitizes one bank's entry in isolation — a malformed or
// missing field for one bank never invalidates the other four.
function sanitizeBankEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rate = asFiniteRate(raw.rate);
  const guidance = GUIDANCE_VALUES.has(raw.guidance) ? raw.guidance : null;
  if (rate === null || guidance === null) return null;
  return {
    rate,
    guidance,
    nextMeeting: asIsoDateOrNull(raw.next_meeting),
    asOf: asIsoDateOrNull(raw.as_of),
  };
}

async function callClaudeWithWebSearch(client, prompt) {
  const messages = [{ role: 'user', content: prompt }];
  let finalText = null;

  // Server tools (web_search) execute and get folded back into the same
  // response automatically — this loop only exists as a safety net for the
  // rare pause_turn case documented for long agentic turns.
  for (let i = 0; i < 4; i += 1) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
      messages,
    });
    messages.push({ role: 'assistant', content: response.content });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (response.stop_reason === 'pause_turn') continue;
    finalText = textBlock ? textBlock.text : null;
    break;
  }
  return finalText;
}

async function researchCentralBanksViaAi() {
  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${today}. Use web search to find the CURRENT policy interest rate, forward guidance stance, and next scheduled policy meeting date for these central banks:
${AI_BANKS.map((b) => `- ${b.id}: ${b.name}`).join('\n')}

For each bank, classify forward guidance as exactly one of "hawkish" (signaling more hikes / higher for longer), "neutral" (data-dependent, no clear bias), or "dovish" (signaling cuts / easing) based on their most recent official statement or press conference.

Respond with ONLY a single JSON object, no other text, no markdown fences, in exactly this shape:
{
  "fed": { "rate": <number>, "guidance": "hawkish|neutral|dovish", "next_meeting": "YYYY-MM-DD", "as_of": "YYYY-MM-DD" },
  "boe": { ... same shape ... },
  "boj": { ... same shape ... },
  "rba": { ... same shape ... },
  "rbnz": { ... same shape ... }
}

If you cannot verify a field confidently from search results, use null for that field rather than guessing.`;

  const text = await callClaudeWithWebSearch(client, prompt);
  const parsed = extractJson(text);

  const result = { fetchedAt: new Date().toISOString() };
  for (const bank of AI_BANKS) {
    result[bank.id] = sanitizeBankEntry(parsed?.[bank.id]);
  }
  return result;
}

module.exports = { researchCentralBanksViaAi, AI_BANKS };
