import mongoose from 'mongoose';

const PromptTemplateSchema = new mongoose.Schema({
  text: { type: String, required: true },
  tags: [String],
  requiredConstraints: [String],
  expectedFormat: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('PromptTemplate', PromptTemplateSchema);
