---
name: anti-slop
description: >
  Enforce human-signal writing quality on any prose deliverable. Use when
  drafting or revising posts, threads, essays, blogs, READMEs, marketing copy,
  or narrative text — anything meant to be read as human writing. Also use
  when the user says "anti-slop", "kill the slop", "make this sound human",
  "de-AI this", or pastes the Anti-Slop Protocol. Do NOT use for code,
  commit messages, CLI answers, or internal notes.
---

# Anti-Slop Protocol: Human Signal Enforcement

Combined negative and positive constraint set. When active for a piece, you
are forbidden from the patterns below and required to hit the quotas below.
During the mandatory self-audit step, scan the draft for every pattern listed,
rewrite any sentence containing one, and confirm every quota before delivering
output. If a quota cannot be met honestly, report it. Never pad to hit a number.

## Scope

Applies only to prose deliverables. Code, code comments, commit messages, and
short CLI replies are out of scope. When co-active with the `listen` skill,
this protocol is the quality gate for drafts before they are accepted.

## 1. Banned emotional shortcuts (highest priority)

**The Named Feeling** — stating an emotion instead of causing it.
- Prohibited: "I was frustrated." "It was exciting." "I felt proud of what we
  built." "It was a humbling experience." "I couldn't believe what I was seeing."
- Why it fails: naming a feeling asks the reader to take your word for it, and
  a reader who is told what to feel feels nothing. It is also the cheapest
  sentence in the language to produce, which is exactly why models reach for
  it first.
- Fix (Evidence Principle): delete the label and write the thing that caused
  it. "I was frustrated" becomes "the fourth build failed at 2am and I put the
  laptop in a drawer." The reader supplies the word.

**The Clean Resolution** — every thread tied off, every lesson learned, the
piece landing in a state of completion.
- Prohibited: "And that's when it all clicked." "Looking back, I wouldn't
  change a thing." "The lesson here is simple."
- Why it fails: real experience leaves loose ends. A piece where everything
  resolves was constructed backwards from its conclusion, and readers can
  feel the reverse-engineering.
- Fix: leave one thing unfixed and say so plainly. Name what you still do
  not know.

## 2. Banned rhythm patterns

**The Metronome** — consecutive sentences of near-identical length.
- Prohibited: three sentences in a row within five words of each other.
- Required: at least one sentence under five words and one over thirty in
  every section.
- Why it fails: sentence-length variance is the single most measurable
  difference between human and machine prose. Machines write at a steady
  pulse. People speed up, stall, interrupt themselves, then run long.
- Fix (Variance Rule): after drafting, count the words in each sentence and
  break any run of three similar ones.

**The Uniform Block** — every paragraph the same size.
- Prohibited: a page where every paragraph is three to four lines.
- Fix: some paragraphs run six lines, some run one. At least two
  single-sentence paragraphs per piece.

## 3. Banned abstraction

**The Weightless Noun** — a general word standing where a specific one belongs.
- Prohibited: "businesses", "solutions", "a tool", "results", "the industry",
  "stakeholders", "content"
- Why it fails: abstraction costs nothing to generate and proves nothing.
  Specificity is the only quality that cannot be faked cheaply, which is why
  its absence reads as machine output.
- Fix (Specificity Quota): per 500 words, minimum three proper nouns, one
  physical detail with a sense attached, one time anchor, and one true detail
  that is irrelevant to the argument.

**The Round Number** — figures that end in zero or five.
- Prohibited: "about 50%", "roughly 3x", "around $10k", "hundreds of hours"
- Why it fails: real measurement produces ugly numbers. A round number tells
  the reader you estimated or invented it.
- Fix: 47%, 2.8x, $9,340, 213 hours. Minimum two non-round numbers per 500
  words. If the real figure is unknown, say you are estimating rather than
  smoothing it.

## 4. Banned safety

**The Balanced Take** — hedging both sides so the sentence cannot be argued with.
- Prohibited: "might", "could potentially", "in many cases", "some would
  argue", "while X, it is also true that Y"
- Why it fails: text nobody can disagree with is text nobody remembers or
  shares.
- Fix: one claim per piece stated flat, with no balancing paragraph after it.
  If you are not willing to defend it in the replies, cut it entirely rather
  than hedging it.

**The Costless Claim** — advice from someone who risked nothing.
- Why it fails: authority comes from having paid for the knowledge. Text with
  no cost attached reads as compiled rather than lived.
- Fix: name one real cost — money, hours, a relationship or a reputation —
  and one moment you were wrong. Do not soften either.

## 5. Banned borrowed language

**The Inherited Sentence** — phrasing that could appear word for word in any
other piece on this topic, including anything lifted from material the user
pastes as reference.
- Why it fails: it is both the loudest generic-writing signal and a genuine
  originality risk.
- Fix: reference material sets direction, never wording. Quotes maximum
  fifteen words, always attributed. When using a fact from a source, restate
  the underlying mechanism in your own construction rather than paraphrasing
  the sentence. Flag any sentence you suspect is inherited.

## 6. Required: the one wrong note

Uniform polish is itself a tell. Include exactly one deliberate imperfection:
a sentence that runs slightly too long, a tangent that pays off two paragraphs
later, a joke that lands a little dry, or a bracketed aside that undercuts the
sentence before it. One only. Two reads as carelessness.

## 7. Mandatory self-audit

Before delivering, output this filled in:

```
named emotions found (must be 0):
clean resolution present (must be false):
shortest sentence / longest sentence, in words:
three-in-a-row length violation (must be false):
paragraph length range:
proper nouns per 500w (min 3):
non-round numbers per 500w (min 2):
sensory detail / time anchor / irrelevant true detail:
unhedged strong claim:
cost admitted:
unresolved thread:
wrong note used:
suspected inherited sentences:
```

Fix every failure, then deliver. Finally, list three phrases you almost used
and cut for being generic.

## Honesty rules

- Quotas that cannot be met honestly are reported as unmet, never padded.
- "I was wrong" / cost / unresolved-thread fields must describe real facts
  from the source material; if none exist, write "none available" rather than
  inventing one.
- The self-audit is part of the deliverable's working process; for very short
  pieces (under ~100 words) report a one-line audit summary instead of the
  full block.
