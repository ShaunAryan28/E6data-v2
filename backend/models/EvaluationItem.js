import mongoose from 'mongoose';

const DimensionScores = new mongoose.Schema({
  instruction: Number,
  hallucination: Number,
  assumption: Number,
  coherence: Number,
  explanation: String
},{ _id:false });

const FeatureVector = new mongoose.Schema({
  coverage: Number,
  extraRatio: Number,
  numPenalty: Number,
  speculativeDensity: Number,
  variation: Number,
  contradictionMarkers: Number,
  shortRatio: Number,
  unresolvedPronounsRatio: Number,
  tokenCounts: { prompt: Number, response: Number }
},{ _id:false });

const EvaluationItemSchema = new mongoose.Schema({
  agent: { type: String, index: true },
  responseId: { type: mongoose.Schema.Types.ObjectId },
  prompt: String,
  response: String,
  heuristic: DimensionScores,
  llm: DimensionScores,
  fused: DimensionScores,
  weights: { heuristic: Number, llm: Number },
  confidence: Number,
  flatLLM: Boolean,
  features: FeatureVector,
  evaluatorVersion: { type: String, default: '1.0.0' },
  flags: [String],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('EvaluationItem', EvaluationItemSchema);
