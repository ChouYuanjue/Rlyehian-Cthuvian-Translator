const ROOT_SURFACES = {
  VREN: "vren",
  GHRATH: "ghrath",
  SEE: "yll",
  FMAGL: "fmagl",
  ATHG: "athg",
  KADISHTU: "kadishtu",
  MNAHN: "mnahn",
  ZHRN: "zhrn",
  BTHNK: "bthnk",
  LLOIG: "lloig",
  PHLEGETH: "phlegeth",
  ULH: "ulh",
  CTHUGH: "cthugh",
  HRAL: "hral",
  RHYGG: "rhygg",
  SHUGG: "shugg",
  NGLUI: "nglui",
  BUG: "bug",
  GHOR: "ghor",
  AI: "ai",
  KYARNAK: "k'yarnak",
  RHAN: "rhan",
  RLUH: "r'luh",
  FTAGHU: "ftaghu",
  NYTH: "nyth",
  AGL: "agl",
  NA: "na"
};

const MORPHEMES = [
  ["micro", ["VREN"]],
  ["mini", ["VREN"]],
  ["macro", ["GHRATH"]],
  ["mega", ["GHRATH"]],
  ["super", ["GHRATH"]],
  ["photo", ["SEE", "MNAHN"]],
  ["video", ["SEE", "MNAHN"]],
  ["graph", ["ATHG"]],
  ["scope", ["SEE", "FMAGL"]],
  ["meter", ["ZHRN", "FMAGL"]],
  ["phone", ["GHOR", "AI", "FMAGL"]],
  ["bio", ["BTHNK"]],
  ["geo", ["SHUGG"]],
  ["hydro", ["ULH"]],
  ["aero", ["HRAL"]],
  ["thermo", ["CTHUGH"]],
  ["electro", ["CTHUGH"]],
  ["conduct", ["CTHUGH", "ZHRN"]],
  ["crypto", ["RLUH", "ZHRN"]],
  ["neuro", ["LLOIG", "BTHNK"]],
  ["dynamic", ["CTHUGH", "BUG"]],
  ["logy", ["KADISHTU", "NA"]],
  ["ware", ["FMAGL"]],
  ["web", ["PHLEGETH"]],
  ["net", ["PHLEGETH"]],
  ["book", ["ATHG", "FTAGHU"]],
  ["air", ["HRAL"]],
  ["water", ["ULH"]]
];

const SUFFIXES = [
  ["er", ["NYTH"]],
  ["or", ["NYTH"]],
  ["ist", ["NYTH"]],
  ["ism", ["NA"]],
  ["ity", ["NA"]],
  ["ness", ["NA"]],
  ["tion", ["NA"]],
  ["ment", ["NA"]]
];

export function lightweightDecomposeTerm(term) {
  const value = String(term || "").toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
  if (!value || value.includes(" ")) return null;
  const roots = [];
  const evidence = [];
  for (const [morpheme, mapped] of MORPHEMES) {
    if (value.includes(morpheme)) {
      roots.push(...mapped);
      evidence.push(`morpheme:${morpheme}`);
    }
  }
  if (roots.length) {
    for (const [suffix, mapped] of SUFFIXES) {
      if (value.length > suffix.length + 3 && value.endsWith(suffix)) {
        roots.push(...mapped);
        evidence.push(`suffix:${suffix}`);
      }
    }
  }
  const selected = [...new Set(roots)].filter((root) => root !== "NA");
  if (roots.includes("NA")) selected.push("NA");
  if (selected.length < 2) return null;
  const rc = selected.slice(0, 4).map((root) => ROOT_SURFACES[root]).join("-");
  return {
    rc,
    gloss: `online lightweight decomposition from ${value}`,
    source_base: value,
    strategy: "online_lightweight_decomposition",
    roots: selected.slice(0, 4),
    evidence
  };
}
