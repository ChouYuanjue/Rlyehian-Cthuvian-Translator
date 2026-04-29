import crypto from "node:crypto";
import { COMMON_TERMS } from "./common-terms.mjs";
import { GENERATED_COMMON_TERMS, commonGeneratedTermFor, normalizeCommonBase } from "./common-generated.mjs";
import { lightweightDecomposeTerm } from "./lightweight-decomposer.mjs";

export const ROOTS = {
  KNOW: { surface: "kadishtu", verbs: ["know", "knows", "knew", "known", "understand", "understands", "understood", "study", "studies", "studied", "learn", "learns", "learned"] },
  WRITE_MARK: { surface: "athg", verbs: ["write", "writes", "wrote", "written", "sign", "signed", "mark", "marked"] },
  WAIT_DREAM_STASIS: { surface: "fhtagn", verbs: ["wait", "waits", "waited", "dream", "dreams", "dreamed", "sleep", "sleeps", "slept"] },
  OFFER: { surface: "fhayak", verbs: ["offer", "offers", "offered", "give", "gives", "gave", "given"] },
  TRANSFORM: { surface: "wk'hmr", verbs: ["transform", "transforms", "transformed", "change", "changes", "changed"] },
  SEE: { surface: "yll", verbs: ["see", "sees", "saw", "seen", "reveal", "reveals", "revealed"] },
  REMEMBER: { surface: "mnahn", verbs: ["remember", "remembers", "remembered", "record", "records", "recorded"] },
  USE: { surface: "ah", verbs: ["use", "uses", "used", "do", "does", "did", "make", "makes", "made", "making"] },
  BE: { surface: "ai", verbs: ["be", "am", "is", "are", "was", "were", "been", "being"] },
  TAKE: { surface: "bug", verbs: ["take", "takes", "took", "taken"] },
  SERVE: { surface: "vra", verbs: ["serve", "serves", "served"] },
  CONTRIBUTE: { surface: "fhayak", verbs: ["contribute", "contributes", "contributed"] },
  HAVE: { surface: "vra", verbs: ["have", "has", "had"] },
  EMPLOY: { surface: "s'uhn", verbs: ["employ", "employs", "employed"] },
  LEAD: { surface: "uln", verbs: ["lead", "leads", "led"] },
  EXPLORE: { surface: "ch", verbs: ["explore", "explores", "explored", "exploring"] },
  SHARE: { surface: "k'yarnak", verbs: ["share", "shares", "shared", "sharing"] },
  ENJOY: { surface: "lw'nafh", verbs: ["enjoy", "enjoys", "enjoyed"] }
};

export const ROOT_SURFACES = {
  VREN: "vren",
  SEE: "yll",
  FMAGL: "fmagl",
  KADISHTU: "kadishtu",
  ZHRN: "zhrn",
  BTHNK: "bthnk",
  MNAHN: "mnahn",
  RLUH: "r'luh",
  WGAGL: "wgah'nagl",
  ATHG: "athg",
  FHAYAK: "fhayak",
  FHTAGN: "fhtagn",
  FTAGHU: "ftaghu",
  GHRATH: "ghrath",
  GHAL: "ghal",
  GOR: "ghor",
  GOFNN: "gof'nn",
  KTHAR: "kthar",
  KYARNAK: "k'yarnak",
  LLOIG: "lloig",
  NILGHRI: "nilgh'ri",
  NGLUI: "nglui",
  NGHFT: "n'ghft",
  PHLEGETH: "phlegeth",
  RHAN: "rhan",
  RHYGG: "rhygg",
  SHUGG: "shugg",
  SHUGGOTH: "shuggoth",
  S_UHN: "s'uhn",
  ULH: "ulh",
  WGahn: "wgah'n",
  WK_HMR: "wk'hmr",
  YGNAIIH: "ygnaiih"
};

export const TERMS = {
  everything: { rc: "nilgh'ri", gloss: "all things" },
  nothing: { rc: "nilgh'ri", gloss: "nothing", polarity: "negative" },
  secret: { rc: "r'luh", gloss: "hidden, secret" },
  hidden: { rc: "r'luh", gloss: "hidden, secret" },
  city: { rc: "wgah'nagl-ri", gloss: "city" },
  "hidden city": { rc: "r'luh wgah'nagl-ri", gloss: "hidden city" },
  scholar: { rc: "kadishtu-nyth", gloss: "knowledge practitioner" },
  scientist: { rc: "zhrn-kadishtu-nyth", gloss: "measurement-knowledge practitioner" },
  book: { rc: "eeh-ftaghu", gloss: "knowledge skin" },
  prayer: { rc: "vulgtm", gloss: "prayer" },
  prayers: { rc: "vulgtmm", gloss: "prayers" },
  god: { rc: "llogr'yth", gloss: "god" },
  "dead god": { rc: "ph'nglui llogr'yth", gloss: "dead god" },
  human: { rc: "shuggoth", gloss: "human" },
  machine: { rc: "fmagl", gloss: "machine" },
  body: { rc: "bthnk", gloss: "body" },
  gate: { rc: "nglui", gloss: "gate" },
  sea: { rc: "ulh-ri'agl", gloss: "sea" },
  soul: { rc: "orr'e", gloss: "soul" },
  microscope: { rc: "vren-yll-fmagl", gloss: "small-seeing tool" }
};

Object.assign(TERMS, COMMON_TERMS);

export const PROPER_NAMES = {
  cthulhu: "Cthulhu",
  "r'lyeh": "R'lyeh",
  rlyeh: "R'lyeh",
  "yog-sothoth": "Yog-Sothoth",
  hastur: "Hastur",
  "shub-niggurath": "Shub-Niggurath"
};

const PRONOUNS = {
  i: { rc: "Ya", suffix: "yr" },
  me: { rc: "Ya", suffix: "ef" },
  you: { rc: "Tha", suffix: "yr" },
  he: { rc: "Hya", suffix: "yr" },
  she: { rc: "Hya", suffix: "yr" },
  it: { rc: "Hya", suffix: "yr" },
  we: { rc: "Cya", suffix: "yr" },
  us: { rc: "Cya", suffix: "ef" },
  they: { rc: "Fya", suffix: "yr" },
  them: { rc: "Fya", suffix: "ef" }
};

const PAST_FORMS = new Set(["wrote", "signed", "knew", "saw", "waited", "dreamed", "slept", "offered", "used", "transformed", "changed", "remembered", "studied", "learned", "made"]);
const STOP_FRAGMENT_WORDS = new Set(["a", "an", "the", "and", "or", "but", "also", "e", "g", "eg", "i", "my", "this", "through", "though", "where", "that", "which", "who", "whom", "at", "in", "on", "to", "from", "by", "of", "for", "as", "am", "is", "are", "was", "were", "be", "been", "being"]);
const NEGATORS = new Set(["not", "n't", "never", "no"]);
const AUXILIARIES = new Set(["do", "does", "did"]);
const PREPOSITIONS = {
  to: "ug",
  for: "ug",
  in: "agl",
  inside: "agl",
  at: "agl",
  on: "agl",
  beyond: "agl",
  from: "hup",
  of: "hup",
  with: "vra",
  by: "li",
  using: "li",
  into: "ep",
  as: "ep",
  about: null,
  concerning: null
};

export function normalizeEnglish(text) {
  return String(text || "")
    .replace(/[’‘`]/g, "'")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function canonicalTermKey(term, domain = "general") {
  return sha256(JSON.stringify({
    language_version: "RC-1.0",
    namespace: "terms",
    source_lang: "en",
    normalized_source: normalizeEnglish(term),
    domain
  }));
}

export function translateDeterministic(text, learnedTerms = {}) {
  const segments = segmentText(text);
  if (segments.length > 1) {
    const translated = segments.map((segment) => translateOneSegment(segment, learnedTerms));
    return {
      low: translated.map((item) => item.low).filter(Boolean).join(" "),
      high: translated.map((item) => item.high).filter(Boolean).join(" "),
      analysis: {
        segments: translated.map((item) => item.analysis),
        registry: { learned_terms_seen: Object.keys(learnedTerms).length }
      }
    };
  }
  return translateOneSegment(text, learnedTerms);
}

function translateOneSegment(text, learnedTerms = {}) {
  const ir = parseEnglish(text, learnedTerms);
  if (!ir) {
    const lexicalized = lexicalizeFragment(text, learnedTerms);
    const fallbackIr = lexicalizedFallbackIr(text, lexicalized);
    return {
      low: lexicalized.low,
      high: lexicalized.low,
      analysis: {
        ir: fallbackIr,
        source: text,
        fallback: lexicalized.fallback,
        tokens: lexicalized.tokens
      }
    };
  }
  const low = applyPhonology(realizeLow(ir));
  const high = compressHigh(low);
  return { low, high, analysis: { ir, registry: { learned_terms_seen: Object.keys(learnedTerms).length } } };
}

export function generatedCommonTermFor(term) {
  return commonGeneratedTermFor(term);
}

export function normalizeTermBase(term) {
  return normalizeCommonBase(term) || normalizeEnglish(term);
}

export function onlineLightweightTermFor(term) {
  return lightweightDecomposeTerm(term);
}

export function parseEnglish(text, learnedTerms = {}) {
  const source = chooseMainClause(expandContractions(String(text || "")));
  const tokens = tokenize(source).filter((token) => /^[A-Za-z0-9'’-]+$/.test(token));
  const rawTokens = stripDeterminers(tokens);
  const cleaned = rawTokens.map((token) => token.toLowerCase());
  if (!cleaned.length) return null;
  const verbIndex = buildVerbIndex();
  let predicateIndex = -1;
  for (let index = 0; index < cleaned.length; index += 1) {
    const token = cleaned[index];
    if (AUXILIARIES.has(token) && cleaned.slice(index + 1).some((later) => verbIndex[later])) continue;
    if (verbIndex[token]) {
      predicateIndex = index;
      break;
    }
  }
  if (predicateIndex < 0) return null;
  const predicate = verbIndex[cleaned[predicateIndex]];
  const subjectTokens = rawTokens.slice(0, predicateIndex).filter((token) => !NEGATORS.has(token.toLowerCase()) && !AUXILIARIES.has(token.toLowerCase()));
  const rest = rawTokens.slice(predicateIndex + 1);
  const polarity = cleaned.some((token) => NEGATORS.has(token) || token.endsWith("n't")) ? "negative" : "positive";
  const tam = PAST_FORMS.has(cleaned[predicateIndex]) || cleaned[predicateIndex] === "was" || cleaned[predicateIndex] === "were" || cleaned[predicateIndex] === "had" || cleaned[predicateIndex] === "took" || cleaned[predicateIndex] === "led" ? "past" : "present";
  const { objectTokens, phrases } = splitPrepositions(rest);
  const args = [];
  const subject = phraseToArgument(subjectTokens, "subject", "yr", learnedTerms);
  if (subject) {
    args.push(subject);
  } else if (predicateIndex === 0 && !cleaned[predicateIndex].endsWith("ing")) {
    args.push({ role: "subject", concept: "you", rc: PRONOUNS.you.rc, suffix: "yr" });
  }
  const object = phraseToArgument(objectTokens.filter((token) => !NEGATORS.has(token.toLowerCase())), "object", "ef", learnedTerms);
  if (object) {
    if (predicate === "BE" && normalizeEnglish(subjectTokens.join(" ")) === "name") {
      args.push({ ...object, rc: objectTokens.map((token) => cleanProperToken(token)).filter(Boolean).join(" ") });
    } else {
      args.push(object);
    }
  }
  for (const phrase of phrases) {
    if (phrase.preposition === "about" || phrase.preposition === "concerning") {
      const about = phraseToArgument(phrase.tokens, phrase.preposition, null, learnedTerms);
      if (about) args.push({ ...about, rc: `l'${about.rc}` });
    } else {
      const arg = phraseToArgument(phrase.tokens, phrase.preposition, PREPOSITIONS[phrase.preposition], learnedTerms);
      if (arg) args.push(arg);
    }
  }
  return { predicate, tam, polarity, arguments: args, source };
}

export function glossRc1(text, learnedTerms = {}) {
  const unsealed = unsealText(text);
  if (unsealed !== null) {
    return {
      low: unsealed,
      high: unsealed,
      analysis: { direction: "rc-to-en", sealed: true, decoded: unsealed }
    };
  }
  const glosses = buildReverseGlossIndex(learnedTerms);
  const tokens = String(text || "").trim().split(/\s+/).filter(Boolean);
  const analyses = tokens.map((token) => {
    const { base, role } = stripRole(token);
    const key = normalizeEnglish(base);
    const gloss = glosses[key] || decomposeCompoundGloss(base, glosses);
    if (gloss) return { token, base, role, gloss, preserved: false, note: `${base} → ${gloss}` };
    return { token, base, role, gloss: base, preserved: true, note: `${base} → ${base} (preserved)` };
  });
  const best = analyses.map((item) => item.gloss).join(" / ");
  const notes = analyses.map((item) => item.note).join(" / ");
  return { low: best, high: notes, analysis: { direction: "rc-to-en", analyses, summary: notes } };
}

export function buildReverseGlossIndex(learnedTerms = {}) {
  const glosses = {
    "ph'nglui": "dead; beyond the threshold",
    "mglw'nafh": "still living or active",
    "wgah'nagl": "dwelling-place",
    fhtagn: "waits, dreams, lies dormant",
    na: "not, no, non-",
    ya: "I, me",
    tha: "you",
    cya: "we, us",
    fya: "they, them"
  };
  for (const root of Object.values(ROOTS)) {
    glosses[root.surface] ??= root.surface;
    glosses[`nafl'${root.surface}`] ??= `non-present ${root.surface}`;
  }
  for (const term of Object.values(TERMS)) {
    glosses[normalizeEnglish(term.rc)] ??= term.gloss;
  }
  for (const [source, term] of Object.entries(GENERATED_COMMON_TERMS)) {
    glosses[normalizeEnglish(term.rc)] ??= `${source}; ${term.gloss}`;
  }
  for (const [source, term] of Object.entries(learnedTerms)) {
    if (term?.rc) glosses[normalizeEnglish(term.rc)] = term.literal_gloss || term.gloss || source;
  }
  return glosses;
}

export function buildTermFromRoots(selectedRoots) {
  if (!Array.isArray(selectedRoots) || !selectedRoots.length) return null;
  const surfaces = [];
  for (const root of selectedRoots) {
    if (!ROOT_SURFACES[root]) return null;
    surfaces.push(ROOT_SURFACES[root]);
  }
  return surfaces.join("-");
}

export function validateTermProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return { ok: false, reason: "proposal_not_object" };
  const selected = Array.isArray(proposal.selected_roots) ? proposal.selected_roots : [];
  if (selected.length > 0) {
    if (selected.length > 6) return { ok: false, reason: "too_many_selected_roots" };
    for (const root of selected) {
      if (!ROOT_SURFACES[root]) return { ok: false, reason: `unknown_root:${root}` };
    }
    const term = buildTermFromRoots(selected);
    if (!term || /[A-Za-z]{12,}/.test(term.replace(/kadishtu|phlegeth|shuggoth/g, ""))) return { ok: false, reason: "phonotactic_or_leakage_failure" };
    return { ok: true, term, strategy: "semantic_compound" };
  }
  const coined = String(proposal.coined_surface || "").trim().toLowerCase();
  const source = String(proposal.source_term || "");
  if (proposal.needs_new_root && coined) {
    const coinedValidation = validateCoinedSurface(coined, source);
    if (!coinedValidation.ok) return coinedValidation;
    return { ok: true, term: coined, strategy: "llm_coined_surface" };
  }
  return { ok: false, reason: proposal.needs_new_root ? "new_root_without_valid_surface" : "bad_selected_roots" };
}

function validateCoinedSurface(surface, source) {
  if (surface.length < 3 || surface.length > 40) return { ok: false, reason: "coined_length_invalid" };
  if (!/^[a-z][a-z' -]*[a-z]$/.test(surface)) return { ok: false, reason: "coined_characters_invalid" };
  if (!/[']/u.test(surface) && !/(cth|fht|mgl|ngl|th|gh|kh|sh|ll|rr)/u.test(surface)) return { ok: false, reason: "coined_not_cthuvian_enough" };
  const cleanSurface = surface.replace(/[^a-z]/g, "");
  const cleanSource = String(source).toLowerCase().replace(/[^a-z]/g, "");
  for (let size = 5; size <= Math.min(cleanSource.length, cleanSurface.length); size += 1) {
    for (let index = 0; index + size <= cleanSource.length; index += 1) {
      if (cleanSurface.includes(cleanSource.slice(index, index + size))) return { ok: false, reason: "coined_english_leakage" };
    }
  }
  return { ok: true };
}

function realizeLow(ir) {
  const root = ROOTS[ir.predicate].surface;
  const predicate = ir.tam === "past" ? `nafl'${root}` : root;
  const subjects = ir.arguments.filter((arg) => arg.role === "subject");
  const objects = ir.arguments.filter((arg) => arg.role === "object");
  const others = ir.arguments.filter((arg) => arg.role !== "subject" && arg.role !== "object");
  const pieces = [];
  pieces.push(...subjects.map(realizeArg));
  if (ir.polarity === "negative") pieces.push("na");
  pieces.push(predicate);
  pieces.push(...objects.map(realizeArg));
  pieces.push(...others.map(realizeArg));
  return pieces.filter(Boolean).join(" ");
}

function realizeArg(arg) {
  return arg.suffix ? `${arg.rc}-${arg.suffix}` : arg.rc;
}

function phraseToArgument(tokens, role, suffix, learnedTerms) {
  const kept = stripDeterminers(tokens).filter(Boolean);
  if (!kept.length) return null;
  const phrase = kept.join(" ");
  const lower = normalizeEnglish(phrase);
  if (PRONOUNS[lower]) {
    return { role, concept: lower, rc: PRONOUNS[lower].rc, suffix: suffix || PRONOUNS[lower].suffix };
  }
  return { role, concept: lower, rc: lookupPhraseTokens(kept, learnedTerms), suffix };
}

function lookupTerm(phrase, learnedTerms) {
  const lower = normalizeEnglish(phrase);
  if (PROPER_NAMES[lower]) return PROPER_NAMES[lower];
  if (TERMS[lower]) return TERMS[lower].rc;
  if (learnedTerms[lower]) return learnedTerms[lower].rc;
  const generated = commonGeneratedTermFor(lower);
  if (generated) return generated.rc;
  const lightweight = lightweightDecomposeTerm(lower);
  if (lightweight) return lightweight.rc;
  if (lower.includes(" ")) {
    const parts = lower
      .split(/\s+/)
      .map((part) => part.replace(/'s$/, ""))
      .filter((part) => part && !STOP_FRAGMENT_WORDS.has(part))
      .map((part) => lookupSingleTerm(part, learnedTerms) || sealText(part));
    if (parts.length) return parts.join(" ");
  }
  if (/^\d+$/.test(lower)) return numberToRc(lower);
  return sealText(phrase);
}

function lookupPhraseTokens(tokens, learnedTerms) {
  const phrase = tokens.join(" ");
  const lower = normalizeEnglish(phrase);
  if (PROPER_NAMES[lower]) return PROPER_NAMES[lower];
  if (TERMS[lower]) return TERMS[lower].rc;
  if (learnedTerms[lower]) return learnedTerms[lower].rc;
  const generated = commonGeneratedTermFor(lower);
  if (generated) return generated.rc;
  const lightweight = lightweightDecomposeTerm(lower);
  if (lightweight) return lightweight.rc;
  const parts = tokens.flatMap((token) => splitLexicalToken(token)).map((part) => part.replace(/'s$/i, ""));
  const pieces = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const partLower = part.toLowerCase();
    if (!part || STOP_FRAGMENT_WORDS.has(partLower)) continue;
    if (isNamedValue(parts, index)) {
      pieces.push(cleanProperToken(part));
      continue;
    }
    pieces.push(lookupToken(part, learnedTerms) || sealText(part));
  }
  return pieces.length ? pieces.join(" ") : sealText(phrase);
}

function lookupSingleTerm(term, learnedTerms) {
  term = normalizeEnglish(term).replace(/'s$/, "");
  if (PROPER_NAMES[term]) return PROPER_NAMES[term];
  if (TERMS[term]) return TERMS[term].rc;
  if (learnedTerms[term]) return learnedTerms[term].rc;
  const generated = commonGeneratedTermFor(term);
  if (generated) return generated.rc;
  const lightweight = lightweightDecomposeTerm(term);
  if (lightweight) return lightweight.rc;
  if (term.includes("-")) {
    const parts = term.split("-").map((part) => lookupSingleTerm(part, learnedTerms)).filter(Boolean);
    if (parts.length) return parts.join("-");
  }
  return null;
}

function lexicalizeFragment(text, learnedTerms) {
  const rawTokens = tokenize(expandContractions(text)).filter((token) => /^[A-Za-z0-9'’-]+$/.test(token));
  const tokens = [];
  const pieces = [];
  for (const raw of rawTokens) {
    const normalized = normalizeEnglish(raw).replace(/'s$/, "");
    if (!normalized || STOP_FRAGMENT_WORDS.has(normalized)) continue;
    if (PRONOUNS[normalized]) {
      tokens.push({ source: raw, rc: PRONOUNS[normalized].rc, strategy: "pronoun" });
      pieces.push(PRONOUNS[normalized].rc);
      continue;
    }
    const rc = lookupToken(raw, learnedTerms);
    if (rc) {
      tokens.push({ source: raw, rc, strategy: "lexicalized" });
      pieces.push(rc);
      continue;
    }
    if (/^\d+$/.test(normalized)) {
      const rcNumber = numberToRc(normalized);
      tokens.push({ source: raw, rc: rcNumber, strategy: "number" });
      pieces.push(rcNumber);
      continue;
    }
    const sealed = sealText(raw);
    tokens.push({ source: raw, rc: sealed, strategy: "sealed_token" });
    pieces.push(sealed);
  }
  if (!pieces.length) {
    const visible = rawTokens.map((token) => cleanProperToken(token)).filter(Boolean);
    if (visible.length) {
      return {
        low: visible.join(" "),
        fallback: "preserved_fragment",
        tokens: visible.map((token) => ({ source: token, rc: token, strategy: "preserved" }))
      };
    }
    return { low: sealText(text), fallback: "sealed_nonlexical", tokens: [] };
  }
  return { low: pieces.join(" "), fallback: "lexicalized_fragment", tokens };
}

function lexicalizedFallbackIr(text, lexicalized) {
  return {
    predicate: "LEXICAL_FRAGMENT",
    tam: "present",
    polarity: "positive",
    arguments: [
      {
        role: "fragment",
        concept: normalizeEnglish(text),
        rc: lexicalized.low,
        suffix: null,
        tokens: lexicalized.tokens
      }
    ],
    source: text
  };
}

function lookupToken(raw, learnedTerms) {
  const normalized = normalizeEnglish(raw).replace(/'s$/, "");
  if (PRONOUNS[normalized]) return PRONOUNS[normalized].rc;
  return lookupSingleTerm(normalized, learnedTerms) || (isLikelyProperToken(raw) ? cleanProperToken(raw) : null);
}

function isNamedValue(parts, index) {
  const current = String(parts[index] || "");
  if (!/^[A-Za-z][A-Za-z0-9'’-]*$/.test(current)) return false;
  const prev = String(parts[index - 1] || "").toLowerCase();
  const prev2 = String(parts[index - 2] || "").toLowerCase();
  return prev === "named" || prev === "called" || prev === "name" || (prev2 === "name" && prev === "is");
}

function splitLexicalToken(token) {
  return String(token || "")
    .split(/[-/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isLikelyProperToken(token) {
  const clean = cleanProperToken(token);
  return /^[A-Z][A-Za-z0-9'’]*$/.test(clean) || /^[A-Z0-9]{2,}$/.test(clean);
}

function cleanProperToken(token) {
  return String(token || "").replace(/[’‘`]/g, "'").replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, "");
}

function segmentText(text) {
  const normalized = String(text || "").replace(/[。！？]/g, ".");
  return normalized
    .split(/(?<=[.!?])\s+|[;]\s+|\s+[—–]\s+/u)
    .flatMap((chunk) => {
      const selected = chooseMainClause(chunk);
      if (selected !== chunk) return selected.split(/,\s+/);
      return chunk.split(/,\s+/);
    })
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function chooseMainClause(text) {
  const clauses = String(text || "").split(/,\s+/);
  if (clauses.length < 2) return text;
  const lead = clauses[0].trim().toLowerCase();
  if (!/^(based on|given|considering|according to)\b/.test(lead)) return text;
  const verbIndex = buildVerbIndex();
  for (let index = 1; index < clauses.length; index += 1) {
    const tokens = tokenize(clauses[index]).filter((token) => /^[A-Za-z0-9'’-]+$/.test(token));
    const stripped = stripDeterminers(tokens).map((token) => token.toLowerCase());
    if (stripped[0] && verbIndex[stripped[0]]) return clauses.slice(index).join(", ");
  }
  return text;
}

function expandContractions(text) {
  return String(text || "")
    .replace(/[’‘`]/g, "'")
    .replace(/\bI'm\b/gi, "I am")
    .replace(/\bI’m\b/gi, "I am")
    .replace(/\b([A-Za-z]+)'m\b/g, "$1 am")
    .replace(/\b([A-Za-z]+)'re\b/g, "$1 are")
    .replace(/\b(it|that|there|here|who|what|where|how)'s\b/gi, "$1 is")
    .replace(/\b([A-Za-z]+)'ve\b/g, "$1 have")
    .replace(/\b([A-Za-z]+)'ll\b/g, "$1 will")
    .replace(/\b([A-Za-z]+)'d\b/g, "$1 had")
    .replace(/\b([A-Za-z]+)n't\b/g, "$1 not");
}

function decomposeCompoundGloss(base, glosses) {
  const parts = normalizeEnglish(base).split("-");
  if (parts.length < 2) return null;
  const glossed = parts.map((part) => glosses[part]).filter(Boolean);
  if (!glossed.length) return null;
  return glossed.join(" + ");
}

function tokenize(text) {
  return String(text || "").replace(/[’‘`]/g, "'").match(/[A-Za-z][A-Za-z'’-]*|\d+|[^\w\s]/gu) || [];
}

function stripDeterminers(tokens) {
  return tokens.filter((token) => !["a", "an", "the"].includes(String(token).toLowerCase()));
}

function splitPrepositions(tokens) {
  let objectTokens = [];
  const phrases = [];
  let currentPrep = null;
  let current = [];
  for (const token of tokens) {
    const lower = String(token).toLowerCase();
    if (Object.hasOwn(PREPOSITIONS, lower)) {
      if (currentPrep === null) objectTokens = current;
      else phrases.push({ preposition: currentPrep, tokens: current });
      currentPrep = lower;
      current = [];
    } else {
      current.push(token);
    }
  }
  if (currentPrep === null) objectTokens = current;
  else phrases.push({ preposition: currentPrep, tokens: current });
  return { objectTokens, phrases };
}

function buildVerbIndex() {
  const index = {};
  for (const [id, root] of Object.entries(ROOTS)) {
    for (const verb of root.verbs) index[verb] = id;
  }
  return index;
}

function applyPhonology(surface) {
  return surface
    .replaceAll("ph-nglui", "ph'nglui")
    .replaceAll("l-geb", "l'geb")
    .replaceAll("nafl-", "nafl'")
    .replaceAll("c-fhayak", "cf'ayak")
    .replace(/\s+/g, " ")
    .trim();
}

function compressHigh(low) {
  return low
    .split(/\s+/)
    .map((token) => {
      const match = token.match(/^(.*)-(yr|ef)$/);
      return match ? match[1] : token;
    })
    .join(" ");
}

function stripRole(token) {
  const match = String(token).match(/^(.*)-(yr|ef|ug|agl|hup|vra|li|ep)$/);
  return match ? { base: match[1], role: match[2] } : { base: token, role: null };
}

function numberToRc(digits) {
  const names = { 0: "nyl", 1: "yak", 2: "ghal", 3: "thog", 4: "khrun", 5: "vlag", 6: "shuth", 7: "zhral", 8: "fhtan", 9: "mglun" };
  return `zhrn ${String(digits).split("").map((digit) => names[digit]).join("-")}`;
}

const SEAL_SYLLABLES = ["ya", "bhu", "cth", "dhu", "ee", "fha", "ghu", "ha", "ii", "zhya", "kha", "lla", "mna", "ngha", "u", "pha", "k'wa", "rha", "sha", "tha", "uu", "vha", "wha", "khs", "yha", "zha", "agh", "ebh", "ith", "og", "ulh", "yr"];
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function sealText(text) {
  const bytes = Buffer.from(String(text), "utf8");
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  while (bits.length % 5) bits += "0";
  const encoded = bits.match(/.{5}/g)?.map((chunk) => B32[Number.parseInt(chunk, 2)]).join("") || "";
  return `zha'${encoded.split("").map((char) => SEAL_SYLLABLES[B32.indexOf(char)]).join("-")}'zhro`;
}

function unsealText(text) {
  const value = String(text || "");
  if (!value.startsWith("zha'") || !value.endsWith("'zhro")) return null;
  const body = value.slice(4, -5);
  if (!body) return "";
  const reverse = new Map(SEAL_SYLLABLES.map((syllable, index) => [syllable, index]));
  let bits = "";
  for (const syllable of body.split("-")) {
    if (!reverse.has(syllable)) return null;
    bits += reverse.get(syllable).toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  try {
    return Buffer.from(bytes).toString("utf8").replace(/\0+$/g, "");
  } catch {
    return null;
  }
}
