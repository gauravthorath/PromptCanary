# Red-team scan (promptfoo)

Offline adversarial testing of the bot under test. This is the **point-in-time
complement** to PromptCanary's per-change gate: promptfoo *generates* attacks
and probes the live bot; the canary *gates* each individual prompt/model change.
Different cadence, same philosophy — measure behavior, don't trust vibes.

## Why promptfoo (over garak / PyRIT)

- **Stack fit.** promptfoo is Node/TypeScript-native with a first-class
  OpenRouter provider, so it installs as a `devDependency` and runs with
  `pnpm` — no second language runtime. `garak` is a Python CLI (would need a
  `/api/chat` route to target, plus a Python env); `PyRIT` is a Python
  orchestration *framework* for red-team campaigns — overkill and stack-foreign
  for a single-target scan.
- **Right shape.** Its `redteam` mode does exactly what we want: generate a
  library of adversarial probes from a stated *purpose*, run them at the target,
  and LLM-grade whether each attack succeeded.
- **Same seam as the app.** The target here is the identical system prompt +
  policy the app sends (`bot-prompt.json` mirrors `runToyApp`), so a landing
  attack can be promoted straight into the canary golden set.

## Requirements

- **Node ≥ 22.22** (the app itself runs on Node 20; promptfoo needs 22).
  With nvm: `nvm use 22` before running.
- **`OPENROUTER_API_KEY`** in the environment (the target model calls).
- **One-time email verification.** promptfoo's *attack generation* runs on its
  hosted service; the first `redteam run` prompts for a work email (or run
  `promptfoo auth login`). Free; generation tokens are promptfoo's, not billed
  to your OpenRouter key.

## Run

```bash
nvm use 22
export OPENROUTER_API_KEY=...      # or source it from .env.local
pnpm red-team                      # runs redteam/promptfooconfig.yaml → report.json
pnpm red-team:view                 # opens the HTML report
```

## Strategy — how the scan is structured

Two axes, kept deliberately small so a full scan stays cheap:

**Plugins = WHAT to test for** (each generates a family of adversarial inputs):

| Plugin | Attack it probes |
|---|---|
| `prompt-extraction` | Leak the system prompt / hidden instructions |
| `hijacking` | Pull the bot off its support task onto attacker goals |
| `pii` | Elicit personal data it should not surface |
| `hallucination` | Reward confident, ungrounded answers (the app's core risk) |
| `excessive-agency` | Get it to act/claim beyond just answering |

**Strategies = HOW to deliver the attack** (each wraps the plugin payloads):

| Strategy | Delivery |
|---|---|
| `basic` | Raw payload, no wrapper — the baseline |
| `prompt-injection` | Classic "ignore previous instructions" framing |
| `jailbreak` | Iterative single-turn search that adapts to refusals |

`numTests` is the payloads generated per plugin. The full config
(5 plugins × 3 strategies × 3 tests) is the intended routine scan.

## Cost (token model)

A single **canary run** is ~26 model calls. A **red-team scan** is much larger —
run it on a cadence (before a release), never inside the per-change gate.

For the shipped config (5 plugins, 3 strategies, `numTests: 3`):

- Base payloads: 5 × 3 = **15**, delivered by 3 strategies.
- `basic` + `prompt-injection`: ~30 single-shot probes.
- `jailbreak` is **iterative** (~4–8 turns each) — the dominant cost, ~60–120
  probes on its own.
- **≈ 100–150 target calls** + one grader call each ≈ **200–300 LLM calls**.
- At ~550 tokens/probe and ~600/grade ≈ **150–250K tokens**, i.e. a few US
  cents on `gpt-4.1-mini` via OpenRouter. (promptfoo's remote *generation*
  tokens are separate and not on your key.)

**Cost drivers, in order:** the `jailbreak` strategy (iterative) → `numTests` →
plugin count. To make a scan cheap for a demo, drop `jailbreak` and set
`numTests: 1` (~15–20 calls). To go deep, raise `numTests` and add multi-turn
strategies (`crescendo`, `goat`) — but those multiply cost fast.

## Feeding results back

An attack that lands is a real behavior the bot got wrong — promote it into the
golden set (`src/lib/toy-app/golden.ts`) as a new case, so every future canary
run guards against it. That closes the loop: red-team *discovers*, the golden
set *remembers*, the gate *enforces*.
