const rules = require('./webpack.rules.ts');
const plugins = require('./webpack.plugins.ts');

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

rules.push({
  test: /\.html$/,
  use: 'html-loader',
});

const rendererConfig = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};

module.exports = rendererConfig;