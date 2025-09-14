npm start
npm start
# E6data Evaluation Platform (Simplified Overview)

Focused documentation covering only what you asked for: setup, execution flow, and a thorough explanation of scoring & judging (heuristics, LLM layer, fusion, and inversion logic). All environment variable specifics and extended operational sections have been intentionally removed.

---
## 1. Setup (Minimal)
Prerequisites:
- Node.js (LTS)
- MongoDB running locally (or a configured remote URI in backend config)
- A local OpenAI-compatible model server (e.g., LM Studio) already running

Install & run:
```
cd backend
npm install
npm start

cd ../frontend
npm install
npm start
```
Open the frontend in your browser (default CRA dev port) and begin batch evaluations.

---
## 2. Flow (End‑to‑End)
1. User supplies: prompt, batch size, generation parameters (temperature, max tokens).
2. Frontend sends batch generation request → backend loops N times calling local model.
3. Generated items (prompt + response per agent) are returned to the frontend.
4. Frontend immediately submits those items to the evaluation endpoint.
5. For each item the evaluation pipeline runs:
   - Heuristic feature extraction → numeric signals mapped to preliminary dimension scores.
   - LLM judging → semantic dimension scores parsed from structured output.
   - Fusion → combines heuristic and LLM scores into final fused scores per dimension.
6. Aggregate (mean) scores are computed over the batch and returned.
7. UI updates metric cards (aggregate), leaderboard (historical comparative view), and recent evaluations (expandable list with details).

Visualization Conventions:
- All displayed metrics are normalized to a 0–1 scale.
- Hallucination is inverted for display (explained below) so every card uses a higher-is-better mental model.

---
## 3. Scoring Dimensions
| Dimension | Meaning (Higher Implies) | Underlying Risk / Problem Area |
|-----------|--------------------------|--------------------------------|
| Instruction | Stronger adherence to the given prompt directives | Omission, ignoring constraints |
| Hallucination (raw) | (Higher raw = more speculative / fabricated content) | Fabrication, off-prompt assertions |
| Hallucination Control (displayed) | 1 - raw hallucination (Higher = fewer hallucinations) | Ensures consistent “higher is better” UI semantics |
| Assumption | Fewer unsupported leaps beyond provided info | Unwarranted speculation / implicit claims |
| Coherence | Logical, well-structured, smooth narrative flow | Fragmentation, contradictions, incoherence |

Display Transformation:
```
Hallucination Control = 1 - rawHallucination
```
This prevents user confusion by aligning all progress bars and qualitative labels (Excellent → Poor) on the same directional axis.

---
## 4. Heuristic Layer (Feature Extraction)
Core idea: Fast lexical & structural analysis creates **cheap priors** for each dimension before invoking semantic judgment. Representative features include:
- coverage: Overlap between prompt salient tokens and response (instruction alignment)
- extraRatio: Proportion of tokens not traceable to prompt context (hallucination risk proxy)
- numPenalty: Excess numeric tokens (may indicate invented stats)
- speculativeDensity: Frequency of speculative/modal phrases (“might”, “could”, “probably”) → assumption risk
- variation: Sentence length variance (extremes can reduce coherence or indicate drift)
- contradictionMarkers: Connectors suggesting shifts (“however”, “but”) → used cautiously to flag potential divergence
- shortRatio: Ratio of very short sentences (can signal low information density)
- unresolvedPronounsRatio: Pronouns lacking antecedents (coherence risk)

Mapping: Each raw feature → normalized (0–1) → assigned to dimension-specific weightings to form preliminary dimension scores (heuristic_dim).

Limitations: Heuristics alone can misclassify domain‑specific content; they avoid semantic interpretation and only provide structural signal.

---
## 5. LLM Judging Layer
Purpose: Capture **semantic correctness, contextual fidelity, and nuanced coherence** beyond pattern surface features.

Process:
1. Construct judging prompt containing: original prompt + response + rubric specifying the four dimensions.
2. Ask model to return structured JSON: `{ instruction, hallucination, assumption, coherence, explanation? }` each within [0,1].
3. Parse JSON safely; on malformed output, fall back (e.g., minimal neutral scores or retry depending on implementation choices).

Design Principles:
- Stable temperature to minimize variance.
- Compact instructions to reduce prompt length and ambiguity.
- Encourages explicit numeric scoring to simplify fusion.

LLM Score Semantics:
- `instruction`: Faithfulness to explicit directives.
- `hallucination`: Degree of speculative / fabricated content (non-factual assertions unsupported by prompt).
- `assumption`: Degree of extrapolation beyond provided info.
- `coherence`: Structural & logical continuity.

Note: The raw hallucination score is kept as “risk magnitude”. Only the frontend inverts it for presentation.

---
## 6. Fusion Algorithm
Objective: Combine complementary strengths:
- Heuristics: Low-cost, consistent, but shallow.
- LLM: Rich semantic understanding, potentially noisy or inconsistent.

Simplified Fusion Logic:
```
// Given: heuristic_dim, llm_dim in [0,1], confidence in (0,1]
flat = all LLM dims identical?
baseWeight = flat ? 0.15 : 0.5
wLLM = clamp(baseWeight * confidence, 0.05, 0.85)
wHeu = 1 - wLLM
fused_dim = wHeu * heuristic_dim + wLLM * llm_dim
```

Rationale:
- If LLM scores collapse (flat) → treat as low information signal → reduce weight.
- Confidence may derive from JSON validity, absence of missing fields, and internal self‑rating (if provided).
- Clamping prevents collapse to either pure heuristics or pure LLM.

Outputs: Final fused per-dimension scores (0–1). Hallucination inversion for display happens *after* fusion: `displayHall = 1 - fused.hallucination`.

---
## 7. Qualitative Labels
Displayed bands (uniform across metrics after inversion):
| Range | Label |
|-------|-------|
| ≥ 0.85 | Excellent |
| ≥ 0.70 | Good |
| ≥ 0.50 | Fair |
| < 0.50 | Poor |

These are applied post‑inversion for hallucination, so interpret consistently across all cards.

---
## 8. Putting It All Together (Micro Walkthrough)
```
Prompt → Generate N responses → For each response:
  HeuristicExtractor(features) → heuristic scores
  LLMJudge(prompt,response) → semantic scores + optional explanation
  Fusion(heuristic, semantic, confidence) → fused scores
Aggregate(fused over batch) → means per dimension
Frontend:
  Display Instruction, Assumption, Coherence directly
  Display Hallucination Control = 1 - hallucination
  Render qualitative badges (Excellent/Good/Fair/Poor)
```

---
## 9. Why Invert Hallucination?
Users instinctively read higher numbers as better. Raw hallucination measures *risk* (higher = worse). Inversion provides uniform cognition and eliminates special‑case color logic in UI components.

Formula:
```
displayValue = 1 - rawHallucination
```
Where `rawHallucination` is the fused hallucination risk.

---
## 10. Extending Scoring
To add a new dimension (example: Factuality):
1. Add heuristic proxies (e.g., citation density, named entity repetition consistency).
2. Extend the judging rubric and JSON schema.
3. Incorporate into fusion loop with its own confidence calibration.
4. Add UI card + leaderboard column.
5. (Optional) Decide if inversion is needed based on directionality.

---
## 11. Quick Start Summary
1. Start backend & frontend.
2. Open UI, enter prompt & batch size.
3. Generate responses.
4. Trigger evaluation (auto after generation in current flow).
5. Inspect aggregate & individual scores (remember hallucination is inverted for display).

---
## 12. Notes
- No environment variable section included per request.
- For operational tuning consult the internal docs if re-added later.
- Hallucination values shown are already transformed; raw risk would be accessible only in internal data structures.

---
Feel free to reintroduce deployment, env, or advanced operations sections later if needed.
