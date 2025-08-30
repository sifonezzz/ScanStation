// sifonezzz-scanstation/webpack.main.config.ts

const rules = require('./webpack.rules.ts');

const mainConfig = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/index.ts',

  // Put your normal webpack config below here
  module: {
    rules,
  },
  
  // V-- ADD THIS 'externals' BLOCK --V
  // ^-- ADD THIS 'externals' BLOCK --^

  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
};

module.exports = mainConfig;