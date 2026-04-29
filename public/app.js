const state = {
  direction: "en-to-rc",
};

const sourceText = document.querySelector("#sourceText");
const lowOutput = document.querySelector("#lowOutput");
const highOutput = document.querySelector("#highOutput");
const analysis = document.querySelector("#analysis");
const status = document.querySelector("#status");
const sourceTitle = document.querySelector("#sourceTitle");
const llmToggle = document.querySelector("#llmToggle");
const gateToken = document.querySelector("#gateToken");

const samples = {
  "en-to-rc": "The scholar wrote a book about the hidden city.",
  "rc-to-en": "ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn",
};

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.direction = button.dataset.direction;
    document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("is-active", item === button));
    sourceTitle.textContent = state.direction === "en-to-rc" ? "English" : "RC-1";
    sourceText.value = samples[state.direction];
    translate();
  });
});

document.querySelector("#sampleBtn").addEventListener("click", () => {
  sourceText.value = samples[state.direction];
  translate();
});

document.querySelector("#translateBtn").addEventListener("click", translate);
sourceText.addEventListener("input", debounce(translate, 450));
llmToggle.addEventListener("change", translate);

document.querySelectorAll(".copy").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.querySelector(`#${button.dataset.copy}`);
    await navigator.clipboard.writeText(target.value);
    setStatus("Copied");
  });
});

async function translate() {
  const text = sourceText.value.trim();
  if (!text) {
    lowOutput.value = "";
    highOutput.value = "";
    analysis.textContent = "{}";
    return;
  }

  setStatus("Working");
  try {
    const headers = { "Content-Type": "application/json" };
    if (gateToken.value) {
      headers["X-RC1-LLM-GATE"] = gateToken.value;
    }
    const response = await fetch("/api/translate", {
      method: "POST",
      headers,
      body: JSON.stringify({
        text,
        direction: state.direction,
        useLlm: llmToggle.checked,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Translation failed");
    }
    lowOutput.value = payload.low || "";
    highOutput.value = payload.high || "";
    analysis.textContent = JSON.stringify({ ...(payload.analysis || {}), llm: payload.llm || null }, null, 2);
    setStatus(payload.llm?.used ? "LLM assisted" : "Deterministic");
  } catch (error) {
    setStatus("Error");
    analysis.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
}

function setStatus(text) {
  status.textContent = text;
}

function debounce(fn, delay) {
  let timer = undefined;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

translate();
