import { getStore } from "@netlify/blobs";
import {
  TERMS,
  ROOT_SURFACES,
  buildTermFromRoots,
  canonicalTermKey,
  generatedCommonTermFor,
  glossRc1,
  normalizeEnglish,
  normalizeTermBase,
  onlineLightweightTermFor,
  sha256,
  translateDeterministic,
  validateTermProposal
} from "./rc1-runtime.mjs";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const STOP_WORDS = new Set(["i", "you", "he", "she", "it", "we", "they", "me", "my", "your", "his", "her", "our", "their", "do", "does", "did", "not", "the", "a", "an", "to", "in", "with", "into", "about", "of", "for", "and", "or", "but", "also", "where", "though", "through", "this", "that", "is", "are", "am", "was", "were", "be", "been", "being"]);
const VERBISH = new Set(["know", "knows", "knew", "known", "understand", "understands", "understood", "study", "studies", "studied", "learn", "learns", "learned", "write", "writes", "wrote", "written", "sign", "signed", "mark", "marked", "wait", "waits", "waited", "dream", "dreams", "dreamed", "sleep", "sleeps", "slept", "offer", "offers", "offered", "give", "gives", "gave", "given", "transform", "transforms", "transformed", "change", "changes", "changed", "see", "sees", "saw", "seen", "reveal", "reveals", "revealed", "remember", "remembers", "remembered", "record", "records", "recorded", "use", "uses", "used", "make", "makes", "made", "making", "serve", "serves", "served", "contribute", "contributes", "contributed", "have", "has", "had", "lead", "leads", "led", "explore", "explores", "explored", "exploring", "share", "shares", "shared", "sharing", "enjoy", "enjoys", "enjoyed"]);

export default async function handler(request) {
  try {
    return await handleTranslate(request);
  } catch (error) {
    return json({ error: "internal_error", detail: publicErrorMessage(error) }, 500);
  }
}

async function handleTranslate(request) {
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

  if (direction === "rc-to-en") {
    const learnedReverse = await readLearnedReverseForText(text);
    const result = glossRc1(text, learnedReverse);
    let llm = { requested: wantsLlm, used: false, reason: "not_requested" };
    if (wantsLlm) {
      const allowed = await safeLlmAllowed(request);
      if (!allowed.ok) {
        llm = { requested: true, used: false, reason: allowed.reason };
      } else if (shouldSkipReverseLlm(text, result.analysis)) {
        llm = { requested: true, used: false, reason: "reverse_llm_skipped_long_input" };
      } else {
        const translation = await smoothReverseGloss({ source: text, gloss: result.low, analysis: result.analysis });
        llm = translation
          ? { requested: true, used: true, translation }
          : { requested: true, used: false, reason: "reverse_llm_failed" };
      }
    }
    return json({ ...result, llm });
  }

  const learnedTerms = await readLearnedTermsForText(text);
  let result = translateDeterministic(text, learnedTerms);
  let llm = { requested: wantsLlm, used: false, reason: "not_requested" };

  if (wantsLlm) {
    const allowed = await safeLlmAllowed(request);
    if (!allowed.ok) {
      llm = { requested: true, used: false, reason: allowed.reason };
    } else {
      const assisted = await maybeAssistUnknownTerms(text, learnedTerms, result);
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
    const key = `terms/${canonicalTermKey(normalizeTermBase(phrase))}.json`;
    const item = await store.get(key, { type: "json" }).catch(() => null);
    if (item?.rc && !isOverGenericLearnedTerm(item)) learned[phrase] = item;
  }));
  return learned;
}

async function readLearnedReverseForText(text) {
  const store = registryStore();
  if (!store) return {};
  const tokens = String(text || "").trim().split(/\s+/).filter(Boolean);
  const candidates = new Set();
  for (const token of tokens) {
    const normalized = normalizeEnglish(token);
    if (!normalized) continue;
    candidates.add(normalized);
    const roleStripped = normalized.replace(/-(yr|ef|ug|agl|hup|vra|li|ep)$/i, "");
    if (roleStripped) candidates.add(roleStripped);
  }
  const learned = {};
  await Promise.all([...candidates].map(async (candidate) => {
    const key = `reverse/${canonicalTermKey(normalizeTermBase(candidate))}.json`;
    const item = await store.get(key, { type: "json" }).catch(() => null);
    if (!item?.rc) return;
    const source = normalizeEnglish(item.source || item.literal_gloss || candidate);
    if (!source) return;
    learned[source] = item;
  }));
  return learned;
}

async function maybeAssistUnknownTerms(text, learnedTerms, deterministicResult = null) {
  const unknownTerms = findLikelyUnknownTerms(text, learnedTerms, deterministicResult);
  if (!unknownTerms.length) return { used: false, reason: "no_unknown_term" };
  const acceptedTerms = [];
  const learned = {};

  const entries = await Promise.all(unknownTerms.map((unknown) => assistOneUnknownTerm(unknown, text)));
  for (const entry of entries) {
    if (!entry?.source) continue;
    learned[normalizeEnglish(entry.source)] = entry;
    learned[normalizeTermBase(entry.source)] = entry;
    acceptedTerms.push(entry);
  }

  if (!acceptedTerms.length) return { used: false, reason: "no_accepted_terms" };
  return { used: true, learnedTerms: learned, acceptedTerms };
}

async function assistOneUnknownTerm(unknown, context) {
  const generated = generatedCommonTermFor(unknown);
  if (generated) {
    return {
      source: unknown,
      source_base: generated.source_base,
      rc: generated.rc,
      strategy: generated.strategy,
      components: [],
      literal_gloss: generated.gloss,
      language_version: "RC-1.0",
      accepted_at: new Date().toISOString()
    };
  }
  const lightweight = onlineLightweightTermFor(unknown);
  if (lightweight) {
    return {
      source: unknown,
      source_base: lightweight.source_base,
      rc: lightweight.rc,
      strategy: lightweight.strategy,
      components: lightweight.roots,
      literal_gloss: lightweight.gloss,
      language_version: "RC-1.0",
      accepted_at: new Date().toISOString()
    };
  }
  const proposal = await proposeTerm(unknown, context);
  const validated = validateTermProposal(proposal);
  if (!validated.ok) return null;

  const entry = {
    source: unknown,
    rc: validated.term,
    strategy: validated.strategy === "llm_coined_surface" ? "llm_coined_surface" : "llm_assisted_semantic_compound",
    components: proposal.selected_roots,
    literal_gloss: proposal.literal_gloss || proposal.selected_roots.join("-"),
    language_version: "RC-1.0",
    accepted_at: new Date().toISOString()
  };

  const store = registryStore();
  if (store) {
    const termKey = `terms/${canonicalTermKey(normalizeTermBase(unknown))}.json`;
    await store.setJSON(termKey, entry, { onlyIfNew: true }).catch(() => {});
    const reverseKey = `reverse/${canonicalTermKey(normalizeTermBase(entry.rc))}.json`;
    await store.setJSON(reverseKey, entry, { onlyIfNew: true }).catch(() => {});
  }

  return entry;
}

function findLikelyUnknownTerms(text, learnedTerms, deterministicResult = null) {
  const candidates = new Set(extractSealedSources(deterministicResult));
  const words = String(text || "")
    .replace(/[’‘`]/g, "'")
    .match(/[A-Za-z][A-Za-z'’-]*|\d+/gu) || [];
  for (const word of words) {
    const clean = word.replace(/'s$/i, "").replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, "");
    if (isAssistCandidate(clean, learnedTerms)) candidates.add(normalizeEnglish(clean));
  }
  return [...candidates].slice(0, Number.parseInt(process.env.LLM_MAX_TERMS_PER_REQUEST || "24", 10));
}

function extractSealedSources(result) {
  const found = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const source = value.source || value.concept;
    if ((value.strategy === "sealed_token" || value.rc?.startsWith?.("zha'")) && isAssistCandidate(source, {})) {
      found.push(normalizeEnglish(source));
    }
    Object.values(value).forEach(visit);
  };
  visit(result?.analysis);
  return found;
}

function isAssistCandidate(term, learnedTerms) {
  const lower = normalizeEnglish(term).replace(/'s$/, "");
  if (!/^[a-z][a-z'-]{2,}$/i.test(String(term || ""))) return false;
  if (/^[A-Z0-9]{2,}$/.test(String(term || ""))) return false;
  if (STOP_WORDS.has(lower) || VERBISH.has(lower)) return false;
  if (TERMS[lower] || learnedTerms[lower]) return false;
  if (generatedCommonTermFor(lower) || onlineLightweightTermFor(lower)) return true;
  if (Object.values(ROOT_SURFACES).includes(lower)) return false;
  return true;
}

async function proposeTerm(term, context) {
  if (!process.env.LLM_API_KEY || !process.env.LLM_MODEL) {
    return fallbackProposal(term);
  }
  if (process.env.LLM_TERM_DECOMPOSITION_ENABLED === "false") {
    return fallbackProposal(term);
  }

  const baseUrl = (process.env.LLM_API_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.parseInt(process.env.LLM_TERM_TIMEOUT_MS || "3000", 10));
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`
    },
      signal: controller.signal,
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
              policy: {
                prefer_known_roots: true,
                if_roots_are_insufficient: process.env.LLM_ALLOW_COINED_TERMS === "true"
                  ? "Return no selected_roots, set needs_new_root true, and provide a coined_surface that looks like RC-1, contains apostrophes or clusters such as cth/fht/mgl/ngl/th/gh/kh/sh, and does not preserve English spelling."
                  : "Use the nearest existing root paraphrase. Do not set needs_new_root true."
              },
              required_shape: {
                source_term: "string",
                concept_type: "object|person|place|instrument|abstract|event",
                selected_roots: ["ROOT_ID"],
                literal_gloss: "string",
                needs_new_root: false,
                coined_surface: "optional string, only when selected_roots is empty and needs_new_root is true"
              }
            })
          }
        ]
      })
    });
  } catch {
    clearTimeout(timeout);
    return fallbackProposal(term);
  }
  clearTimeout(timeout);

  if (!response.ok) return fallbackProposal(term);
  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return fallbackProposal(term);
  try {
    return normalizeProposal(term, JSON.parse(content));
  } catch {
    return fallbackProposal(term);
  }
}

async function smoothReverseGloss({ source, gloss, analysis }) {
  if (!process.env.LLM_API_KEY || !process.env.LLM_MODEL) return null;
  const baseUrl = (process.env.LLM_API_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.parseInt(process.env.LLM_REVERSE_TIMEOUT_MS || "6000", 10));
  const maxAnalyses = Number.parseInt(process.env.LLM_REVERSE_MAX_ANALYSES || "80", 10);
  const tokenAnalyses = (analysis?.analyses || []).slice(0, maxAnalyses);
  const compactGloss = truncateForLlm(gloss, Number.parseInt(process.env.LLM_REVERSE_MAX_GLOSS_CHARS || "3000", 10));
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`
    },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        temperature: 0,
        top_p: 1,
        max_tokens: 384,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You turn RC-1/R'lyehian literal glosses into natural English. Return only JSON. Do not invent facts. Preserve unknown/proper names exactly as shown in the gloss."
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "RC1_REVERSE_NATURAL_TRANSLATION",
              source_rc1: source,
              literal_gloss: compactGloss,
              token_analyses: tokenAnalyses,
              truncated: tokenAnalyses.length < (analysis?.analyses || []).length || compactGloss.length < String(gloss || "").length,
              output_schema: { translation: "string" }
            })
          }
        ]
      })
    });
  } catch {
    clearTimeout(timeout);
    return null;
  }
  clearTimeout(timeout);
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    const translation = String(parsed.translation || "").trim();
    return translation || null;
  } catch {
    return null;
  }
}

function truncateForLlm(value, maxChars) {
  const text = String(value || "");
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 24))} ... [gloss truncated]`;
}

function shouldSkipReverseLlm(text, analysis) {
  const maxChars = Number.parseInt(process.env.LLM_REVERSE_DIRECT_MAX_SOURCE_CHARS || "400", 10);
  const maxTokens = Number.parseInt(process.env.LLM_REVERSE_DIRECT_MAX_TOKENS || "30", 10);
  return String(text || "").length > maxChars || (analysis?.analyses || []).length > maxTokens;
}

function normalizeProposal(term, proposal) {
  const lower = normalizeEnglish(term);
  if (!proposal || typeof proposal !== "object") return fallbackProposal(term);
  if (proposal.needs_new_root && process.env.LLM_ALLOW_COINED_TERMS !== "true") return fallbackProposal(term);
  let roots = Array.isArray(proposal.selected_roots) ? proposal.selected_roots : [];
  if (lower.includes("camera")) {
    if (!roots.includes("MNAHN") || !roots.includes("FMAGL")) return fallbackProposal(term);
  }
  if (proposal.concept_type === "instrument") {
    if (!roots.includes("FMAGL")) {
      roots = [...roots, "FMAGL"];
      proposal = { ...proposal, selected_roots: roots };
    }
  }
  if (roots.length === 1 && roots[0] === "FMAGL" && !/(tool|machine|device|instrument)/.test(lower)) {
    return fallbackProposal(term);
  }
  return proposal;
}

function fallbackProposal(term) {
  const lower = normalizeEnglish(term);
  if (lower.includes("scope") || lower.includes("micro")) {
    return { source_term: term, concept_type: "instrument", selected_roots: ["VREN", "SEE", "FMAGL"], literal_gloss: "small-seeing-tool", needs_new_root: false };
  }
  if (lower.includes("camera")) {
    return { source_term: term, concept_type: "instrument", selected_roots: ["SEE", "MNAHN", "FMAGL"], literal_gloss: "seeing-memory-tool", needs_new_root: false };
  }
  if (process.env.LLM_ALLOW_COINED_TERMS === "true") {
    return { source_term: term, concept_type: "object", selected_roots: [], literal_gloss: "coined RC-1 surface", needs_new_root: true, coined_surface: deterministicCoinedSurface(term) };
  }
  return { source_term: term, concept_type: "object", selected_roots: ["FMAGL"], literal_gloss: "tool/object", needs_new_root: false };
}

function isOverGenericLearnedTerm(item) {
  return item?.rc === "fmagl" && item?.strategy === "llm_assisted_semantic_compound";
}

function deterministicCoinedSurface(term) {
  const syllables = ["n'gh", "cth", "ulh", "fht", "mgl", "kh", "sh", "vra", "ll", "rha", "ghu", "th", "zhr", "agl", "nyth", "kha"];
  const digest = sha256(`RC-1.0:${normalizeEnglish(term)}`);
  const indexes = [0, 2, 4].map((offset) => Number.parseInt(digest.slice(offset, offset + 2), 16) % syllables.length);
  const pieces = indexes.map((index) => syllables[index]);
  const surface = pieces.join("");
  if (/[']/u.test(surface) || /(cth|fht|mgl|ngl|th|gh|kh|sh|ll|rr)/u.test(surface)) return surface;
  return `${pieces[0]}'${pieces.slice(1).join("")}`;
}

async function llmAllowed(request) {
  if (process.env.LLM_ENABLED !== "true") return { ok: false, reason: "llm_disabled" };
  const gate = process.env.LLM_GATE_TOKEN || "";
  const publicAllowed = process.env.PUBLIC_LLM_ENABLED === "true" || process.env.LLM_REQUIRE_GATE !== "true";
  const providedGate = request.headers.get("x-rc1-llm-gate") || "";
  if (!publicAllowed && (!gate || providedGate !== gate)) {
    return { ok: false, reason: "llm_gate_required" };
  }
  const rate = await checkLlmRateLimit(request);
  if (!rate.ok) return rate;
  return { ok: true };
}

async function safeLlmAllowed(request) {
  try {
    return await llmAllowed(request);
  } catch {
    return { ok: false, reason: "llm_guard_failed" };
  }
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

function publicErrorMessage(error) {
  if (process.env.NODE_ENV === "development" || process.env.NETLIFY_DEV === "true") {
    return error?.message || String(error);
  }
  return "The translation function failed before producing a normal response.";
}
