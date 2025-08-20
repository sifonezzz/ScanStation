const rules = require('./webpack.rules.ts');

const mainConfig = {
  entry: './src/index.ts',
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