const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/main.js',
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true
    },

    devServer: {
      static: {
        directory: path.join(__dirname, 'dist'),
      },
      compress: true,
      port: 8080,
      hot: true,
      open: true,
      historyApiFallback: true,
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
    },

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/images/[name][ext]'
          }
        },
        {
          test: /\.(mp3|wav|ogg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/sounds/[name][ext]'
          }
        },
        {
          test: /\.(json)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/data/[name][ext]'
          }
        }
      ]
    },

    plugins: [
      new CleanWebpackPlugin(),
      
      new HtmlWebpackPlugin({
        template: './src/index.html',
        title: 'ChimArena',
        minify: isProduction ? {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          useShortDoctype: true
        } : false
      }),

      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'assets',
            to: 'assets',
            noErrorOnMissing: true
          },
          {
            from: 'public',
            to: '.', // 👉 copie tout le contenu de client/public/ dans dist/
            noErrorOnMissing: true
          }
        ]
      })
    ],

    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction
            }
          }
        })
      ],
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          },
          phaser: {
            test: /[\\/]node_modules[\\/]phaser[\\/]/,
            name: 'phaser',
            chunks: 'all'
          }
        }
      }
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@assets': path.resolve(__dirname, 'assets'),
        '@scenes': path.resolve(__dirname, 'src/scenes'),
        '@game': path.resolve(__dirname, 'src/game'),
        '@utils': path.resolve(__dirname, 'src/utils')
      }
    },

    devtool: isProduction ? 'source-map' : 'eval-source-map',

    performance: {
      hints: isProduction ? 'warning' : false,
      maxAssetSize: 1000000,
      maxEntrypointSize: 1000000
    }
  };
};
