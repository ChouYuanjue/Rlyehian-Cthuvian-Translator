import { readFile, writeFile } from "node:fs/promises";

const WORDLIST_PATH = "data/wordlists/google-5000-no-swears.txt";
const ROOTS_PATH = "data/rc1-root-glosses.json";
const OUT_JS_PATH = "netlify/functions/common-generated.mjs";
const OUT_REPORT_PATH = "data/generated/common-generated-report.json";

const STOP_WORDS = new Set([
  "the", "of", "and", "to", "a", "in", "for", "is", "on", "that", "by", "this",
  "with", "i", "you", "it", "not", "or", "be", "are", "from", "at", "as", "your",
  "an", "we", "will", "can", "us", "about", "if", "my", "has", "but", "our", "one",
  "do", "no", "they", "he", "she", "his", "her", "their", "them", "was", "were",
  "am", "been", "being", "there", "what", "which", "who", "when", "where", "why",
  "how", "than", "then", "so", "very", "also", "just"
]);

const IRREGULAR_BASES = new Map([
  ["children", "child"],
  ["people", "person"],
  ["men", "man"],
  ["women", "woman"],
  ["went", "go"],
  ["gone", "go"],
  ["saw", "see"],
  ["seen", "see"],
  ["wrote", "write"],
  ["written", "write"],
  ["knew", "know"],
  ["known", "know"],
  ["made", "make"],
  ["bought", "buy"],
  ["brought", "bring"],
  ["thought", "think"],
  ["found", "find"]
]);

const MORPHEMES = [
  ["micro", ["VREN"]],
  ["mini", ["VREN"]],
  ["macro", ["GHRATH"]],
  ["mega", ["GHRATH"]],
  ["super", ["GHRATH"]],
  ["photo", ["SEE", "MNAHN"]],
  ["video", ["SEE", "MNAHN"]],
  ["graph", ["ATHG"]],
  ["gram", ["ATHG"]],
  ["scope", ["SEE", "FMAGL"]],
  ["meter", ["ZHRN", "FMAGL"]],
  ["phone", ["GHOR", "AI", "FMAGL"]],
  ["tele", ["GHOR", "AI"]],
  ["bio", ["BTHNK"]],
  ["geo", ["SHUGG"]],
  ["hydro", ["ULH"]],
  ["aero", ["HRAL"]],
  ["thermo", ["CTHUGH"]],
  ["electro", ["CTHUGH"]],
  ["conduct", ["CTHUGH", "ZHRN"]],
  ["conductor", ["CTHUGH", "ZHRN", "FMAGL"]],
  ["semi", ["VREN"]],
  ["crypto", ["RLUH", "ZHRN"]],
  ["neuro", ["LLOIG", "BTHNK"]],
  ["dynamic", ["CTHUGH", "BUG"]],
  ["chrono", ["RHAN"]],
  ["logy", ["KADISHTU", "NA"]],
  ["ology", ["KADISHTU", "NA"]],
  ["ware", ["FMAGL"]],
  ["soft", ["PHLEGETH"]],
  ["web", ["PHLEGETH"]],
  ["net", ["PHLEGETH"]],
  ["book", ["ATHG", "FTAGHU"]],
  ["board", ["FTAGHU"]],
  ["port", ["NGLUI"]],
  ["air", ["HRAL"]],
  ["water", ["ULH"]],
  ["garden", ["RHYGG", "AGL"]],
  ["market", ["KYARNAK", "AGL"]]
];

const DERIVATIONAL_SUFFIXES = [
  ["er", ["NYTH"]],
  ["or", ["NYTH"]],
  ["ist", ["NYTH"]],
  ["ian", ["NYTH"]],
  ["ism", ["NA"]],
  ["ity", ["NA"]],
  ["ness", ["NA"]],
  ["tion", ["NA"]],
  ["sion", ["NA"]],
  ["ment", ["NA"]],
  ["ship", ["NA"]],
  ["ary", []],
  ["al", []],
  ["ic", []],
  ["ive", []],
  ["ous", []],
  ["ful", []],
  ["less", ["NA"]]
];

const SYLLABLES = ["n'gh", "cth", "ulh", "fht", "mgl", "kh", "sh", "vra", "ll", "rha", "ghu", "th", "zhr", "agl", "nyth", "kha", "orr", "eeh", "wg", "phl", "ygn", "dgh", "suhn", "nil"];

const words = (await readFile(WORDLIST_PATH, "utf8"))
  .split(/\r?\n/)
  .map((word) => word.trim().toLowerCase())
  .filter((word) => /^[a-z]+$/.test(word));
for (const supplemental of ["superconductivity", "conductivity", "semiconductor", "cryptography", "neuroscience", "thermodynamics"]) {
  if (!words.includes(supplemental)) words.push(supplemental);
}
const commonWords = new Set(words);
const rootGlosses = JSON.parse(await readFile(ROOTS_PATH, "utf8"));
const keywordToRoots = buildKeywordIndex(rootGlosses);

const entries = {};
const report = [];

for (const word of words) {
  const base = normalizeBase(word, commonWords);
  if (!base || STOP_WORDS.has(base)) continue;
  if (entries[base]) continue;
  const generated = generateEntry(base, commonWords, keywordToRoots, rootGlosses);
  entries[base] = generated.entry;
  report.push(generated.report);
}

await writeFile(OUT_JS_PATH, renderModule(entries), "utf8");
await writeFile(OUT_REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(`generated ${Object.keys(entries).length} entries`);

function generateEntry(base, commonWords, keywordToRoots, rootGlosses) {
  const evidence = [];
  const roots = [];

  addRoots(roots, directKeywordRoots(base, keywordToRoots), evidence, `direct:${base}`);
  const split = splitCompound(base, commonWords);
  if (split) {
    for (const part of split) {
      addRoots(roots, directKeywordRoots(part, keywordToRoots), evidence, `split:${part}`);
      addRoots(roots, morphemeRoots(part), evidence, `split-morpheme:${part}`);
    }
  }
  addRoots(roots, morphemeRoots(base), evidence, `morpheme:${base}`);
  if (roots.length > 0) addRoots(roots, suffixRoots(base), evidence, `suffix:${base}`);
  addRoots(roots, fuzzyKeywordRoots(base, keywordToRoots), evidence, `fuzzy:${base}`);

  const selectedRoots = normalizeRootSequence(roots);
  const rc = selectedRoots.length >= 2 ? rootsToSurface(selectedRoots, rootGlosses) : coinedSurface(base);
  const strategy = selectedRoots.length >= 2 ? "offline_semantic_compound" : "frequency_seed_coined";
  const entryRoots = selectedRoots.length >= 2 ? selectedRoots : [];
  return {
    entry: {
      rc,
      gloss: `${strategy} from ${base}`,
      source_base: base,
      strategy,
      roots: entryRoots
    },
    report: { source_base: base, rc, strategy, roots: entryRoots, evidence }
  };
}

function buildKeywordIndex(rootGlosses) {
  const index = new Map();
  for (const [root, spec] of Object.entries(rootGlosses)) {
    for (const keyword of spec.keywords) {
      const normalized = keyword.toLowerCase();
      if (!index.has(normalized)) index.set(normalized, []);
      index.get(normalized).push(root);
    }
  }
  return index;
}

function directKeywordRoots(word, keywordToRoots) {
  return keywordToRoots.get(word) || [];
}

function morphemeRoots(word) {
  const roots = [];
  for (const [morpheme, mapped] of MORPHEMES) {
    if (word.includes(morpheme)) roots.push(...mapped);
  }
  return roots;
}

function suffixRoots(word) {
  const roots = [];
  for (const [suffix, mapped] of DERIVATIONAL_SUFFIXES) {
    if (word.length > suffix.length + 3 && word.endsWith(suffix)) roots.push(...mapped);
  }
  return roots;
}

function fuzzyKeywordRoots(word, keywordToRoots) {
  const roots = [];
  for (const [keyword, mapped] of keywordToRoots.entries()) {
    if (keyword.length < 4) continue;
    if (word.includes(keyword) || keyword.includes(word)) roots.push(...mapped);
  }
  return roots;
}

function addRoots(target, roots, evidence, label) {
  if (!roots.length) return;
  target.push(...roots);
  evidence.push({ label, roots });
}

function normalizeRootSequence(roots) {
  const counts = new Map();
  for (const root of roots) counts.set(root, (counts.get(root) || 0) + 1);
  const ordered = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([root]) => root)
    .filter((root) => root !== "NA");
  if (counts.has("NA")) ordered.push("NA");
  return ordered.slice(0, 4);
}

function rootsToSurface(roots, rootGlosses) {
  return roots.map((root) => rootGlosses[root].surface).join("-");
}

function splitCompound(word, commonWords) {
  let best = null;
  for (let index = 3; index <= word.length - 3; index += 1) {
    const left = word.slice(0, index);
    const right = word.slice(index);
    if (commonWords.has(left) && commonWords.has(right)) {
      if (!best || Math.min(left.length, right.length) > Math.min(best[0].length, best[1].length)) {
        best = [left, right];
      }
    }
  }
  return best;
}

function normalizeBase(term, commonWords) {
  let value = String(term || "").toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
  if (!value || value.includes(" ")) return null;
  if (IRREGULAR_BASES.has(value)) return IRREGULAR_BASES.get(value);
  const candidates = [value];
  if (value.length > 5 && value.endsWith("ies")) candidates.unshift(`${value.slice(0, -3)}y`);
  else if (value.length > 5 && value.endsWith("ing")) candidates.unshift(trimDoubleFinal(value.slice(0, -3)));
  else if (value.length > 4 && value.endsWith("ied")) candidates.unshift(`${value.slice(0, -3)}y`);
  else if (value.length > 4 && value.endsWith("ed")) candidates.unshift(trimDoubleFinal(value.slice(0, -2)));
  else if (value.length > 4 && value.endsWith("ces")) candidates.unshift(value.slice(0, -1));
  else if (value.length > 4 && value.endsWith("ses")) candidates.unshift(value.slice(0, -2));
  else if (value.length > 4 && value.endsWith("es")) candidates.unshift(value.slice(0, -2));
  else if (value.length > 3 && value.endsWith("s")) candidates.unshift(value.slice(0, -1));
  for (const candidate of candidates) {
    if (commonWords.has(candidate)) return candidate;
  }
  return value;
}

function trimDoubleFinal(value) {
  if (value.length >= 2 && value.at(-1) === value.at(-2)) return value.slice(0, -1);
  return value;
}

function coinedSurface(base) {
  const hash = fnv1a(`RC-1.0:${base}`);
  const a = hash % SYLLABLES.length;
  const b = Math.floor(hash / SYLLABLES.length) % SYLLABLES.length;
  const c = Math.floor(hash / (SYLLABLES.length * SYLLABLES.length)) % SYLLABLES.length;
  return `${SYLLABLES[a]}${SYLLABLES[b]}${SYLLABLES[c]}`;
}

function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function renderModule(entries) {
  return `// Generated by scripts/generate-common-lexicon.mjs.\n// Source word list: data/wordlists/google-5000-no-swears.txt\n// Review report: data/generated/common-generated-report.json\n\nconst GENERATED_COMMON_TERMS = ${JSON.stringify(entries, null, 2)};\n\nconst IRREGULAR_BASES = new Map(${JSON.stringify([...IRREGULAR_BASES.entries()], null, 2)});\n\nexport function commonGeneratedTermFor(term) {\n  const base = normalizeCommonBase(term);\n  if (!base) return null;\n  return GENERATED_COMMON_TERMS[base] || null;\n}\n\nexport function normalizeCommonBase(term) {\n  let value = String(term || \"\").toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, \"\");\n  if (!value || value.includes(\" \")) return null;\n  if (IRREGULAR_BASES.has(value)) return IRREGULAR_BASES.get(value);\n  const candidates = [value];\n  if (value.length > 5 && value.endsWith(\"ies\")) candidates.unshift(\`\${value.slice(0, -3)}y\`);\n  else if (value.length > 5 && value.endsWith(\"ing\")) candidates.unshift(trimDoubleFinal(value.slice(0, -3)));\n  else if (value.length > 4 && value.endsWith(\"ied\")) candidates.unshift(\`\${value.slice(0, -3)}y\`);\n  else if (value.length > 4 && value.endsWith(\"ed\")) candidates.unshift(trimDoubleFinal(value.slice(0, -2)));\n  else if (value.length > 4 && value.endsWith(\"ces\")) candidates.unshift(value.slice(0, -1));\n  else if (value.length > 4 && value.endsWith(\"ses\")) candidates.unshift(value.slice(0, -2));\n  else if (value.length > 4 && value.endsWith(\"es\")) candidates.unshift(value.slice(0, -2));\n  else if (value.length > 3 && value.endsWith(\"s\")) candidates.unshift(value.slice(0, -1));\n  for (const candidate of candidates) {\n    if (GENERATED_COMMON_TERMS[candidate]) return candidate;\n  }\n  return value;\n}\n\nfunction trimDoubleFinal(value) {\n  if (value.length >= 2 && value.at(-1) === value.at(-2)) return value.slice(0, -1);\n  return value;\n}\n`;
}
