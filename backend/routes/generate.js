import express from "express";
import fetch from "node-fetch";
import { setTimeout as delay } from "timers/promises";

const router = express.Router();

// Local provider only
function getLocalBase() {
  if (!process.env.LOCAL_LLM_BASE_URL) throw new Error("LOCAL_LLM_BASE_URL is not set in .env");
  return process.env.LOCAL_LLM_BASE_URL.replace(/\/$/, "");
}
function getLocalModel() {
  if (!process.env.LOCAL_LLM_MODEL) throw new Error("LOCAL_LLM_MODEL is not set in .env");
  return process.env.LOCAL_LLM_MODEL;
}
function getTimeoutMs() { return parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || '45000', 10); }
function getMaxRetries() { return parseInt(process.env.LLM_MAX_RETRIES || '3', 10); }
function getRetryBackoffBase() { return parseInt(process.env.LLM_RETRY_BACKOFF_MS || '800', 10); }
function isStreamingDisabled() { return /^false$/i.test(process.env.LLM_ENABLE_STREAM || 'false'); }

function isNonRetryable(msg = "") {
  return /invalid api key|unauthorized|permission|access denied/i.test(msg);
}

async function localChat(prompt, { temperature = 0.7, max_tokens = 512 } = {}) {
  const model = getLocalModel();
  const url = `${getLocalBase()}/chat/completions`;
  const body = { model, messages: [{ role: "user", content: prompt }], temperature, max_tokens };
  if (isStreamingDisabled()) body.stream = false; // enforce full response mode when configured
  const maxRetries = getMaxRetries();
  const timeoutMs = getTimeoutMs();
  const backoffBase = getRetryBackoffBase();
  let attempt = 0;
  let lastError;
  const started = Date.now();
  while (attempt < maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    let networkError = false;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.LOCAL_LLM_API_KEY || 'not-needed'}` },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (e) {
      networkError = true;
      lastError = e;
    } finally {
      clearTimeout(timer);
    }

    if (networkError) {
      const msg = (lastError && lastError.message) || "network error";
      const nonRetryable = /invalid api key|unauthorized|permission|access denied/i.test(msg);
      if (nonRetryable) throw new Error(msg);
      if (attempt >= maxRetries) {
        throw new Error(`Local connection failed after ${attempt} attempts: ${msg}`);
      }
      const backoff = backoffBase * Math.pow(2, attempt - 1) + Math.random() * 150;
      await delay(backoff);
      continue;
    }

    // Response received
    let raw;
    try { raw = await res.text(); } catch (e) { raw = ''; }
    let json; try { json = JSON.parse(raw); } catch { json = { parseError: true, raw }; }
    if (!res.ok || json.error) {
      const msg = json?.error?.message || `Local HTTP ${res.status}`;
      const nonRetryable = /invalid api key|unauthorized|permission|access denied|model_not_found|unsupported/i.test(msg);
      if (nonRetryable || attempt >= maxRetries) {
        throw new Error(msg);
      }
      const backoff = backoffBase * Math.pow(2, attempt - 1) + Math.random() * 150;
      await delay(backoff);
      continue;
    }
    const choice = json?.choices?.[0];
    const text = (choice?.message?.content ?? choice?.text ?? "").trim();
    return { text, model, raw: json, attempts: attempt, latencyMs: Date.now() - started, status: text ? "ok" : "empty_text", provider: "local" };
  }
  throw new Error(`Local generation failed after ${maxRetries} attempts${lastError ? ': ' + lastError.message : ''}`);
}


router.post("/batch", async (req, res) => {
  try {
    let { prompts, prompt, count = 10, agent, temperature, max_tokens } = req.body;
    count = Math.max(1, Number(count));
    if (!Array.isArray(prompts)) {
      if (prompt) {
        prompts = Array.from({ length: count }, () => prompt);
      }
    }
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ error: "Provide 'prompts' array or 'prompt' string." });
    }
    const results = [];
    const errorsSummary = new Set();
    for (const p of prompts) {
      const startItem = Date.now();
      try {
        const r = await localChat(p, { temperature, max_tokens });
        results.push({
          prompt: p,
          response: r.text,
          model: r.model,
          status: r.status,
          attempts: r.attempts,
          latencyMs: r.latencyMs,
          provider: 'local'
        });
      } catch (e) {
        const errMsg = e.message || "Generation error";
        const network = /ECONNRESET|socket hang up|aborted|ENOTFOUND|ETIMEDOUT|client disconnected/i.test(errMsg);
        errorsSummary.add(errMsg);
        results.push({
          prompt: p,
            response: "",
            model: getLocalModel(),
            error: errMsg,
            errorCategory: network ? 'network' : (isNonRetryable(errMsg) ? 'auth' : 'other'),
            status: isNonRetryable(errMsg) ? "non_retryable_error" : (network ? 'network_error' : 'error'),
            attempts: 1,
            latencyMs: Date.now() - startItem,
            provider: 'local'
        });
      }
    }
    const agentLabel = agent || getLocalModel();
    const items = results.map(r => ({
      agent: agentLabel,
      prompt: r.prompt,
      response: r.response,
      model: r.model,
      provider: r.provider,
      error: r.error,
      status: r.status,
      attempts: r.attempts
    }));
    res.json({
      provider: 'local',
      model: getLocalModel(),
      count: results.length,
      errors: Array.from(errorsSummary),
      results,
      items
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


router.get("/debug", async (req, res) => {
  const prompt = req.query.prompt || "Ping";
  try {
    const r = await localChat(prompt, {});
    res.json({ provider: 'local', model: r.model, snippet: r.text.slice(0, 300), status: r.status, attempts: r.attempts });
  } catch (e) {
    res.status(502).json({ provider: 'local', error: e.message });
  }
});

router.get("/list-models", (req, res) => {
  res.json({ provider: 'local', models: [getLocalModel()], baseUrl: getLocalBase() });
});

router.get("/health", async (req, res) => {
  let reachable = false;
  try {
    const ping = await fetch(`${getLocalBase()}/models`, { method: 'GET' });
    reachable = ping.ok;
  } catch {}
  res.json({ provider: 'local', model: getLocalModel(), baseUrl: getLocalBase(), reachable });
});

export default router;
