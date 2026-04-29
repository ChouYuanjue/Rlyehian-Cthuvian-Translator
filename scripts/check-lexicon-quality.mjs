import { readFile } from "node:fs/promises";

import {
  buildReverseGlossIndex,
  generatedCommonTermFor,
  glossRc1,
  translateDeterministic
} from "../netlify/functions/rc1-runtime.mjs";

const words = (await readFile("data/wordlists/google-5000-no-swears.txt", "utf8"))
  .split(/\r?\n/)
  .map((word) => word.trim().toLowerCase())
  .filter((word) => /^[a-z]+$/.test(word));

const reverse = buildReverseGlossIndex();
const sampleWords = [
  "software",
  "telephone",
  "biology",
  "photography",
  "airport",
  "services",
  "weather",
  "keyboard",
  "lawyer",
  "superconductivity"
];

let generated = 0;
let semantic = 0;
let coined = 0;
let reverseKnown = 0;

for (const word of words) {
  const term = generatedCommonTermFor(word);
  if (!term) continue;
  generated += 1;
  if (term.strategy === "offline_semantic_compound") semantic += 1;
  if (term.strategy === "frequency_seed_coined") coined += 1;
  if (reverse[term.rc]) reverseKnown += 1;
}

const forwardSamples = sampleWords.map((word) => {
  const source = word === "biology" ? "I studied biology." : `I used ${articleFor(word)} ${word}.`;
  const result = translateDeterministic(source);
  return {
    source,
    low: result.low,
    sealed: result.low.includes("zha'"),
    reverse: glossRc1(result.low).low
  };
});

const sealedSamples = words
  .slice(0, 500)
  .map((word) => ({ word, low: translateDeterministic(`I used ${articleFor(word)} ${word}.`).low }))
  .filter((item) => item.low.includes("zha'"))
  .slice(0, 20);

const summary = {
  wordlist_size: words.length,
  generated_entries_seen_from_wordlist: generated,
  semantic_compounds: semantic,
  coined_terms: coined,
  reverse_known_entries: reverseKnown,
  reverse_known_rate: generated ? Number((reverseKnown / generated).toFixed(4)) : 0,
  forward_samples: forwardSamples,
  sealed_samples_first_500: sealedSamples
};

console.log(JSON.stringify(summary, null, 2));

function articleFor(word) {
  return /^[aeiou]/.test(word) ? "an" : "a";
}
