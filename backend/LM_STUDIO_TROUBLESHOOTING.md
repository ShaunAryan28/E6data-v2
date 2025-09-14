# LM Studio Disconnect & Generation Troubleshooting

This guide explains the common causes of the message:

> `[LM STUDIO SERVER] Client disconnected. Stopping generation...`

It appears when the LM Studio server began generating a completion, but the **HTTP client closed the connection early**. The server then aborts the ongoing generation.

---
## Quick Diagnosis Checklist
| Symptom | Likely Cause | What to Check | Suggested Fix |
|---------|--------------|---------------|---------------|
| Message appears almost immediately | Client timeout too low | Client / fetch timeout value | Increase `LLM_REQUEST_TIMEOUT_MS` (e.g. 60000) |
| Message after ~60s every time | Default timeout in proxy/tool | Any reverse proxy (NGINX), client lib defaults | Raise proxy timeout (e.g. `proxy_read_timeout 300s`) |
| Large / verbose answers cut mid-way | Streaming mismatch or early abort | Are you consuming the entire response body? | Ensure full body read; avoid premature `res.end()` |
| Inconsistent failures under concurrency | Resource saturation | CPU/RAM usage, model load, GPU VRAM | Lower batch size / concurrency (`EVAL_CONCURRENCY`) |
| Frequent network errors (ECONNRESET) | Local loopback instability / antivirus | System logs, security software | Exclude LM Studio port from scanning |

---
## Common Root Causes & Solutions

### 1. Client-Side Timeout
Your previous implementation lacked explicit timeouts; now we enforce a configurable timeout plus retries. If your model is slow (e.g. 13B+ with long max tokens), 45s may be too short.

**Mitigation:**
- Set `LLM_REQUEST_TIMEOUT_MS=90000` (90s) temporarily.
- Reduce `max_tokens` if you only need summaries.
- Avoid sending huge prompts (chunk or truncate pre-processing).

### 2. Premature Process Exit / Ctrl+C
If the Node process terminates (manual interrupt, crash, unhandled rejection), sockets close and LM Studio aborts generation.

**Mitigation:**
- Add a shutdown hook to drain in-flight requests.
- Ensure `process.on('unhandledRejection')` logs & exits gracefully after pending promises resolve.

### 3. Streaming vs Non-Streaming Expectation
LM Studio can stream tokens, but your client currently requests standard `/chat/completions` JSON in one piece. If LM Studio is configured to stream by default and the client isn’t reading the event stream, disconnects may occur.

**Mitigation:**
- Explicitly set `stream: false` in the request body (if supported by your LM Studio build) OR implement an EventSource/readable stream consumer.
- If you add streaming later, switch fetch handling to incremental consumption.

### 4. Response Too Large
Long outputs increase risk of hitting default timeouts or memory pressure.

**Mitigation:**
- Use a content policy: ask model for concise answers.
- Post-process: if you need multi-part output, request sections iteratively.

### 5. Concurrency Saturation
Simultaneous evaluations can queue inside LM Studio and degrade per-request latency, bumping against client timeouts.

**Mitigation:**
- Tune `EVAL_CONCURRENCY` (start with 2–4 for CPU models, higher for GPU if VRAM ample).
- Add simple adaptive backpressure: if average latency > threshold, temporarily reduce concurrency.

### 6. Local Network / Loopback Resets
Some Windows security suites or VPN stacks can reset localhost connections under load.

**Mitigation:**
- Exclude LM Studio executable and port (default 1234) from firewall/AV deep inspection.
- Confirm no conflicting service is intermittently binding the port.

### 7. Model or Backend Errors Masquerading as Disconnects
If LM Studio internally errors out (OOM, context overflow) it may sever the connection.

**Mitigation:**
- Check LM Studio logs for OOM / context warnings.
- Lower `max_tokens` or switch to a smaller model for batch runs.

---
## Enhancements Added in Code
Your `localChat` function now includes:
- Exponential backoff retry (configurable attempts)
- AbortController-based timeout
- Latency measurement per call
- Error categorization (auth vs network vs other)

### Relevant Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `LLM_REQUEST_TIMEOUT_MS` | Hard timeout per generation attempt | 45000 |
| `LLM_MAX_RETRIES` | Max retry attempts for recoverable errors | 3 |
| `LLM_RETRY_BACKOFF_MS` | Base backoff in ms (exponential) | 800 |
| `EVAL_CONCURRENCY` | Parallel evaluation workers | 4 |
| `EVAL_CACHE_SIZE` | LLM eval response cache entries | 500 |

---
## Suggested Additional Hardening
1. Add circuit breaker: if 5 consecutive network errors occur, pause new requests for 30s.
2. Log structured JSON lines for each failure with fields: `event=gen_error`, `attempt`, `latency_ms`, `error_category`.
3. Expose a lightweight `/api/health/llm` endpoint that performs a 1-token generation to detect latency spikes.
4. Track p95 / p99 latency in memory and include in health response.
5. Implement optional streaming mode behind a query param when needed.

---
## Sample Monitoring JSON Log (Proposed)
```json
{
  "ts": "2025-09-14T12:34:56.789Z",
  "event": "gen_request",
  "prompt_chars": 128,
  "attempt": 1,
  "timeout_ms": 45000
}
```
```json
{
  "ts": "2025-09-14T12:34:57.912Z",
  "event": "gen_success",
  "attempt": 1,
  "latency_ms": 1123,
  "tokens_out": 142
}
```
```json
{
  "ts": "2025-09-14T12:35:05.001Z",
  "event": "gen_error",
  "attempt": 2,
  "latency_ms": 45012,
  "error_category": "network",
  "message": "Local connection failed: network timeout"
}
```

---
## Quick Action Tuning Recipes
| Goal | Settings |
|------|----------|
| Allow slower big model | `LLM_REQUEST_TIMEOUT_MS=90000`, reduce `EVAL_CONCURRENCY=2` |
| Faster feedback, short answers | `max_tokens=256`, `temperature=0.4` |
| Stress test throughput | Increase `EVAL_CONCURRENCY`, decrease timeout cautiously |
| Recover from noisy network | Increase `LLM_MAX_RETRIES=5`, keep backoff base >= 800 |

---
## Verifying Fixes
1. Start LM Studio with your model loaded.
2. Run 10 batch generations; record any disconnects.
3. Increase timeout and retry variables; re-run and compare failures.
4. If failures drop -> root cause was timeout; if not, inspect server logs for model-level errors.

---
## When to Escalate
- >5% of requests still failing after raising timeout to 90s.
- Consistent failures on first attempt even with tiny prompts.
- LM Studio log shows memory or context overflow repeatedly.

Collect: environment vars, model name, prompt length stats, failure JSON logs, LM Studio server version.

---
## Future Improvements (Backlog Candidates)
- Adaptive dynamic timeout (percentile-based) per model.
- Token-level streaming with mid-flight client cancellation support.
- Pluggable retry strategy (e.g., decorrelated jitter).
- Prometheus metrics export (latency histogram, error counters).
- Automated prompt chunking for long inputs.

---
**Maintainer Note:** Keep this document updated as operational patterns evolve. Tie changes to a versioned `EVAL_PIPELINE_VERSION` env var for traceability.
