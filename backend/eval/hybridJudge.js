import { buildHeuristic } from './featureExtractor.js';
import { fuseScores } from './fusion.js';
import { evaluateResponse as llmJudge } from '../services/llmjudge.js';

// Orchestrates heuristic + llm scoring for a single item
export async function hybridEvaluate({ prompt, response, agent }) {
  const { features, scores: heuristic } = buildHeuristic(prompt, response);
  let llm;
  let flags = [];
  try {
    const r = await llmJudge(prompt, response, 'local');
    llm = {
      instruction: r.instruction,
      hallucination: r.hallucination,
      assumption: r.assumption,
      coherence: r.coherence,
      explanation: r.explanation
    };
  } catch (e) {
    flags.push('llm_error');
    llm = null; // rely on heuristic only
  }
  const fusion = fuseScores(heuristic, llm, { confidence: 0.85 });
  return {
    agent,
    prompt,
    response,
    heuristic,
    llm: llm || undefined,
    fused: { ...fusion.fused },
    weights: fusion.weights,
    confidence: fusion.confidence,
    flatLLM: fusion.flat,
    features,
    flags
  };
}
