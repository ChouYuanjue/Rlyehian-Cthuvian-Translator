import { getStore } from "@netlify/blobs";
import {
  TERMS,
  ROOT_SURFACES,
  buildTermFromRoots,
  canonicalTermKey,
  glossRc1,
  normalizeEnglish,
  sha256,
  translateDeterministic,
  validateTermProposal
} from "./rc1-runtime.mjs";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const originFailure = checkOrigin(request);
  if (originFailure) return originFailure;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const maxChars = Number.parseInt(process.env.MAX_INPUT_CHARS || "2000", 10);
  const text = String(body.text || "").slice(0, maxChars + 1);
  if (!text.trim()) return json({ error: "empty_input" }, 400);
  if (text.length > maxChars) return json({ error: "input_too_large", maxChars }, 413);

  const direction = body.direction === "rc-to-en" ? "rc-to-en" : "en-to-rc";
  const wantsLlm = Boolean(body.useLlm);
  const learnedTerms = await readLearnedTermsForText(text);

  if (direction === "rc-to-en") {
    const result = glossRc1(text);
    return json({ ...result, llm: { requested: wantsLlm, used: false, reason: "reverse_gloss_is_deterministic" } });
  }

  let result = translateDeterministic(text, learnedTerms);
  let llm = { requested: wantsLlm, used: false, reason: "not_requested" };

  if (wantsLlm) {
    const allowed = await llmAllowed(request);
    if (!allowed.ok) {
      llm = { requested: true, used: false, reason: allowed.reason };
    } else {
      const assisted = await maybeAssistUnknownTerms(text, learnedTerms);
      if (assisted.used) {
        result = translateDeterministic(text, { ...learnedTerms, ...assisted.learnedTerms });
        llm = { requested: true, used: true, accepted_terms: assisted.acceptedTerms };
      } else {
        llm = { requested: true, used: false, reason: assisted.reason };
      }
    }
  }

  return json({ ...result, llm });
}

async function readLearnedTermsForText(text) {
  const words = normalizeEnglish(text).split(/\s+/).filter(Boolean);
  const candidates = new Set();
  for (let start = 0; start < words.length; start += 1) {
    for (let length = 1; length <= 3; length += 1) {
      const phrase = words.slice(start, start + length).join(" ");
      if (phrase && !TERMS[phrase]) candidates.add(phrase);
    }
  }
  const learned = {};
  const store = registryStore();
  if (!store) return learned;
  await Promise.all([...candidates].map(async (phrase) => {
    const key = `terms/${canonicalTermKey(phrase)}.json`;
    const item = await store.get(key, { type: "json" }).catch(() => null);
    if (item?.rc) learned[phrase] = item;
  }));
  return learned;
}

async function maybeAssistUnknownTerms(text, learnedTerms) {
  const unknown = findLikelyUnknownTerm(text, learnedTerms);
  if (!unknown) return { used: false, reason: "no_unknown_term" };
  const proposal = await proposeTerm(unknown, text);
  const validated = validateTermProposal(proposal);
  if (!validated.ok) return { used: false, reason: validated.reason };

  const entry = {
    source: unknown,
    rc: validated.term,
    strategy: "llm_assisted_semantic_compound",
    components: proposal.selected_roots,
    literal_gloss: proposal.literal_gloss || proposal.selected_roots.join("-"),
    language_version: "RC-1.0",
    accepted_at: new Date().toISOString()
  };

  const store = registryStore();
  if (store) {
    const key = `terms/${canonicalTermKey(unknown)}.json`;
    await store.setJSON(key, entry, { onlyIfNew: true }).catch(() => {});
  }

  return { used: true, learnedTerms: { [normalizeEnglish(unknown)]: entry }, acceptedTerms: [entry] };
}

function findLikelyUnknownTerm(text, learnedTerms) {
  const stop = new Set(["i", "you", "he", "she", "it", "we", "they", "do", "does", "did", "not", "the", "a", "an", "to", "in", "with", "into", "about", "of", "for", "and"]);
  const words = normalizeEnglish(text).split(/\s+/).filter((word) => /^[a-z][a-z'-]*$/.test(word));
  for (let length = 3; length >= 1; length -= 1) {
    for (let index = 0; index + length <= words.length; index += 1) {
      const phrase = words.slice(index, index + length).join(" ");
      if (phrase in TERMS || phrase in learnedTerms) continue;
      if (phrase.split(" ").every((word) => stop.has(word))) continue;
      if (Object.values(ROOT_SURFACES).includes(phrase)) continue;
      return phrase;
    }
  }
  return null;
}

async function proposeTerm(term, context) {
  if (!process.env.LLM_API_KEY || !process.env.LLM_MODEL) {
    return fallbackProposal(term);
  }

  const baseUrl = (process.env.LLM_API_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      temperature: 0,
      top_p: 1,
      max_tokens: 256,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a constrained RC-1 term decomposition module. Return only JSON. Do not invent surface Cthuvian. Choose only from root IDs provided."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "TERM_DECOMPOSITION",
            source_term: term,
            context,
            known_rc1_roots: ROOT_SURFACES,
            required_shape: {
              source_term: "string",
              concept_type: "object|person|place|instrument|abstract|event",
              selected_roots: ["ROOT_ID"],
              literal_gloss: "string",
              needs_new_root: false
            }
          })
        }
      ]
    })
  });

  if (!response.ok) return fallbackProposal(term);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return fallbackProposal(term);
  try {
    return JSON.parse(content);
  } catch {
    return fallbackProposal(term);
  }
}

function fallbackProposal(term) {
  const lower = normalizeEnglish(term);
  if (lower.includes("scope") || lower.includes("micro")) {
    return { source_term: term, concept_type: "instrument", selected_roots: ["VREN", "SEE", "FMAGL"], literal_gloss: "small-seeing-tool", needs_new_root: false };
  }
  if (lower.includes("camera")) {
    return { source_term: term, concept_type: "instrument", selected_roots: ["SEE", "MNAHN", "FMAGL"], literal_gloss: "seeing-memory-tool", needs_new_root: false };
  }
  return { source_term: term, concept_type: "object", selected_roots: ["FMAGL"], literal_gloss: "tool/object", needs_new_root: false };
}

async function llmAllowed(request) {
  if (process.env.LLM_ENABLED !== "true") return { ok: false, reason: "llm_disabled" };
  const gate = process.env.LLM_GATE_TOKEN || "";
  const publicAllowed = process.env.PUBLIC_LLM_ENABLED === "true";
  const providedGate = request.headers.get("x-rc1-llm-gate") || "";
  if (!publicAllowed && (!gate || providedGate !== gate)) {
    return { ok: false, reason: "llm_gate_required" };
  }
  const rate = await checkLlmRateLimit(request);
  if (!rate.ok) return rate;
  return { ok: true };
}

async function checkLlmRateLimit(request) {
  const limit = Number.parseInt(process.env.LLM_DAILY_LIMIT_PER_IP || "30", 10);
  if (limit <= 0) return { ok: true };
  const store = registryStore();
  if (!store) return { ok: true };
  const ip = request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const key = `rate/${day}/${sha256(ip)}.json`;
  const current = (await store.get(key, { type: "json" }).catch(() => null)) || { count: 0 };
  if (current.count >= limit) return { ok: false, reason: "llm_rate_limited" };
  await store.setJSON(key, { count: current.count + 1, updated_at: new Date().toISOString() }).catch(() => {});
  return { ok: true };
}

function checkOrigin(request) {
  const expected = process.env.SITE_ORIGIN;
  if (!expected) return null;
  const origin = request.headers.get("origin");
  if (!origin || origin === expected) return null;
  return json({ error: "origin_not_allowed" }, 403);
}

function registryStore() {
  try {
    return getStore({ name: "rc1-registry", consistency: "strong" });
  } catch {
    return null;
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}
