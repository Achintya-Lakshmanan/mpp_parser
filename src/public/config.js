// Runtime configuration for MPP Parser
window.MPP_CONFIG = {
  API_URL: process.env.API_URL || window.location.origin
};

console.log('MPP Parser Config loaded:', window.MPP_CONFIG);