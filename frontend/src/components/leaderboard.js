import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend} from 'recharts';
import './Leaderboard.css';

const Leaderboard = ({ data, loading }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('instruction');
  const [sortOrder, setSortOrder] = useState('desc');

  const filtered = data.filter(agent =>
    typeof agent.agent === "string" && agent.agent.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const chartData = sorted.map(agent => {
    const rawHall = agent.hallucination ?? 0;
    const hallScore = 1 - rawHall; // invert so higher is better
    return {
      name: agent.agent.length > 15 ? agent.agent.substring(0, 15) + '...' : agent.agent,
      fullName: agent.agent,
      Instruction: agent.instruction ?? 0,
      Hallucination: hallScore,
      Assumption: agent.assumption ?? 0,
      Coherence: agent.coherence ?? 0,
      _rawHallucination: rawHall
    };
  });

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return '↕️';
    return sortOrder === 'desc' ? '↓' : '↑';
  };

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

  if (loading) {
    return (
      <div className="leaderboard">
        <div className="leaderboard-header">
          <h2 className="leaderboard-title">Leaderboard</h2>
        </div>
        <div className="loading-placeholder">
          <div className="loading-skeleton"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h2 className="leaderboard-title">Agent Leaderboard</h2>
        <p className="leaderboard-subtitle">
          Performance rankings based on evaluation metrics
        </p>
      </div>

      <div className="leaderboard-controls">
        <div className="search-container">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="chart-container">
          <h3 className="chart-title">Performance Overview</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="name" 
                  stroke="#4a5568" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  domain={[0, 1]} 
                  stroke="#4a5568" 
                  fontSize={12}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip 
                  formatter={(value, name) => [value.toFixed(3), name]}
                  labelFormatter={(label, payload) => {
                    const data = payload?.[0]?.payload;
                    return data?.fullName || label;
                  }}
                />
                <Legend />
                <Bar dataKey="Instruction" fill="#3182ce" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Hallucination" fill="#38a169" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Assumption" fill="#ed8936" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Coherence" fill="#805ad5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th 
                className="table-header sortable"
                onClick={() => handleSort('agent')}
              >
                Agent {getSortIcon('agent')}
              </th>
              <th 
                className="table-header sortable"
                onClick={() => handleSort('instruction')}
              >
                Instruction {getSortIcon('instruction')}
              </th>
              <th 
                className="table-header sortable"
                onClick={() => handleSort('hallucination')}
              >
                Hallucination {getSortIcon('hallucination')}
              </th>
              <th 
                className="table-header sortable"
                onClick={() => handleSort('assumption')}
              >
                Assumption {getSortIcon('assumption')}
              </th>
              <th 
                className="table-header sortable"
                onClick={() => handleSort('coherence')}
              >
                Coherence {getSortIcon('coherence')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr key={idx} className="table-row">
                <td className="table-cell agent-cell">
                  <span className="agent-name">{row.agent}</span>
                </td>
                <td className="table-cell score-cell">
                  <span 
                    className="score-value"
                    style={{ color: getScoreColor(row.instruction, 'instruction') }}
                  >
                    {formatValue(row.instruction)}
                  </span>
                </td>
                <td className="table-cell score-cell">
                  <span
                    className="score-value"
                    style={{ color: getScoreColor(1 - (row.hallucination ?? 0)) }}
                    title={`Raw: ${formatValue(row.hallucination)} | Inverted: ${formatValue(1 - (row.hallucination ?? 0))}`}
                  >
                    {formatValue(1 - (row.hallucination ?? 0))}
                  </span>
                </td>
                <td className="table-cell score-cell">
                  <span 
                    className="score-value"
                    style={{ color: getScoreColor(row.assumption, 'assumption') }}
                  >
                    {formatValue(row.assumption)}
                  </span>
                </td>
                <td className="table-cell score-cell">
                  <span 
                    className="score-value"
                    style={{ color: getScoreColor(row.coherence, 'coherence') }}
                  >
                    {formatValue(row.coherence)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {sorted.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <p className="empty-message">No agents found</p>
            <p className="empty-subtitle">Try adjusting your search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
