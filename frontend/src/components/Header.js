import React from 'react';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-main">
          <h1 className="header-title">
            <span className="header-icon">🤖</span>
            Agent Evaluation Platform
          </h1>
          <p className="header-subtitle">
            Advanced AI agent performance analysis and benchmarking
          </p>
        </div>
      </div>
    </header>
  );
};

export default Header;
