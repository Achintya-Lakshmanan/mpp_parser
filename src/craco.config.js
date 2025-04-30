const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Set the correct entry point
      webpackConfig.entry = [
        path.resolve(__dirname, './index.js')
      ];
      
      return webpackConfig;
    }
  },
  paths: function(paths) {
    // Define paths
    paths.appIndexJs = path.resolve(__dirname, './index.js');
    paths.appSrc = path.resolve(__dirname, './');
    
    return paths;
  },
  eslint: {
    enable: false
  }
}; 