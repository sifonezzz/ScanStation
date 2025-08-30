const rules = require('./webpack.rules.ts');

const mainConfig = {
  entry: './src/index.ts',
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
};

module.exports = mainConfig;