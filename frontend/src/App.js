import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { getLeaderboard, batchGenerate, batchEvaluate } from './api';
import BatchEvaluation from './components/BatchEvaluation';
import Leaderboard from './components/leaderboard';
import RecentEvaluations from './components/RecentEvaluations';
import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import './App.css';

function App() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const data = await getLeaderboard();
      const mapped = (data || []).map((row) => ({
        agent: row._id,
        instruction: row.avgInstruction,
        hallucination: row.avgHallucination,
        assumption: row.avgAssumption,
        coherence: row.avgCoherence,
      }));
      setLeaderboard(mapped);
    } catch (err) {
      setError('Failed to load leaderboard data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchComplete = (evaluatedItems) => {
    setRecent(evaluatedItems.slice(-10));
    loadInitialData(); // Refresh leaderboard
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="app">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
      
      <Header />
      
      <main className="main-content">
        <div className="container">
          <BatchEvaluation 
            onBatchComplete={handleBatchComplete}
            error={error}
            onError={setError}
          />
          
          <div className="dashboard-grid">
            <Leaderboard 
              data={leaderboard}
              loading={loading}
            />
            
            <RecentEvaluations 
              data={recent}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
