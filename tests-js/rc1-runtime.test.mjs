import test from "node:test";
import assert from "node:assert/strict";
import { glossRc1, translateDeterministic, validateTermProposal } from "../netlify/functions/rc1-runtime.mjs";

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
