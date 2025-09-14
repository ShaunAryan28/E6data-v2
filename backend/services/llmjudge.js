
import fetch from "node-fetch";

// Simple in-memory LRU cache for evaluation responses
const CACHE_MAX = parseInt(process.env.EVAL_CACHE_SIZE || '500', 10);
const evalCache = new Map(); // key -> value

function cacheGet(key){
  if(!evalCache.has(key)) return null;
  const val = evalCache.get(key);
  // refresh LRU ordering
  evalCache.delete(key);
  evalCache.set(key, val);
  return val;
}

function cacheSet(key, val){
  if (evalCache.has(key)) evalCache.delete(key);
  evalCache.set(key, val);
  if (evalCache.size > CACHE_MAX){
    // delete oldest
    const firstKey = evalCache.keys().next().value;
    evalCache.delete(firstKey);
  }
}

function getLocalBase() {
  if (!process.env.LOCAL_LLM_BASE_URL) throw new Error("LOCAL_LLM_BASE_URL is not set in .env");
  return process.env.LOCAL_LLM_BASE_URL.replace(/\/$/, "");
}
function getLocalModel() {
  if (!process.env.LOCAL_LLM_MODEL) throw new Error("LOCAL_LLM_MODEL is not set in .env");
  return process.env.LOCAL_LLM_MODEL;
}
function isStreamingDisabled(){ return /^false$/i.test(process.env.LLM_ENABLE_STREAM || 'false'); }

const INSTRUCTION = `Return ONLY strict JSON with keys instruction, hallucination, assumption, coherence (each 0-1 float) and explanation (string).`;

async function localEvalCall(prompt, response) {
  const evalPrompt = `${INSTRUCTION}\nPrompt: ${prompt}\nResponse: ${response}`;
  const temperature = parseFloat(process.env.EVAL_JUDGE_TEMPERATURE || '0');
  const max_tokens = parseInt(process.env.EVAL_JUDGE_MAX_TOKENS || '256', 10);
  const body = {
    model: getLocalModel(),
    messages: [{ role: "user", content: evalPrompt }],
    temperature,
    max_tokens
  };
  if (isStreamingDisabled()) body.stream = false;
  const url = `${getLocalBase()}/chat/completions`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.LOCAL_LLM_API_KEY || 'not-needed'}` },
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error(`Local eval connection failed: ${e.message}`);
  }
  const raw = await res.text();
  let json; try { json = JSON.parse(raw); } catch { json = { parseError: true, raw }; }
  if (!res.ok || json.error) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json?.choices?.[0]?.message?.content || "";
}

export async function evaluateResponse(prompt, response) {
  const key = `${prompt}||${response}`;
  const cached = cacheGet(key);
  if (cached) {
    return { ...cached, _cached: true };
  }
  if (!response) {
    return {
      instruction: 0,
      hallucination: 1,
      assumption: 1,
      coherence: 0,
      explanation: "Empty response",
      _model: getLocalModel(),
      _provider: 'local'
    };
  }
  let raw = "";
  try {
    raw = await localEvalCall(prompt, response);
  } catch (e) {
    const fallback = {
      instruction: 1,
      hallucination: 1,
      assumption: 1,
      coherence: 1,
      explanation: `Evaluator (local) failed: ${e.message}`,
      _model: getLocalModel(),
      _provider: 'local'
    };
    cacheSet(key, fallback);
    return fallback;
  }
  let scores;
  try {
    scores = JSON.parse(raw);
  } catch {
    scores = {
      instruction: 1,
      hallucination: 1,
      assumption: 1,
      coherence: 1,
      explanation: raw.slice(0, 400) || "Parse failure (defaults)"
    };
  }
  const enriched = { ...scores, _model: getLocalModel(), _provider: 'local' };
  cacheSet(key, enriched);
  return enriched;
}
