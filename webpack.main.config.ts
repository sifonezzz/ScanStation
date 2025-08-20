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
  externals: {
    'simple-git': 'commonjs simple-git',
    'fs-extra': 'commonjs fs-extra',
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
};

module.exports = mainConfig;