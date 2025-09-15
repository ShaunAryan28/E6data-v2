import express from "express";
import { evaluateResponse } from "../services/llmjudge.js";
import Result from "../models/result.js"; // retained for single eval endpoint (optional)
import BatchResult from "../models/batchResult.js";
import EvaluationItem from "../models/EvaluationItem.js";
import { hybridEvaluate } from "../eval/hybridJudge.js";
import { franc } from "franc";
import normalize from "normalize-text";

const router = express.Router();
console.log("[Evaluate.js] Router loaded");

// Basic English stopwords for coverage calc
const STOPWORDS = new Set(["the","and","or","of","to","a","in","on","for","with","that","this","is","are","be","as","an","at","by","it","from","was","were","will","would","can","could","should","may","might","have","has","had","not"]);

function clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }

function tokenize(text){
  return (text.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).filter(w => !STOPWORDS.has(w));
}

function computeHeuristicScores(prompt, response){
  const pTokens = Array.from(new Set(tokenize(prompt)));
  const rTokensAll = tokenize(response);
  const rTokensSet = new Set(rTokensAll);
  // Instruction / coverage: fraction of prompt tokens present
  let coverage = 0;
  if (pTokens.length) {
    const present = pTokens.filter(t => rTokensSet.has(t)).length;
    coverage = present / pTokens.length; // 0..1
  }
  // Hallucination: proportion of response tokens NOT in prompt (penalize rare or extraneous content)
  const pSet = new Set(pTokens);
  const extraTokens = rTokensAll.filter(t => !pSet.has(t));
  const extraRatio = rTokensAll.length ? extraTokens.length / rTokensAll.length : 0;
  // Numbers hallucination penalty
  const promptNums = prompt.match(/\d+/g) || [];
  const respNums = response.match(/\d+/g) || [];
  const extraneousNums = respNums.filter(n => !promptNums.includes(n));
  const numPenalty = respNums.length ? extraneousNums.length / respNums.length : 0;
  // Combine: start at 1 and subtract weighted penalties
  let hallucination = 1 - (extraRatio * 0.4 + numPenalty * 0.6);
  hallucination = clamp01(hallucination);
  // Assumption: frequency of hedging / assumption phrases
  const assumptionPhrases = ["assume","suppose","let's say","maybe","probably","i think","it seems","likely","guess","hypothesize"]; 
  let assumptionHits = 0;
  for(const phrase of assumptionPhrases){
    const re = new RegExp(phrase.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&'), 'gi');
    assumptionHits += (response.match(re) || []).length;
  }
  let assumption = 1 - Math.min(assumptionHits / 5, 1) * 0.7; // cap penalty 0.7
  assumption = clamp01(assumption);
  // Coherence: sentence length consistency + contradictions markers
  const sentences = response.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const lengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length).filter(l => l>0);
  let variation = 0;
  if (lengths.length > 1){
    const mean = lengths.reduce((a,b)=>a+b,0)/lengths.length;
    const variance = lengths.reduce((a,b)=>a+Math.pow(b-mean,2),0)/lengths.length;
    variation = Math.sqrt(variance)/(mean+1); // normalized variation
  }
  const contradictionMarkers = (response.match(/\b(however|but|although|yet)\b/gi) || []).length;
  const shortSentences = lengths.filter(l => l < 4).length;
  const shortRatio = lengths.length ? shortSentences/lengths.length : 0;
  let coherence = 1 - (variation*0.3 + contradictionMarkers*0.05 + shortRatio*0.25);
  coherence = clamp01(coherence);
  return {
    instruction: clamp01(coverage),
    hallucination,
    assumption,
    coherence,
    debug: { coverage, extraRatio, numPenalty, assumptionHits, variation, contradictionMarkers, shortRatio }
  };
}

// Batch evaluation endpoint
router.post("/batch", async (req, res) => {
  console.log("[BatchEval] /batch route hit");
  console.log("[BatchEval] req.body:", req.body);
  const items = req.body.items;
  if (!Array.isArray(items)) {
    console.log("[BatchEval] items is not an array. Value:", items);
    return res.status(400).json({ error: "Items must be an array." });
  }
  try {
    const processed = [];

    function sanitizeScores(obj){
      const safe = {
        instruction: Number.isFinite(obj.instruction) ? obj.instruction : 0,
        hallucination: Number.isFinite(obj.hallucination) ? obj.hallucination : 0,
        assumption: Number.isFinite(obj.assumption) ? obj.assumption : 0,
        coherence: Number.isFinite(obj.coherence) ? obj.coherence : 0
      };
        // Clamp into [0,1] just in case
      for (const k of Object.keys(safe)){
        if (safe[k] < 0 || safe[k] > 1) {
          safe[k] = Math.min(1, Math.max(0, safe[k]));
        }
      }
      return safe;
    }
    for (let idx = 0; idx < items.length; idx++) {
      const original = items[idx];
      let { agent, prompt, response, model, provider, error, status } = original;
      provider = 'local';
      prompt = normalize((prompt || "").trim());
      response = normalize((response || "").trim());
  let heuristic, llmScores, scores;
      let skipped = false;
      const shouldSkip = !response || error || /error|empty/i.test(status || "");
      if (shouldSkip) {
        skipped = true;
        heuristic = computeHeuristicScores(prompt, response || "");
        scores = {
          instruction: 0, // no instruction success for skipped
          hallucination: 1,
          assumption: 1,
          coherence: 0.2,
          explanation: error ? `Generation error: ${error}` : (status === 'empty_text' ? 'Empty generation' : 'No response')
        };
      } else {
        try {
          heuristic = computeHeuristicScores(prompt, response);
          llmScores = await evaluateResponse(prompt, response, provider);
          // If llmScores are all 1 (fallback) detect and rely more on heuristic
          const llmIsFlat = [llmScores.instruction, llmScores.hallucination, llmScores.assumption, llmScores.coherence].every(v => v === 1);
          const wHeu = llmIsFlat ? 0.9 : 0.5;
          const wLlm = 1 - wHeu;
          scores = {
            instruction: wHeu * heuristic.instruction + wLlm * (llmScores.instruction ?? heuristic.instruction),
            hallucination: wHeu * heuristic.hallucination + wLlm * (llmScores.hallucination ?? heuristic.hallucination),
            assumption: wHeu * heuristic.assumption + wLlm * (llmScores.assumption ?? heuristic.assumption),
            coherence: wHeu * heuristic.coherence + wLlm * (llmScores.coherence ?? heuristic.coherence),
            explanation: llmScores.explanation || ""
          };
        } catch (scoreErr) {
          scores = {
            instruction: heuristic?.instruction ?? 0.5,
            hallucination: heuristic?.hallucination ?? 0.5,
            assumption: heuristic?.assumption ?? 0.5,
            coherence: heuristic?.coherence ?? 0.5,
            explanation: `Scoring error: ${scoreErr.message}`
          };
        }
      }
      const explanationText = scores.explanation || "";
      const cleanedScores = sanitizeScores(scores);
      processed[idx] = {
        agent,
        prompt,
        response,
        model: model || llmScores?._model,
        provider: 'local',
        scores: cleanedScores,
        explanation: explanationText,
        status,
        error,
        attempts: original.attempts,
        evalMeta: {
          evalModel: llmScores?._model,
          evalProvider: 'local',
          skipped,
          generationStatus: status,
          generationError: error
        }
      };
    }
    const agg = processed.reduce((acc, it) => {
      if (it.scores) {
        acc.instruction += it.scores.instruction || 0;
        acc.hallucination += it.scores.hallucination || 0;
        acc.assumption += it.scores.assumption || 0;
        acc.coherence += it.scores.coherence || 0;
        acc.count++;
      }
      return acc;
    }, { instruction:0, hallucination:0, assumption:0, coherence:0, count:0 });
    const aggregateScores = {
      instruction: agg.count ? agg.instruction / agg.count : 0,
      hallucination: agg.count ? agg.hallucination / agg.count : 0,
      assumption: agg.count ? agg.assumption / agg.count : 0,
      coherence: agg.count ? agg.coherence / agg.count : 0
    };
    const batchDoc = new BatchResult({
      agent: processed[0]?.agent || 'unknown',
      provider: 'local',
      prompt: processed[0]?.prompt || '',
      countRequested: items.length,
      countEvaluated: processed.length,
      aggregateScores,
      items: processed
    });
    try {
      await batchDoc.save();
    } catch (saveErr) {
      console.error('[BatchEval] Validation details:', saveErr?.errors ? Object.keys(saveErr.errors).reduce((o,k)=>{o[k]=saveErr.errors[k].message;return o;}, {}) : saveErr.message);
      throw saveErr;
    }
  console.log(`[BatchEval] Saved batch with ${processed.length} items.`);
  // Return items as well so the frontend can show recent evaluations without an extra fetch
  res.json({ batchId: batchDoc._id, aggregateScores, count: processed.length, items: processed });
  } catch (err) {
    console.error('[BatchEval] Outer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// New hybrid batch route (heuristic + llm + fusion stored per item)
router.post("/hybrid-batch", async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: "Items must be an array." });
  const start = Date.now();
  const concurrency = parseInt(process.env.EVAL_CONCURRENCY || '4', 10);
  const queue = items.slice();
  const results = [];
  async function worker(){
    while(queue.length){
      const item = queue.shift();
      const { agent, prompt, response } = item;
      try {
        const evalItem = await hybridEvaluate({ agent, prompt, response });
        results.push({ ok:true, doc: evalItem });
      } catch (e) {
        results.push({ ok:false, error: e.message, agent, prompt, response });
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  // Separate successful docs
  const docs = results.filter(r=>r.ok).map(r=> new EvaluationItem({ ...r.doc }));
  if (docs.length) await EvaluationItem.insertMany(docs, { ordered: false });
  const processed = docs.concat(results.filter(r=>!r.ok).map(r=>r));
  const durationMs = Date.now() - start;
  console.log(`[HybridBatch] Evaluated ${items.length} items in ${durationMs} ms (concurrency=${concurrency})`);
  // Aggregate fused scores
  const fuseAgg = processed.filter(p=>p.fused).reduce((acc, p) => {
    acc.instruction += p.fused.instruction || 0;
    acc.hallucination += p.fused.hallucination || 0;
    acc.assumption += p.fused.assumption || 0;
    acc.coherence += p.fused.coherence || 0;
    acc.count++;
    return acc;
  }, { instruction:0,hallucination:0,assumption:0,coherence:0,count:0 });
  const aggregateScores = fuseAgg.count ? {
    instruction: fuseAgg.instruction / fuseAgg.count,
    hallucination: fuseAgg.hallucination / fuseAgg.count,
    assumption: fuseAgg.assumption / fuseAgg.count,
    coherence: fuseAgg.coherence / fuseAgg.count
  } : { instruction:0,hallucination:0,assumption:0,coherence:0 };
  res.json({ count: processed.length, aggregateScores, durationMs, items: processed.map(p => ({ id: p._id, agent: p.agent, fused: p.fused, heuristic: p.heuristic, llm: p.llm, confidence: p.confidence })) });
});

router.post("/", async (req, res) => {
  let { agent, prompt, response } = req.body;
  try {
    // Preprocessing: clean, normalize, detect language
    prompt = normalize(prompt.trim());
    response = normalize(response.trim());
    const promptLang = franc(prompt);
    const responseLang = franc(response);

    const heuristic = computeHeuristicScores(prompt, response);
    const llmScores = await evaluateResponse(prompt, response, 'local');
    const llmIsFlat = [llmScores.instruction, llmScores.hallucination, llmScores.assumption, llmScores.coherence].every(v => v === 1);
    const wHeu = llmIsFlat ? 0.9 : 0.5;
    const wLlm = 1 - wHeu;
    const scores = {
      instruction: wHeu * heuristic.instruction + wLlm * (llmScores.instruction ?? heuristic.instruction),
      hallucination: wHeu * heuristic.hallucination + wLlm * (llmScores.hallucination ?? heuristic.hallucination),
      assumption: wHeu * heuristic.assumption + wLlm * (llmScores.assumption ?? heuristic.assumption),
      coherence: wHeu * heuristic.coherence + wLlm * (llmScores.coherence ?? heuristic.coherence),
      explanation: llmScores.explanation || ""
    };

    const result = new Result({
      agent,
      prompt,
      response,
      provider: 'local',
      scores,
      explanation: scores.explanation || "",
      promptLang,
      responseLang,
      evalMeta: { evalModel: llmScores?._model, evalProvider: llmScores?._provider || provider }
    });

  await result.save();
  console.log(`[SingleEval] Saved result: agent='${agent}', prompt='${prompt.slice(0, 40)}', response='${response.slice(0, 40)}'`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/leaderboard", async (req, res) => {
  // Aggregate from BatchResult collection
  const agg = await BatchResult.aggregate([
    { $unwind: "$items" },
    { $group: {
        _id: "$agent",
        avgInstruction: { $avg: "$items.scores.instruction" },
        avgHallucination: { $avg: "$items.scores.hallucination" },
        avgAssumption: { $avg: "$items.scores.assumption" },
        avgCoherence: { $avg: "$items.scores.coherence" }
    }}
  ]);
  res.json(agg);
});

export default router;
