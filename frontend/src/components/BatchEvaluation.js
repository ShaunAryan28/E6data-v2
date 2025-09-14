import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { batchGenerate, batchEvaluate } from '../api';
import MetricCard from './MetricCard';
import './BatchEvaluation.css';

const BatchEvaluation = ({ onBatchComplete, error, onError }) => {
  const [formData, setFormData] = useState({
    agent: 'local-agent',
    prompt: '',
    count: 25,
    temperature: 0.7,
  maxTokens: 512
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'count' || name === 'temperature' || name === 'maxTokens' 
        ? Number(value) 
        : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setLoading(true);
    onError(null);
    
    try {
      // Step 1: Generate responses
      toast.loading('Generating responses...', { id: 'generating' });
      const genRes = await batchGenerate(
        formData.prompt,
        formData.agent,
        formData.count,
        'local',
        formData.temperature,
        formData.maxTokens
      );

      if (genRes.error) {
        throw new Error(genRes.error);
      }

      const items = genRes.items || genRes.results || [];
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('No items generated');
      }

      // Step 2: Evaluate responses
      toast.loading('Evaluating responses...', { id: 'evaluating' });
      const evalRes = await batchEvaluate(items);
      
      if (evalRes.error) {
        throw new Error(evalRes.error);
      }

      const evaluatedItems = Array.isArray(evalRes) ? evalRes : (evalRes.items || []);
      setResults(evaluatedItems);
      onBatchComplete(evaluatedItems);
      
      toast.success(`Successfully evaluated ${evaluatedItems.length} responses!`, { id: 'success' });
      
    } catch (err) {
      const errorMsg = err.message || 'An error occurred during batch processing';
      onError(errorMsg);
      toast.error(errorMsg, { id: 'error' });
    } finally {
      setLoading(false);
      toast.dismiss('generating');
      toast.dismiss('evaluating');
    }
  };

  const calculateAggregateScores = () => {
    if (results.length === 0) return null;
    
    const aggregate = results.reduce((acc, item) => {
      if (item.scores) {
        acc.instruction += item.scores.instruction || 0;
        acc.hallucination += item.scores.hallucination || 0;
        acc.assumption += item.scores.assumption || 0;
        acc.coherence += item.scores.coherence || 0;
        acc.count++;
      }
      return acc;
    }, { instruction: 0, hallucination: 0, assumption: 0, coherence: 0, count: 0 });

    return {
      instruction: aggregate.count ? aggregate.instruction / aggregate.count : 0,
      hallucination: aggregate.count ? aggregate.hallucination / aggregate.count : 0,
      assumption: aggregate.count ? aggregate.assumption / aggregate.count : 0,
      coherence: aggregate.count ? aggregate.coherence / aggregate.count : 0
    };
  };

  const aggregateScores = calculateAggregateScores();

  return (
    <div className="batch-evaluation">
      <div className="evaluation-header">
        <h2 className="evaluation-title">Batch Evaluation</h2>
        <p className="evaluation-description">
          Generate and evaluate multiple AI responses to analyze performance metrics
        </p>
      </div>

      <form onSubmit={handleSubmit} className="evaluation-form">
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Agent Name</label>
            <input
              type="text"
              name="agent"
              value={formData.agent}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Enter agent name"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Batch Size</label>
            <input
              type="number"
              name="count"
              value={formData.count}
              onChange={handleInputChange}
              className="form-input"
              min="1"
              max="200"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Prompt</label>
          <textarea
            name="prompt"
            value={formData.prompt}
            onChange={handleInputChange}
            className="form-textarea"
            placeholder="Enter your prompt here..."
            rows="4"
            required
          />
        </div>

        <div className="advanced-section">
          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </button>
          
          {showAdvanced && (
            <div className="advanced-settings">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label temp-label">Temperature</label>
                  <input
                    type="number"
                    name="temperature"
                    value={formData.temperature}
                    onChange={handleInputChange}
                    className="form-input temp-input"
                    min="0"
                    max="2"
                    step="0.1"
                  />
                  <span className="field-description">Controls randomness. Lower values = more predictable output, higher values = more creative output.</span>
                </div>
                <div className="form-group">
                  <label className="form-label max-label">Max Tokens</label>
                  <input
                    type="number"
                    name="maxTokens"
                    value={formData.maxTokens}
                    onChange={handleInputChange}
                    className="form-input max-input"
                    min="1"
                    max="4000"
                  />
                  <span className="field-description">Limits response length. Higher values = longer output.</span>
                </div>
                {/* Constrained mode removed */}
              </div>
            </div>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className="submit-button"
          >
            {loading ? (
              <>
                <div className="button-spinner"></div>
                Processing...
              </>
            ) : (
              `Generate & Evaluate ${formData.count} Responses`
            )}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}
      </form>

      {aggregateScores && (
        <div className="results-section">
          <h3 className="results-title">
            Aggregate Scores 
            <span className="results-count">({results.length} items)</span>
          </h3>
          {/* Constrained mode indicators removed */}
          <div className="metrics-grid">
            <MetricCard
              title="Instruction Following"
              value={aggregateScores.instruction}
              description="How well the response follows the given instructions"
            />
            <MetricCard
              title="Hallucination Control"
              value={1 - aggregateScores.hallucination}
              description="How well the response avoids making up information (higher is better; shown as 1 - raw)"
            />
            <MetricCard
              title="Assumption Avoidance"
              value={aggregateScores.assumption}
              description="How well the response avoids making unsupported assumptions"
            />
            <MetricCard
              title="Coherence"
              value={aggregateScores.coherence}
              description="How coherent and well-structured the response is"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchEvaluation;
