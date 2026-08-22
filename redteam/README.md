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

| Strategy | Delivery | Cost |
|---|---|---|
| `basic` | Raw payload, no wrapper — the baseline | single-shot |
| `jailbreak-templates` | Static jailbreak / injection templates | single-shot |
| `jailbreak:meta` *(opt-in)* | Adaptive single-turn search that reacts to refusals | **iterative** |
| `crescendo` *(opt-in)* | Multi-turn escalation | **iterative** |

`numTests` is the payloads generated per plugin. The shipped config
(5 plugins × 2 single-shot strategies × 3 tests = 48 probes) is the routine
scan; uncomment the iterative strategies for a deep scan. The older
`jailbreak` and `prompt-injection` ids are deprecated in favour of the above.

## Cost (token model)

A single **canary run** is ~26 model calls. A **red-team scan** is bigger —
run it on a cadence (before a release), never inside the per-change gate.

**Measured — shipped config** (5 plugins × 2 single-shot strategies,
`numTests: 3` → 48 probes), run 2026-08-22 against `gpt-4.1-mini`:

- 48 probes + grading, **28,594 total tokens**, **38s** wall time.
- ≈ a US cent on OpenRouter. Both strategies here are single-shot, so cost
  scales linearly with `plugins × strategies × numTests`.

**Deep scan — the expensive mode.** Uncomment the iterative strategies
(`jailbreak:meta`, `crescendo`) in the config: each test fans out into many
adaptive turns, pushing a scan to **hundreds of calls / 150K+ tokens** and
several minutes. Run it deliberately, with a long timeout — not routinely.
(A first attempt with the old iterative `jailbreak` strategy did not finish
inside a 10-minute window; that is why the shipped default is single-shot.)

**Cost drivers, in order:** iterative strategies (`jailbreak:meta`,
`crescendo`) → `numTests` → plugin count. Cheapest demo: one plugin,
`basic` only, `numTests: 1` (~a handful of calls). promptfoo's remote
*attack-generation* tokens are separate and not billed to your OpenRouter key.

## Feeding results back

An attack that lands is a real behavior the bot got wrong — promote it into the
golden set (`src/lib/toy-app/golden.ts`) as a new case, so every future canary
run guards against it. That closes the loop: red-team *discovers*, the golden
set *remembers*, the gate *enforces*.
