import mongoose from "mongoose";

const resultSchema = new mongoose.Schema({
  agent: String,
  prompt: String,
  response: String,
  model: String, // generation model used (if known)
  provider: { type: String, default: "local" },
  scores: {
    instruction: Number,
    hallucination: Number,
    assumption: Number,
    coherence: Number
  },
  explanation: String,
  evalMeta: mongoose.Schema.Types.Mixed // store evaluator metadata like _model, _attempts, _failures
}, { timestamps: true });

export default mongoose.model("Result", resultSchema);
