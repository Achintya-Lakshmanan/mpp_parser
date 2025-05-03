// Runtime configuration for MPP Parser
window.MPP_CONFIG = {
  API_URL: window.location.origin // Default to current origin
};

// If URL contains localhost, keep it for development
if (window.location.hostname === 'localhost') {
  window.MPP_CONFIG.API_URL = 'http://localhost:3001';
}

console.log('MPP Parser Config loaded:', window.MPP_CONFIG); 