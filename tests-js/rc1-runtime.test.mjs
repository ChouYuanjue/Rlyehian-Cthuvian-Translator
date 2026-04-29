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

test("paragraph translation splits on appositive commas", () => {
  const result = translateDeterministic("I am Runnel Zhang, an undergraduate at Nanjing University.");
  assert.ok(result.analysis.segments.length >= 2);
  assert.match(result.low, /rhun'el|Runnel/);
});

test("reverse gloss preserves unknown and proper names", () => {
  const result = glossRc1("ph'nglui Cthulhu Xyzz");
  assert.match(result.low, /Cthulhu/);
  assert.match(result.low, /Xyzz/);
  assert.match(result.high, /Cthulhu \(preserved\)/);
  assert.match(result.high, /Xyzz \(preserved\)/);
});
