# E6data Evaluation Platform

Comprehensive local-first framework to generate AI model responses in batches, evaluate them across multiple quality dimensions, fuse heuristic and LLM judgments, and visualize aggregated performance (leaderboard + recent evaluations UI).

---
## Table of Contents
1. Overview
2. Key Features
3. High-Level Architecture
4. End-to-End Flow (Request → Scores → UI)
5. Scoring Dimensions & Semantics
6. Heuristic Feature Extraction
7. LLM Judging Layer
8. Fusion Algorithm (Hybrid Scoring)
9. Data Models & Persistence
10. API Surface
11. Frontend UX Flow
12. Environment Variables
13. Local Development & Setup
14. Typical Usage Walkthrough
15. Extensibility Guide
16. Operational Considerations & Tuning
17. Troubleshooting (Generation / LM Studio)
18. Roadmap Ideas
19. License / Attribution

---
## 1. Overview
This project evaluates large batches of model ("agent") responses using a **hybrid evaluation pipeline**:
- Deterministic heuristic signals (fast, low cost)
- LLM-based semantic judging (context-aware)
- Confidence-weighted fusion producing stable final scores

The platform targets fast iteration when experimenting with prompt strategies, temperature settings, or agent variants using only a **local OpenAI-compatible provider** (e.g., LM Studio).

---
## 2. Key Features
- Batch generation with retry/backoff for local model
- Multi-dimensional evaluation: Instruction, Hallucination, Assumption, Coherence
- Heuristic feature extraction for structural/lexical signals
- LLM semantic scoring with JSON parsing safeguards
- Adaptive fusion weighting (balances noisy vs stable signals)
- Aggregated batch metrics + per-item details
- Leaderboard view for comparing agents
- Recent evaluations interactive panel
- Environment-driven configuration (timeouts, retries, model, base URL)

---
## 3. High-Level Architecture
```
Frontend (React)
  ├── BatchEvaluation (generate + evaluate)
  ├── RecentEvaluations (latest + expandable history)
  ├── Leaderboard (aggregated agent rankings)
  └── MetricCard components

Backend (Node + Express)
  ├── routes/generate.js  (local provider integration)
  ├── routes/evaluate.js  (batch + single evaluation)
  ├── eval/featureExtractor.js (heuristics)
  ├── eval/hybridJudge.js (LLM judging orchestrator)
  ├── eval/fusion.js (heuristic + LLM blending)
  ├── services/llmjudge.js (LLM call abstraction)
  ├── models/*.js (Mongo schemas)
  └── config/db.js (database connection)

Local LLM Provider (LM Studio or compatible)
  • /chat/completions endpoint (JSON)
```

---
## 4. End-to-End Flow (Request → Scores → UI)
1. User enters a prompt + parameters (temperature, max tokens) in the frontend.
2. Frontend calls `POST /api/generate/batch` with count N.
3. Backend generates N responses (retry logic, timing stats).
4. Frontend calls `POST /api/evaluate/batch` with returned items.
5. Evaluation pipeline executes for each item:
   - Heuristic extraction → raw dimension estimates
   - LLM judge → semantic dimension JSON
   - Fusion → final normalized scores (0–1)
   - Item persisted (or stored as part of a BatchResult document)
6. Aggregates computed (mean per dimension) → returned to frontend.
7. UI updates: Metric cards (aggregate), leaderboard (historical), recent evaluations (latest batch & details).

---
## 5. Scoring Dimensions & Semantics
| Dimension | Higher Value Implies | Core Risk Captured |
|-----------|---------------------|--------------------|
| Instruction (instruction) | Better prompt adherence | Ignoring or partially following instructions |
| Hallucination (hallucination) | (Raw) More hallucination risk (inverted in UI) | Fabricated or off-prompt content |
| Assumption (assumption) | Fewer unsupported assumptions | Speculative additions not grounded in prompt |
| Coherence (coherence) | Strong logical / structural clarity | Disjointed phrasing, contradictions, abrupt shifts |

UI Normalization: The raw hallucination score (risk) is inverted for display: `Hallucination Control = 1 - hallucination` so that all displayed metrics are **higher-is-better**.

---
## 6. Heuristic Feature Extraction (`eval/featureExtractor.js`)
Representative feature signals (not exhaustive):
- coverage: Fraction of prompt key tokens reused (instruction alignment)
- extraRatio: Tokens not correlated with prompt (hallucination tendency)
- numPenalty: Suspicious numeric proliferation
- speculativeDensity: Density of modal / speculative constructs
- variation: Sentence length variance (structure stability)
- contradictionMarkers: Presence of adversative connectors implying drift
- shortRatio: Low-information short sentence share
- unresolvedPronounsRatio: Pronouns with unclear referents (coherence risk)

Each is normalized to [0,1] and mapped into preliminary dimension scores.

---
## 7. LLM Judging Layer (`services/llmjudge.js` / `eval/hybridJudge.js`)
The LLM judge receives a compact JSON-oriented rubric prompt with the original prompt + response and must return structured dimension scores (0–1). Safeguards:
- Temperature kept moderate for stability
- JSON parsing fallback / validation
- Optional retries (if provider unstable)

LLM outputs may include an `explanation` or rationale. Low-confidence or invalid responses can be flagged for future active-learning improvements.

---
## 8. Fusion Algorithm (`eval/fusion.js`)
Purpose: Combine stable but shallow heuristics with richer but sometimes noisy LLM scores.

Pseudocode (from `EVALUATION_FRAMEWORK.md`):
```
flat = all LLM scores identical?
baseWeight = flat ? 0.15 : 0.5
wLLM = clamp(baseWeight * confidence, 0.05, 0.85)
wHeu = 1 - wLLM
fused_dim = wHeu * heuristic_dim + wLLM * llm_dim
```
Confidence can factor in:
- LLM internal self-assessed certainty (if provided)
- JSON validity / completeness
- Heuristic agreement (variance penalty)

Outputs: `fused` object containing final per-dimension scores.

---
## 9. Data Models (Mongo)
| Model | Purpose |
|-------|---------|
| EvaluationItem | (If used) Individual evaluated prompt/response pair |
| BatchResult | Stores aggregate + items for a batch evaluation |
| MetricSnapshot | (Optional) Time-series aggregates for trend UI |
| PromptTemplate | Future prompt library extensibility |
| Agent | Registered agent metadata |

Typical stored fields (BatchResult):
```
{
  agent: "local-agent",
  count: 25,
  aggregateScores: { instruction, hallucination, assumption, coherence },
  items: [ { prompt, response, scores, heuristic, llm, fused, latencyMs, ... } ]
}
```

---
## 10. API Surface (Essentials)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate/batch` | POST | Generate N responses for a prompt using local provider |
| `/api/generate/list-models` | GET | Return available local model(s) |
| `/api/generate/health` | GET | Health & reachability summary |
| `/api/generate/debug` | GET | Quick generation sanity test |
| `/api/evaluate/batch` | POST | Evaluate an array of `{agent,prompt,response}` items |
| `/api/evaluate` | POST | Single item evaluation |
| `/api/evaluate/leaderboard` | GET | Aggregated leaderboard metrics (implementation dependent) |

Generation Request Example:
```json
POST /api/generate/batch
{
  "prompt": "Explain retrieval augmented generation.",
  "count": 5,
  "agent": "LocalQwen",
  "provider": "local",
  "temperature": 0.7,
  "max_tokens": 512
}
```

Evaluation Batch Example:
```json
POST /api/evaluate/batch
{
  "items": [
    { "agent":"LocalQwen", "prompt":"...", "response":"..." },
    { "agent":"LocalQwen", "prompt":"...", "response":"..." }
  ]
}
```

---
## 11. Frontend UX Flow
- BatchEvaluation: Collect parameters → trigger generation → then evaluation → show aggregate metric cards.
- MetricCard: Displays score, qualitative label (Excellent/Good/Fair/Poor), and progress bar.
- Leaderboard: Sortable table + bar chart; hallucination inverted for display.
- RecentEvaluations: Initially shows most recent batch; expand to reveal history & per-item details (responses + metrics + explanations).

---
## 12. Environment Variables
(See also `backend/LOCAL_PROVIDER_USAGE.md` & `backend/LM_STUDIO_TROUBLESHOOTING.md`)

| Variable | Purpose | Required | Example |
|----------|---------|----------|---------|
| `LOCAL_LLM_BASE_URL` | Base URL of LM Studio / local server | Yes | `http://localhost:1234/v1` |
| `LOCAL_LLM_MODEL` | Model identifier | Yes | `qwen2:7b` |
| `LOCAL_LLM_API_KEY` | API key if local server enforces auth | No | `abc123` |
| `LLM_REQUEST_TIMEOUT_MS` | Per-attempt timeout | No | `45000` |
| `LLM_MAX_RETRIES` | Retry attempts | No | `3` |
| `LLM_RETRY_BACKOFF_MS` | Base backoff ms | No | `800` |
| `EVAL_CONCURRENCY` | (If used) parallel evaluators | No | `4` |

---
## 13. Local Development & Setup
### Prerequisites
- Node.js (LTS)
- MongoDB running locally or accessible URI
- LM Studio (or other OpenAI-compatible local server) with a loaded model

### Install
```
cd backend
npm install
cd ../frontend
npm install
```

### Run
Backend (from `backend/`):
```
npm start
```
Frontend (from `frontend/`):
```
npm start
```
Access app at: http://localhost:3000 (CRA default) or whichever dev port is configured.

---
## 14. Typical Usage Walkthrough
1. Start LM Studio with selected model and note port (e.g., 1234).
2. Set `.env` in backend with `LOCAL_LLM_BASE_URL` & `LOCAL_LLM_MODEL`.
3. Run backend + frontend.
4. Open UI → enter a prompt → set batch size → (optionally adjust temperature & max tokens) → Generate & Evaluate.
5. View aggregate metrics and inspect detailed items.
6. Open Leaderboard to compare across past agent runs.
7. Expand Recent Evaluations to scroll through historical batches.

---
## 15. Extensibility Guide
| Goal | Approach |
|------|----------|
| Add new dimension | Extend featureExtractor + LLM rubric + fusion + model schema |
| Plug retrieval grounding | Prepend retrieved context to LLM judge prompt |
| Swap local model | Change `LOCAL_LLM_MODEL`, ensure compatibility |
| Add streaming | Implement incremental token consumption & UI stream renderer |
| Cache evaluations | Hash `{prompt,response}` and store fused result for reuse |
| Human review loop | Add status field and review queue UI |

---
## 16. Operational Considerations & Tuning
| Scenario | Adjustment |
|----------|------------|
| Slow generations | Increase timeout, reduce batch size, lower max tokens |
| Noisy hallucination scores | Calibrate heuristics or adjust LLM prompt constraints |
| High latency variance | Introduce per-model dynamic timeout or concurrency throttling |
| Large memory usage | Prune stored raw fields or disable saving full intermediate artifacts |

Monitoring Ideas:
- Log `latencyMs`, attempts, finish_reason
- Track p95 latencies for generation and evaluation
- Flag evaluations where fusion confidence < threshold

---
## 17. Troubleshooting
Generation disconnects, timeouts, or partial outputs: see `backend/LM_STUDIO_TROUBLESHOOTING.md` for deep dive (timeouts, streaming mismatch, concurrency saturation, etc.).

Common Quick Fixes:
- Increase `LLM_REQUEST_TIMEOUT_MS` for large models
- Reduce `max_tokens` if truncation frequent
- Validate base URL matches LM Studio UI
- Check model name with `/models` endpoint

---
## 18. Roadmap Ideas
- Adaptive continuation instead of hard truncation (optional “Continue” button)
- Vector grounding + factuality scoring
- Bias/fairness dimension
- Active learning triage for low-confidence items
- Streaming token-by-token UI
- Prometheus metrics export + Grafana dashboard

---
## 19. License / Attribution
Internal / private usage unless a license is added. Add an explicit `LICENSE` file if distributing.

---
## Appendix A: Fusion Rationale
Heuristics are stable but shallow. LLM scores are rich but noisy. Weighted fusion avoids over-reliance on either, reducing volatility and improving trust in incremental improvements.

## Appendix B: Hallucination Inversion
Raw hallucination score is a risk metric (higher = worse). To maintain UI consistency, we present a derived metric:
```
Hallucination Control = 1 - rawHallucination
```
This allows a single “higher is better” mental model across all displayed metrics.

---
Feel free to open an issue or request enhancements (e.g., plugging in multi-provider routing or evaluation version migration tooling).
