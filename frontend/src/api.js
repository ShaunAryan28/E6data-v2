const BASE_URL = process.env.REACT_APP_API_URL || "/api";
const PROVIDER = 'local';

// Enhanced API functions with better error handling and TypeScript-like JSDoc
/**
 * Generate multiple responses for batch evaluation
 * @param {string} prompt - The prompt to generate responses for
 * @param {string} agent - The agent name
 * @param {number} count - Number of responses to generate
 * @param {string} provider - Provider (defaults to 'local')
 * @param {number} temperature - Temperature for generation
 * @param {number} max_tokens - Maximum tokens to generate
 * @returns {Promise<Object>} Generation results
 */
export async function batchGenerate(prompt, agent, count = 10, provider = PROVIDER, temperature, max_tokens) {
  try {
    const body = { 
      prompt, 
      agent, 
      count, 
      provider: provider || PROVIDER 
    };
    
  if (temperature !== undefined) body.temperature = temperature;
  if (max_tokens !== undefined) body.max_tokens = max_tokens;
  // constrained mode removed
    
    const res = await fetch(`${BASE_URL}/generate/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Batch generation error:', error);
    throw new Error(`Failed to generate responses: ${error.message}`);
  }
}

// constrainedGenerate removed

/**
 * Evaluate a batch of items
 * @param {Array} items - Array of items to evaluate
 * @returns {Promise<Object>} Evaluation results
 */
export async function batchEvaluate(items) {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items must be a non-empty array');
    }
    
    const res = await fetch(`${BASE_URL}/evaluate/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Batch evaluation error:', error);
    throw new Error(`Failed to evaluate responses: ${error.message}`);
  }
}

/**
 * Generate a single response (legacy function for compatibility)
 * @param {string} prompt - The prompt to generate response for
 * @returns {Promise<Object>} Generation result
 */
export async function generateResponse(prompt) {
  try {
    const res = await fetch(`${BASE_URL}/agent/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Single generation error:', error);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

/**
 * Evaluate a single response (legacy function for compatibility)
 * @param {string} agent - Agent name
 * @param {string} prompt - The prompt
 * @param {string} response - The response to evaluate
 * @returns {Promise<Object>} Evaluation result
 */
export async function evaluate(agent, prompt, response) {
  try {
    const res = await fetch(`${BASE_URL}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, prompt, response, provider: PROVIDER })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Single evaluation error:', error);
    throw new Error(`Failed to evaluate response: ${error.message}`);
  }
}

/**
 * Get the leaderboard data
 * @returns {Promise<Array>} Leaderboard data
 */
export async function getLeaderboard() {
  try {
    const res = await fetch(`${BASE_URL}/evaluate/leaderboard`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    throw new Error(`Failed to fetch leaderboard: ${error.message}`);
  }
}

/**
 * Get health status of the API
 * @returns {Promise<Object>} Health status
 */
export async function getHealthStatus() {
  try {
    const res = await fetch(`${BASE_URL}/generate/health`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Health check error:', error);
    throw new Error(`Failed to check API health: ${error.message}`);
  }
}

/**
 * Get available models
 * @returns {Promise<Object>} Available models
 */
export async function getAvailableModels() {
  try {
    const res = await fetch(`${BASE_URL}/generate/list-models`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Models fetch error:', error);
    throw new Error(`Failed to fetch models: ${error.message}`);
  }
}
