import React, { useState } from 'react';
import './RecentEvaluations.css';

// Shows only the latest evaluation collapsed by default.
// Clicking it expands to show the full list. Within the full list
// each item can be toggled open/closed to reveal details.
const RecentEvaluations = ({ data }) => {
  const [showAll, setShowAll] = useState(false); // false = show only most recent
  const [openIndices, setOpenIndices] = useState(new Set()); // indices with details open

  const formatValue = (value) => {
    if (typeof value !== 'number') return 'N/A';
    return value.toFixed(3);
  };

  const getScoreColor = (value) => {
    if (value >= 0.85) return '#38a169';
    if (value >= 0.7) return '#3182ce';
    if (value >= 0.5) return '#dd6b20';
    return '#e53e3e';
  };

  const getOverallScore = (scores) => {
    if (!scores) return 0;
    const { instruction, hallucination, assumption, coherence } = scores;
    return ((instruction || 0) + (hallucination || 0) + (assumption || 0) + (coherence || 0)) / 4;
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const toggleDetails = (idx) => {
    setOpenIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  if (!data || data.length === 0) {
    return (
      <div className="recent-evaluations">
        <div className="recent-header">
          <h2 className="recent-title">Recent Evaluations</h2>
          <p className="recent-subtitle">Latest batch evaluation results</p>
        </div>
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p className="empty-message">No recent evaluations</p>
          <p className="empty-subtitle">Run a batch evaluation to see results here</p>
        </div>
      </div>
    );
  }

  const list = showAll ? data : [data[0]];

  return (
    <div className="recent-evaluations">
      <div className="recent-header">
        <h2 className="recent-title">Recent Evaluations</h2>
        <p className="recent-subtitle">Latest batch evaluation results</p>
        {showAll && (
          <div className="view-controls">
            <button
              type="button"
              className="view-toggle-btn"
              onClick={() => {
                setShowAll(false);
                setOpenIndices(new Set());
              }}
            >
              Collapse to Latest
            </button>
          </div>
        )}
      </div>
      <div className="evaluations-list">
        {list.map((item, index) => {
          const overall = getOverallScore(item.scores);
          const globalIndex = showAll ? index : 0;
          const isOpen = openIndices.has(globalIndex);
          return (
            <div key={globalIndex} className="evaluation-item">
              <div className="evaluation-header" onClick={() => showAll ? toggleDetails(globalIndex) : setShowAll(true)}>
                <div className="evaluation-info">
                  <div className="agent-name">{item.agent}</div>
                  <div className="evaluation-meta">
                    <div>
                      <span className="overall-score" style={{ color: getScoreColor(overall) }}>Overall: {formatValue(overall)}</span>
                      <span className="evaluation-time">{new Date().toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                <div className="evaluation-actions">
                  <div className="expand-icon">{showAll ? (isOpen ? '▼' : '▶') : '▶'}</div>
                </div>
              </div>
              {showAll && isOpen && (
                <div className="evaluation-details">
                  <div className="scores-grid">
                    <div className="score-item"><span className="score-label">Instruction</span><span className="score-value" style={{ color: getScoreColor(item.scores?.instruction) }}>{formatValue(item.scores?.instruction)}</span></div>
                    <div className="score-item"><span className="score-label">Hallucination</span><span className="score-value" style={{ color: getScoreColor(item.scores?.hallucination) }}>{formatValue(item.scores?.hallucination)}</span></div>
                    <div className="score-item"><span className="score-label">Assumption</span><span className="score-value" style={{ color: getScoreColor(item.scores?.assumption) }}>{formatValue(item.scores?.assumption)}</span></div>
                    <div className="score-item"><span className="score-label">Coherence</span><span className="score-value" style={{ color: getScoreColor(item.scores?.coherence) }}>{formatValue(item.scores?.coherence)}</span></div>
                  </div>
                  <div className="content-section">
                    <div className="content-item">
                      <h4 className="content-label">Batch Responses</h4>
                      <div className="content-text">
                        {Array.isArray(item.responses) ? item.responses.map((resp, idx) => (
                          <div key={idx} className="batch-response">
                            <strong>Prompt:</strong> {truncateText(resp.prompt, 100)}<br/>
                            <strong>Response:</strong> {truncateText(resp.response, 200)}
                          </div>
                        )) : <span>No batch responses found.</span>}
                      </div>
                    </div>
                    {item.explanation && (
                      <div className="content-item">
                        <h4 className="content-label">Explanation</h4>
                        <p className="content-text explanation">{item.explanation}</p>
                      </div>
                    )}
                    {item.error && (
                      <div className="error-item">
                        <h4 className="error-label">Error</h4>
                        <p className="error-text">{item.error}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentEvaluations;
