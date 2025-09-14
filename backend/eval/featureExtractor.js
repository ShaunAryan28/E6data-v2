import normalize from 'normalize-text';

// Basic stopwords (can be expanded)
const STOPWORDS = new Set(['the','and','or','of','to','a','in','on','for','with','that','this','is','are','be','as','an','at','by','it','from','was','were','will','would','can','could','should','may','might','have','has','had','not']);

export function tokenize(text){
  return (text.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).filter(w => !STOPWORDS.has(w));
}

function unique(arr){ return Array.from(new Set(arr)); }
function clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }

export function extractFeatures(prompt, response){
  prompt = normalize(prompt || '');
  response = normalize(response || '');
  const pTokens = unique(tokenize(prompt));
  const rTokensAll = tokenize(response);
  const rTokensSet = new Set(rTokensAll);
  const coverage = pTokens.length ? pTokens.filter(t => rTokensSet.has(t)).length / pTokens.length : 0;
  const pSet = new Set(pTokens);
  const extraTokens = rTokensAll.filter(t => !pSet.has(t));
  const extraRatio = rTokensAll.length ? extraTokens.length / rTokensAll.length : 0;
  const promptNums = prompt.match(/\d+/g) || [];
  const respNums = response.match(/\d+/g) || [];
  const extraneousNums = respNums.filter(n => !promptNums.includes(n));
  const numPenalty = respNums.length ? extraneousNums.length / respNums.length : 0;
  const speculativeTerms = ['assume','suppose','let\'s say','maybe','probably','i think','it seems','likely','guess','hypothesize','possibly'];
  let speculativeHits = 0;
  for(const term of speculativeTerms){
    const re = new RegExp(term.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&'),'gi');
    speculativeHits += (response.match(re) || []).length;
  }
  const sentences = response.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const lengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length).filter(l => l>0);
  let variation = 0;
  if (lengths.length > 1){
    const mean = lengths.reduce((a,b)=>a+b,0)/lengths.length;
    const variance = lengths.reduce((a,b)=>a+Math.pow(b-mean,2),0)/lengths.length;
    variation = Math.sqrt(variance)/(mean+1);
  }
  const contradictionMarkers = (response.match(/\b(however|but|although|yet)\b/gi) || []).length;
  const shortSentences = lengths.filter(l => l < 4).length;
  const shortRatio = lengths.length ? shortSentences/lengths.length : 0;
  const unresolvedPronouns = (response.match(/\b(it|they|them|this|that)\b/gi) || []).length;

  return {
    coverage,
    extraRatio,
    numPenalty,
    speculativeDensity: sentences.length ? speculativeHits / sentences.length : 0,
    variation,
    contradictionMarkers,
    shortRatio,
    unresolvedPronounsRatio: sentences.length ? unresolvedPronouns / sentences.length : 0,
    tokenCounts: { prompt: pTokens.length, response: rTokensAll.length }
  };
}

export function heuristicScores(feat){
  const instruction = clamp01(feat.coverage);
  const hallucination = clamp01(1 - (feat.extraRatio * 0.4 + feat.numPenalty * 0.6));
  const assumption = clamp01(1 - Math.min(feat.speculativeDensity,1) * 0.7);
  const coherence = clamp01(1 - (feat.variation*0.25 + feat.contradictionMarkers*0.05 + feat.shortRatio*0.2 + feat.unresolvedPronounsRatio*0.25));
  return { instruction, hallucination, assumption, coherence };
}

export function buildHeuristic(prompt, response){
  const feat = extractFeatures(prompt, response);
  return { features: feat, scores: heuristicScores(feat) };
}
