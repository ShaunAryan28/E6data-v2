import mongoose from 'mongoose';

const MetricSnapshotSchema = new mongoose.Schema({
  agent: { type: String, index: true },
  window: { type: String, index: true }, // e.g., '24h','7d'
  metrics: mongoose.Schema.Types.Mixed, // { instruction:{mean,p50,p90}, hallucination:{...}, ... }
  evaluatorVersion: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('MetricSnapshot', MetricSnapshotSchema);
