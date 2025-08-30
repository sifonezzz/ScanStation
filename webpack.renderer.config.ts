const rules = require('./webpack.rules.ts');
const plugins = require('./webpack.plugins.ts');

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});
rules.push({
  test: /\.html$/,
  use: {
    loader: 'html-loader',
    options: {
      // This tells html-loader not to try and resolve image src attributes.
      // We handle all image paths dynamically in our JavaScript.
      sources: false,
    },
  },
});

const rendererConfig = {
  module: {
    rules,
  },
  // Add this 'node' object
  node: {
    __dirname: false,
    __filename: false,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};

module.exports = rendererConfig;