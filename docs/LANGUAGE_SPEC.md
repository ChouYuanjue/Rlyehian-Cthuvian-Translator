# RC-1 Language Specification

RC-1 is a standardized R'lyehian/Cthuvian translation layer. It is not presented as Lovecraft's hidden grammar. It is a rigorous conlang system built from the available Cthuvian/R'lyehian material, with extra rules added so English can be translated consistently.

The two source references used as seed material are:

- <https://conlang.fandom.com/wiki/Cthuvian>
- <https://www.cthulhuclub.com/articles/learn-cthuvian/>

Those materials motivate several constraints: unstable word classes, very dense consonant clusters, `h` as a consonant modifier, present versus non-present tense, prefix-like prepositions, pluralization by final repetition, free word order, and the idea that written R'lyehian is only a rough human approximation.

## Design Goals

RC-1 has two registers.

**Low register** is machine-readable. It uses explicit role suffixes, predictable tense/aspect markers, and deterministic compounding.

**High register** is ritual and literary. It may omit role markers, compress morphology, and preserve the ambiguity of known mythos phrases.

English to RC-1 should be stable. RC-1 to English should be glossable, but not always unique.

## Phonology And Orthography

Consonants:

```text
p b t d k g c m n ng f v s sh th h r l y w
```

Common clusters:

```text
cth kth fht mgl mglw ngl thfl n'gh shg ll rr gh kh
```

Vowels:

```text
a e i u ä '
```

The apostrophe marks a glottal break, reduced non-human vowel, or morpheme boundary.

`h` after a consonant modifies that consonant instead of acting as a normal English `h`. Thus `ph`, `th`, and `fh` should be treated as Cthuvian clusters, not as English spelling values.

## Word Template

The broad low-register template is:

```text
[relation prefix] [polarity/TAM prefix] [possessive prefix] ROOT [derivation] [number/intensity] [role suffix]
```

Examples:

```text
ph-nglui  -> ph'nglui   beyond/across + gate/threshold
nafl-athg -> nafl'athg  non-present + write/sign
c-fhayak  -> cf'ayak    our/we + ritually offer
```

## Pronouns

| RC-1 | English |
| --- | --- |
| `Ya` | I, me |
| `Tha` | you |
| `Hya` | he, she, it |
| `Cya` | we, us |
| `Fya` | they, them |
| `Gha` | this entity |
| `Ngha` | that entity |
| `Sya` | someone, something |

## Role Suffixes

Low register uses role suffixes to preserve English argument structure.

| Suffix | Role |
| --- | --- |
| `-yr` | agent, experiencer, subject |
| `-ef` | patient, theme, object |
| `-ug` | recipient, goal, to, for |
| `-agl` | location, at, in, on |
| `-hup` | source, from, of |
| `-vra` | accompaniment, with, among |
| `-li` | instrument, cause, price |
| `-ep` | result, into |

Example:

```text
Ya-yr na kadishtu nilgh'ri-ef.
I-SUBJ not know all-things-OBJ.
```

High register may compress this to:

```text
Ya na kadishtu nilgh'ri.
```

## Tense, Aspect, Polarity, Mood

| Marker | Function |
| --- | --- |
| zero | present, timeless, mythic truth |
| `hai` | explicit now |
| `nafl'` | non-present, past, future-irrealis, non-real |
| `mg-` | still, nevertheless, continuative |
| `ilyaa-` | future, expected, awaited |
| `ng-` | then, and then |
| `na` | not, no, non- |
| `syha'h` | eternal, always |
| `ep` | result, thereafter |

`nafl'` is deliberately broader than English past tense. It means outside the immediate present. Context decides whether that is past, future, irrealis, or mythic non-present.

## Word Class Fluidity

Roots are not locked to English parts of speech.

`kadishtu` can mean know, understand, knowledge, understanding, or wise.

`fhtagn` can mean wait, dream, sleep in expectation, lie dormant, or be in wakeful stasis.

The translator's IR supplies English-like roles only for translation stability. RC-1 itself treats roots as semantic bundles.

## Core Roots

| Root | Semantic Bundle |
| --- | --- |
| `ia / iä` | sacred exclamation, ritual praise |
| `ai` | say, call, link, equate |
| `ah` | do, act, perform |
| `athg` | sign, write, inscribe, mark |
| `bug` | go, travel, depart |
| `bthnk` | body |
| `ctenff` | society, brotherhood, group |
| `eeh` | answer, response, knowable content |
| `fhayak` | offer, set before |
| `fhtagn` | wait, dream, lie dormant |
| `ftaghu` | skin, surface, interface |
| `gof'nn` | offspring, children |
| `kadishtu` | know, understand, knowledge |
| `nglui` | gate, threshold |
| `nilgh'ri` | all, totality, everything |
| `orr'e` | soul, soul-substance |
| `ph-` | beyond, across, outside |
| `r'luh` | hidden, secret |
| `s'uhn` | pact, contract |
| `shagg` | dream-domain |
| `shogg` | abyss, deep substrate |
| `shugg` | earth, soil |
| `throd` | tremble, wail, shudder |
| `uln` | summon, call to a place |
| `vulgtm` | prayer |
| `wgah'n` | dwell, be located |
| `wk'hmr` | transform, attach form |
| `yll` | light, see, reveal |

## Productive Extensions

RC-1 adds roots for ordinary translation:

| Root | Meaning |
| --- | --- |
| `kthar` | stone, solid matter |
| `ulh` | water, liquid |
| `cthugh` | fire, heat, energy |
| `hral` | air, wind, breath |
| `mnahn` | memory, history, record |
| `zhrn` | number, measurement, order |
| `rhan` | time, cycle |
| `ghrath` | large, broad, many |
| `vren` | small, little, few |
| `fmagl` | tool, device, machine |

## Compounding

The default compound order is modifier before head.

```text
r'luh-eeh              secret knowledge
eeh-ftaghu             book, knowledge-skin
phlegeth-lloig'agl     computer, information-mind-place
vren-yll-fmagl         microscope, small-seeing-tool
zhrn-kadishtu-nyth     scientist, measurement-knowledge-practitioner
```

Modern terms should be semantic compounds whenever possible. Direct English leakage is forbidden.

## Plurality

RC-1 supports source-inspired final repetition:

```text
vulgtm  -> vulgtmm
prayer     prayers
```

Living groups and descendants often take `-nn`, as in `gof'nn`.

## Proper Names And Sealed Text

Known mythos names are preserved:

```text
Cthulhu
R'lyeh
Yog-Sothoth
Shub-Niggurath
Hastur
```

Unknown or unsafe strings use sealed encoding:

```text
zha'... 'zhro
```

This is a reversible UTF-8 base32 syllable encoding. It is not elegant Cthuvian; it is a completeness guarantee.

## Compatibility Notes

The sentence:

```text
ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn
```

is valid RC-1 high register.

Low-register expansion:

```text
Ph'nglui mg-lw'nafh Cthulhu-yr fhtagn R'lyeh wgah'nagl-agl.
```

Gloss:

```text
Beyond the threshold and still living/active, Cthulhu waits or dreams in the dwelling-place of R'lyeh.
```

The point is not to collapse `ph'nglui` to only "dead." It carries threshold, death, non-human state, and outside-life meanings at once.

