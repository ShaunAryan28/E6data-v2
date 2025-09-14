import React from 'react';
import './MetricCard.css';

const MetricCard = ({ title, value, description, trend }) => {
  // Uniform higher-is-better logic. For hallucination we now pass 1 - rawHallucination from callers.
  const getScoreColor = (score) => {
    if (score >= 0.85) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'fair';
    return 'poor';
  };

  const getScoreLabel = (score) => {
    if (score >= 0.85) return 'Excellent';
    if (score >= 0.7) return 'Good';
    if (score >= 0.5) return 'Fair';
    return 'Poor';
  };

  const formatValue = (val) => {
    if (typeof val !== 'number') return 'N/A';
    return val.toFixed(3);
  };

  const scoreColor = getScoreColor(value);
  const scoreLabel = getScoreLabel(value);

  return (
    <div className={`metric-card ${scoreColor}`}>
      <div className="metric-header">
        <h4 className="metric-title">{title}</h4>
        <div className="metric-badge">
          {scoreLabel}
        </div>
      </div>
      
      <div className="metric-value">
        {formatValue(value)}
      </div>
      
      <div className="metric-bar">
        <div 
          className="metric-fill"
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
      
      <p className="metric-description">
        {description}
      </p>
      
      {trend && (
        <div className="metric-trend">
          <span className={`trend-icon ${trend > 0 ? 'trend-up' : 'trend-down'}`}>
            {trend > 0 ? '↗' : '↘'}
          </span>
          <span className="trend-value">
            {Math.abs(trend).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
