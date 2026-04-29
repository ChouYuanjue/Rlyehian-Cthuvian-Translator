import assert from "node:assert/strict";
import test from "node:test";

import handler from "../netlify/functions/translate.mjs";

test("LLM-assisted EN to RC coins ordinary unknowns but leaves acronyms sealed", async () => {
  const previous = {
    LLM_ENABLED: process.env.LLM_ENABLED,
    PUBLIC_LLM_ENABLED: process.env.PUBLIC_LLM_ENABLED,
    LLM_DAILY_LIMIT_PER_IP: process.env.LLM_DAILY_LIMIT_PER_IP,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_ALLOW_COINED_TERMS: process.env.LLM_ALLOW_COINED_TERMS
  };
  process.env.LLM_ENABLED = "true";
  process.env.PUBLIC_LLM_ENABLED = "true";
  process.env.LLM_DAILY_LIMIT_PER_IP = "0";
  process.env.LLM_API_KEY = "";
  process.env.LLM_MODEL = "";
  process.env.LLM_ALLOW_COINED_TERMS = "true";

  try {
    const response = await handler(new Request("https://local/.netlify/functions/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "I used blorptastic quendle CS.", direction: "en-to-rc", useLlm: true })
    }));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.llm.used, true);
    assert.deepEqual(payload.llm.accepted_terms.map((term) => term.source), ["blorptastic", "quendle"]);
    assert.doesNotMatch(payload.low, /zha'bhu-lla-u-rha/);
    assert.match(payload.low, /zha'/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("reverse LLM provider failure still returns deterministic gloss JSON", async () => {
  const previous = {
    LLM_ENABLED: process.env.LLM_ENABLED,
    PUBLIC_LLM_ENABLED: process.env.PUBLIC_LLM_ENABLED,
    LLM_DAILY_LIMIT_PER_IP: process.env.LLM_DAILY_LIMIT_PER_IP,
    LLM_API_BASE_URL: process.env.LLM_API_BASE_URL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_MODEL: process.env.LLM_MODEL
  };
  process.env.LLM_ENABLED = "true";
  process.env.PUBLIC_LLM_ENABLED = "true";
  process.env.LLM_DAILY_LIMIT_PER_IP = "0";
  process.env.LLM_API_BASE_URL = "https://example.invalid/v1";
  process.env.LLM_API_KEY = "test";
  process.env.LLM_MODEL = "test";

  try {
    const response = await handler(new Request("https://local/.netlify/functions/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "ph'nglui Cthulhu", direction: "rc-to-en", useLlm: true })
    }));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.match(payload.low, /dead/);
    assert.equal(payload.llm.used, false);
    assert.equal(payload.llm.reason, "reverse_llm_failed");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
