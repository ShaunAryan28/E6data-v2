# Agent Evaluation Platform - Frontend

A modern, polished React frontend for the Agent Evaluation Platform that provides advanced AI agent performance analysis and benchmarking.

## Features

### 🚀 Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Modern Components**: Clean, intuitive interface with smooth animations
- **Accessibility**: Built with accessibility best practices
- **Dark/Light Theme**: Automatic theme detection with smooth transitions

### 📊 Batch Evaluation
- **Advanced Form**: Intuitive form with advanced settings (temperature, max tokens)
- **Real-time Feedback**: Live progress indicators and toast notifications
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Results Visualization**: Beautiful metric cards with color-coded performance indicators

### 🏆 Leaderboard
- **Interactive Charts**: Recharts-powered performance visualization
- **Sortable Table**: Click column headers to sort by any metric
- **Search & Filter**: Real-time search through agent names
- **Performance Metrics**: Instruction, Hallucination, Assumption, and Coherence scores

### 📋 Recent Evaluations
- **Expandable Cards**: Click to view detailed evaluation results
- **Comprehensive Details**: View prompts, responses, scores, and explanations
- **Error Tracking**: Clear error reporting for failed evaluations
- **Responsive Layout**: Optimized for all screen sizes

## Technology Stack

- **React 19.1.1**: Latest React with modern hooks and features
- **CSS3**: Custom CSS with CSS variables for theming
- **Recharts**: Beautiful, responsive charts for data visualization
- **React Hot Toast**: Elegant toast notifications
- **Fetch API**: Modern HTTP client with comprehensive error handling

## Component Architecture

```
src/
├── components/
│   ├── Header.js              # Main application header
│   ├── Header.css
│   ├── BatchEvaluation.js     # Batch evaluation form and results
│   ├── BatchEvaluation.css
│   ├── Leaderboard.js         # Agent leaderboard with charts
│   ├── Leaderboard.css
│   ├── RecentEvaluations.js   # Recent evaluation results
│   ├── RecentEvaluations.css
│   ├── MetricCard.js          # Reusable metric display component
│   ├── MetricCard.css
│   └── LoadingSpinner.js      # Loading state component
│   └── LoadingSpinner.css
├── api.js                     # API integration layer
├── App.js                     # Main application component
├── App.css                    # Global styles and utilities
└── index.js                   # Application entry point
```

## API Compatibility

The frontend is fully compatible with the existing backend API:

- **Batch Generation**: `/api/generate/batch`
- **Batch Evaluation**: `/api/evaluate/batch`
- **Leaderboard**: `/api/evaluate/leaderboard`
- **Health Check**: `/api/generate/health`
- **Model List**: `/api/generate/list-models`

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm start
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

## Configuration

The frontend automatically connects to the backend running on `http://localhost:5000` (configured via proxy in package.json).

To change the backend URL, set the `REACT_APP_API_URL` environment variable:

```bash
REACT_APP_API_URL=http://your-backend-url npm start
```

## Design System

### Color Palette
- **Primary**: #667eea (Blue gradient)
- **Secondary**: #764ba2 (Purple gradient)
- **Success**: #38a169 (Green)
- **Warning**: #ed8936 (Orange)
- **Error**: #e53e3e (Red)
- **Info**: #3182ce (Blue)

### Typography
- **Font Family**: System fonts (SF Pro, Segoe UI, Roboto, etc.)
- **Monospace**: SF Mono, Monaco, Consolas for code/metrics

### Spacing
- **Base Unit**: 0.25rem (4px)
- **Scale**: 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8, 12, 16, 20, 24

## Performance Features

- **Lazy Loading**: Components load only when needed
- **Optimized Re-renders**: Efficient state management
- **Responsive Images**: Optimized for different screen densities
- **Smooth Animations**: Hardware-accelerated CSS transitions
- **Error Boundaries**: Graceful error handling

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code style and patterns
2. Use semantic HTML and accessible components
3. Add appropriate CSS classes for styling
4. Include error handling for all API calls
5. Test on multiple screen sizes

## License

This project is part of the Agent Evaluation Platform.