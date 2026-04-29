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
  USE: { surface: "ah", verbs: ["use", "uses", "used", "do", "does", "did"] }
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

const PAST_FORMS = new Set(["wrote", "signed", "knew", "saw", "waited", "dreamed", "slept", "offered", "used", "transformed", "changed", "remembered", "studied", "learned"]);
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
  const ir = parseEnglish(text, learnedTerms);
  if (!ir) {
    const sealed = sealText(text);
    return { low: sealed, high: sealed, analysis: { fallback: "sealed" } };
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
  const source = String(text || "");
  const tokens = tokenize(source).filter((token) => /^[A-Za-z0-9'’-]+$/.test(token));
  const cleaned = stripDeterminers(tokens).map((token) => token.toLowerCase());
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
  const subjectTokens = cleaned.slice(0, predicateIndex).filter((token) => !NEGATORS.has(token) && !AUXILIARIES.has(token));
  const rest = cleaned.slice(predicateIndex + 1);
  const polarity = cleaned.some((token) => NEGATORS.has(token) || token.endsWith("n't")) ? "negative" : "positive";
  const tam = PAST_FORMS.has(cleaned[predicateIndex]) ? "past" : "present";
  const { objectTokens, phrases } = splitPrepositions(rest);
  const args = [];
  const subject = phraseToArgument(subjectTokens, "subject", "yr", learnedTerms);
  if (subject) args.push(subject);
  const object = phraseToArgument(objectTokens.filter((token) => !NEGATORS.has(token)), "object", "ef", learnedTerms);
  if (object) args.push(object);
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
    return { token, base, role, gloss: glosses[key] || decomposeCompoundGloss(base, glosses) || "unknown or proper name" };
  });
  const best = analyses.map((item) => item.gloss).join(" / ");
  return { low: best, high: best, analysis: { direction: "rc-to-en", analyses } };
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
  return { role, concept: phrase, rc: lookupTerm(phrase, learnedTerms), suffix };
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
    const parts = lower.split(/\s+/).map((part) => lookupSingleTerm(part, learnedTerms));
    if (parts.every(Boolean)) return parts.join(" ");
  }
  if (/^\d+$/.test(lower)) return numberToRc(lower);
  return sealText(phrase);
}

function lookupSingleTerm(term, learnedTerms) {
  if (PROPER_NAMES[term]) return PROPER_NAMES[term];
  if (TERMS[term]) return TERMS[term].rc;
  if (learnedTerms[term]) return learnedTerms[term].rc;
  const generated = commonGeneratedTermFor(term);
  if (generated) return generated.rc;
  const lightweight = lightweightDecomposeTerm(term);
  if (lightweight) return lightweight.rc;
  return null;
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
    if (Object.hasOwn(PREPOSITIONS, token)) {
      if (currentPrep === null) objectTokens = current;
      else phrases.push({ preposition: currentPrep, tokens: current });
      currentPrep = token;
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
