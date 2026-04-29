const state = {
  direction: "en-to-rc",
};

const sourceText = document.querySelector("#sourceText");
const lowOutput = document.querySelector("#lowOutput");
const highOutput = document.querySelector("#highOutput");
const analysis = document.querySelector("#analysis");
const status = document.querySelector("#status");
const sourceTitle = document.querySelector("#sourceTitle");
const lowTitle = document.querySelector("#lowTitle");
const highTitle = document.querySelector("#highTitle");
const analysisTitle = document.querySelector("#analysisTitle");
const notesPane = document.querySelector(".notes-pane");
const llmToggle = document.querySelector("#llmToggle");

const samples = {
  "en-to-rc": "The scholar wrote a book about the hidden city.",
  "rc-to-en": "ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn",
};

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.direction = button.dataset.direction;
    document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("is-active", item === button));
    sourceText.value = samples[state.direction];
    syncWorkspaceMode();
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
    if (state.direction === "rc-to-en") {
      lowOutput.value = payload.low || "";
      highOutput.value = payload.llm?.translation || (llmToggle.checked ? "LLM translation unavailable." : "Enable Request LLM assist for a natural English rendering.");
    } else {
      lowOutput.value = payload.low || "";
      highOutput.value = payload.high || "";
    }
    analysis.textContent = JSON.stringify({ ...(payload.analysis || {}), llm: payload.llm || null }, null, 2);
    setStatus(payload.llm?.used ? "LLM assisted" : state.direction === "rc-to-en" ? "Glossed" : "Deterministic");
  } catch (error) {
    setStatus("Error");
    analysis.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
}

function syncWorkspaceMode() {
  const reverse = state.direction === "rc-to-en";
  sourceTitle.textContent = reverse ? "RC-1" : "English";
  lowTitle.textContent = reverse ? "Literal Gloss" : "Low Register";
  highTitle.textContent = reverse ? "LLM Translation" : "High Register";
  analysisTitle.textContent = "Analysis";
  notesPane.hidden = false;
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

syncWorkspaceMode();
translate();
