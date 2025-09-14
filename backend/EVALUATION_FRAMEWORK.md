# Hybrid Evaluation Framework

## Overview
This framework performs large-scale evaluation of AI agent responses combining:
1. Heuristic feature extraction (deterministic, fast)
2. LLM-based judging (semantic, contextual)
3. Adaptive fusion with confidence weighting

## Dimensions
- Instruction Following
- Hallucination Resistance
- Assumption Control
- Coherence (and structural accuracy)

## Flow
1. Input: batch of { agent, prompt, response }
2. Heuristics: featureExtractor builds metrics -> heuristic dimension scores
3. LLM Judge: `llmjudge.evaluateResponse()` returns JSON dimension scores
4. Fusion: `fusion.fuseScores()` blends heuristic + LLM (variance & confidence aware)
5. Storage: Each item saved as `EvaluationItem`; optional aggregate saved as `BatchResult`
6. Metrics: Aggregations feed leaderboards and trend snapshots

## Key Files
- `eval/featureExtractor.js`
- `eval/hybridJudge.js`
- `eval/fusion.js`
- `models/EvaluationItem.js`
- `routes/evaluate.js` (adds `/api/evaluate/hybrid-batch`)

## Heuristic Features (selected)
| Feature | Purpose |
|---------|---------|
| coverage | Prompt token coverage (instruction) |
| extraRatio | Off-prompt token ratio (hallucination) |
| numPenalty | Extraneous numeric ratio |
| speculativeDensity | Unwarranted assumption density |
| variation | Sentence length variance (coherence) |
| contradictionMarkers | Discourse contradictions / shifts |
| shortRatio | Low-information sentence proportion |
| unresolvedPronounsRatio | Reference clarity heuristic |

## Fusion Logic
```
flat = all LLM scores identical?
baseWeight = flat ? 0.15 : 0.5
wLLM = clamp(baseWeight * confidence, 0.05, 0.85)
wHeu = 1 - wLLM
fused_dim = wHeu * heuristic_dim + wLLM * llm_dim
```

## Hybrid Batch Endpoint
`POST /api/evaluate/hybrid-batch`
Body:
```
{ "items": [ { "agent":"agentA", "prompt":"...", "response":"..." }, ... ] }
```
Response:
```
{
  "count": N,
  "aggregateScores": { instruction, hallucination, assumption, coherence },
  "items": [
     { id, agent, fused:{...}, heuristic:{...}, llm:{...}, confidence }
  ]
}
```

## Extensibility
- Add retrieval grounding: inject context snippets prior to LLM judging.
- Add NLI contradiction scoring for accuracy refinement.
- Add evaluator version bump when heuristics or weights change.
- Caching LLM evaluation for identical (prompt,response) pairs.

## Versioning
Field `evaluatorVersion` stored in `EvaluationItem`. Migrate with reprocess queue if logic changes.

## Future Ideas
- Active learning selection of low-confidence items for human review
- Meta-model to predict fused score and reduce LLM calls
- Fairness & bias dimension with sensitive term handling

