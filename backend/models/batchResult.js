import mongoose from "mongoose";

const batchItemSchema = new mongoose.Schema({
  agent: String,
  prompt: String,
  response: String,
  model: String,
  provider: String,
  scores: {
    instruction: Number,
    hallucination: Number,
    assumption: Number,
    coherence: Number
  },
  explanation: String,
  status: String,
  error: String,
  attempts: Number,
  evalMeta: mongoose.Schema.Types.Mixed
}, { _id: false });

const batchResultSchema = new mongoose.Schema({
  agent: String,
  provider: String,
  prompt: String, // original prompt when single prompt expanded into multiple
  countRequested: Number,
  countEvaluated: Number,
  aggregateScores: {
    instruction: Number,
    hallucination: Number,
    assumption: Number,
    coherence: Number
  },
  items: [batchItemSchema]
}, { timestamps: true });

export default mongoose.model('BatchResult', batchResultSchema);
