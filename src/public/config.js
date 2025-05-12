// Runtime configuration for MPP Parser
window.MPP_CONFIG = {
  // Access environment variables safely through webpack's defined globals
  // webpack.DefinePlugin replaces process.env.X with the actual string value at build time
  API_URL: (window.env && window.env.API_URL) || 
          // Fallback to process.env if somehow available (server-side)
          (typeof process !== 'undefined' && process.env && process.env.API_URL) || 
          // Final fallback to current origin
          window.location.origin
};

console.log('MPP Parser Config loaded:', window.MPP_CONFIG);