const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  // Main process config
  const mainConfig = {
    context: __dirname,
    entry: './src/main/index.ts',
    target: 'electron-main',
    mode: isDev ? 'development' : 'production',
    output: {
      path: path.resolve(__dirname, 'dist/main'),
      filename: 'index.js',
    },
    resolve: {
      extensions: ['.ts', '.js'],
      modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
      symlinks: true,
      alias: {
        'scheduler': path.resolve(__dirname, 'node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/scheduler'),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.main.json'),
            },
          },
          include: path.resolve(__dirname, 'src'),
        },
      ],
    },
    node: {
      __dirname: false,
      __filename: false,
    },
    externals: {
      electron: 'commonjs electron',
    },
  };

  // Preload config
  const preloadConfig = {
    context: __dirname,
    entry: './src/preload/index.ts',
    target: 'electron-preload',
    mode: isDev ? 'development' : 'production',
    output: {
      path: path.resolve(__dirname, 'dist/preload'),
      filename: 'index.js',
    },
    resolve: {
      extensions: ['.ts', '.js'],
      modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
      symlinks: true,
      alias: {
        'scheduler': path.resolve(__dirname, 'node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/scheduler'),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.main.json'),
            },
          },
          include: path.resolve(__dirname, 'src'),
        },
      ],
    },
    node: {
      __dirname: false,
      __filename: false,
    },
  };

  // Renderer config
  const rendererConfig = {
    context: __dirname,
    entry: './src/renderer/app.tsx',
    target: 'web',
    mode: isDev ? 'development' : 'production',
    output: {
      path: path.resolve(__dirname, 'dist/renderer'),
      filename: 'app.js',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
      symlinks: true,
      alias: {
        'scheduler': path.resolve(__dirname, 'node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/scheduler'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.renderer.json'),
            },
          },
          include: path.resolve(__dirname, 'src'),
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
        filename: 'index.html',
      }),
    ],
    devtool: isDev ? 'source-map' : false,
  };

  return [mainConfig, preloadConfig, rendererConfig];
};
