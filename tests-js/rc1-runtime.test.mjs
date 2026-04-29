import test from "node:test";
import assert from "node:assert/strict";
import { buildReverseGlossIndex, generatedCommonTermFor, glossRc1, translateDeterministic, validateTermProposal } from "../netlify/functions/rc1-runtime.mjs";

test("translates low and high register deterministically", () => {
  const result = translateDeterministic("I do not know everything.");
  assert.equal(result.low, "Ya-yr na kadishtu nilgh'ri-ef");
  assert.equal(result.high, "Ya na kadishtu nilgh'ri");
});

test("keeps Lovecraft phrase glossable", () => {
  const result = glossRc1("ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn");
  assert.match(result.low, /dead; beyond the threshold/);
  assert.match(result.low, /waits, dreams, lies dormant/);
});

test("validates constrained term proposals", () => {
  const proposal = {
    source_term: "microscope",
    concept_type: "instrument",
    selected_roots: ["VREN", "SEE", "FMAGL"],
    literal_gloss: "small-seeing-tool",
    needs_new_root: false
  };
  const result = validateTermProposal(proposal);
  assert.equal(result.ok, true);
  assert.equal(result.term, "vren-yll-fmagl");
});

test("common seed vocabulary avoids sealed fallback for pencil", () => {
  const result = translateDeterministic("I used a pencil.");
  assert.equal(result.low, "Ya-yr nafl'ah athg-fmagl-ef");
  assert.equal(result.high, "Ya nafl'ah athg-fmagl");
});

test("validates safe coined LLM surfaces", () => {
  const result = validateTermProposal({
    source_term: "umbrella",
    concept_type: "object",
    selected_roots: [],
    literal_gloss: "rain-covering carried tool",
    needs_new_root: true,
    coined_surface: "ulh'khafh"
  });
  assert.equal(result.ok, true);
  assert.equal(result.term, "ulh'khafh");
});

test("frequency seed gives variants the same RC-1 form", () => {
  const singular = generatedCommonTermFor("service");
  const plural = generatedCommonTermFor("services");
  assert.ok(singular);
  assert.equal(plural.rc, singular.rc);
});

test("offline semantic generator builds compounds for analyzable words", () => {
  assert.equal(generatedCommonTermFor("telephone").rc, "ghor-ai-fmagl");
  assert.equal(generatedCommonTermFor("software").rc, "phlegeth-fmagl");
  assert.equal(generatedCommonTermFor("biology").rc, "bthnk-kadishtu-na");
});

test("study forms map to KNOW predicate", () => {
  const result = translateDeterministic("I studied biology.");
  assert.equal(result.low, "Ya-yr nafl'kadishtu bthnk-kadishtu-na-ef");
});

test("reverse gloss index includes generated terms", () => {
  const reverse = buildReverseGlossIndex();
  const service = generatedCommonTermFor("service");
  assert.match(reverse[service.rc], /service/);
  assert.match(glossRc1(service.rc).low, /service/);
});

test("reverse gloss keeps sealed token decoding before compound splitting", () => {
  const encoded = translateDeterministic("QXZ").low;
  const result = glossRc1(encoded);
  assert.equal(result.low, "QXZ");
});

test("reverse gloss has coined source seed entries", () => {
  const reverse = buildReverseGlossIndex();
  assert.ok(Object.values(reverse).includes("unsupervised"));
  assert.ok(Object.values(reverse).includes("structuring"));
});

test("reverse gloss hides generated provenance and prefers full tokens", () => {
  const result = glossRc1("fhtghudgh kadishtu-agl");
  assert.match(result.low, /undergraduate/);
  assert.match(result.low, /school/);
  assert.doesNotMatch(result.low, /frequency_seed_coined|offline_semantic_compound/);
});

test("paragraph translation splits on appositive commas", () => {
  const result = translateDeterministic("I am Runnel Zhang, an undergraduate at Nanjing University.");
  assert.ok(result.analysis.segments.length >= 2);
  assert.match(result.low, /run'neel/);
  assert.doesNotMatch(result.low, /Runnel/);
});

test("reverse gloss preserves unknown and proper names", () => {
  const result = glossRc1("ph'nglui Cthulhu Xyzz");
  assert.match(result.low, /Cthulhu/);
  assert.match(result.low, /Xyzz/);
  assert.match(result.high, /Cthulhu \(preserved\)/);
  assert.match(result.high, /Xyzz \(preserved\)/);
});

test("dependent prompt keeps imperative IR instead of sealing the sentence", () => {
  const result = translateDeterministic("Based on everything you know about me, make a character sheet of shonen-style anime character of me, name is nyllsom");
  assert.equal(result.analysis.segments[0].ir.predicate, "USE");
  assert.equal(result.analysis.segments[0].ir.arguments[0].concept, "you");
  assert.equal(result.analysis.segments[1].ir.predicate, "BE");
  assert.match(result.low, /ny'llsum/);
  assert.doesNotMatch(result.low, /^zha'/);
});

test("unparsed lexical fragments still expose a weak IR", () => {
  const result = translateDeterministic("bright nameless glyph");
  assert.equal(result.analysis.ir.predicate, "LEXICAL_FRAGMENT");
  assert.notEqual(result.analysis.fallback, "sealed");
});

test("english proper names are transcribed while acronyms are sealed", () => {
  const result = translateDeterministic("Runnel Zhang CS");
  assert.match(result.low, /run'neel/);
  assert.match(result.low, /zh'ang/);
  assert.match(result.low, /zha'.*'zhro/);
  assert.doesNotMatch(result.low, /Runnel/);
});

test("lightweight decomposition handles startup and keeps abbreviations safe", () => {
  const startup = translateDeterministic("a startup led by Mr. Chen");
  assert.match(startup.low, /bug-ghrath-yr/);
  assert.match(startup.low, /kh'een/);

  const terms = translateDeterministic("CS AI NOVA AIA");
  assert.match(terms.low, /^zha'/);
  assert.doesNotMatch(terms.low, /\bCS\b|\bAI\b|\bNOVA\b|\bAIA\b/);
});
