function clamp01(v){ return v<0?0:v>1?1:v; }

export function detectFlat(llm){
  if(!llm) return true;
  const vals = [llm.instruction,llm.hallucination,llm.assumption,llm.coherence];
  if(vals.some(v => v == null)) return false;
  const uniq = Array.from(new Set(vals));
  return uniq.length === 1; // all identical
}

export function fuseScores(heuristic, llm, opts={}){
  const flat = detectFlat(llm);
  const conf = opts.confidence == null ? 0.8 : opts.confidence; // placeholder
  const base = flat ? 0.15 : 0.5;
  const wLLM = clamp01(base * conf);
  const wHeu = 1 - wLLM;
  const fused = {};
  for(const k of ['instruction','hallucination','assumption','coherence']){
    const h = heuristic?.[k] ?? 0;
    const l = llm?.[k] ?? h;
    fused[k] = wHeu * h + wLLM * l;
  }
  return { fused, weights: { heuristic: wHeu, llm: wLLM }, flat, confidence: conf };
}
